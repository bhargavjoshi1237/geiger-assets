"use client";

// Inbox — the creator's side of 1:1 chat with members. Fans reply from their
// inbox on the public page (inbound rows); the creator answers here, optionally
// locking a message behind a price with an attachment (outbound rows). Mass
// drops stay on Paid Messages.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock, MessagesSquare, Paperclip, Send, SquarePen, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { AssetThumbnail } from "@/components/internal/shared/asset_thumbnail";
import { EmptyState, LoadingArea, ScreenHeader, SearchInput, StatsBar, StatusPill } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { MSG_STATUS_META, formatMoney, parseDollarsToCents } from "./constants";
import { CreateDialog, SelectField, useCreatorRows } from "./creator_kit";
import { MediaPickerDialog } from "./media_picker_dialog";
import { createPaidMessage, listMembers, listPaidMessages, updatePaidMessage } from "@/lib/supabase/creator";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

function clock(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initial(member) {
  return (member?.fanName || member?.fanEmail || "?").slice(0, 1).toUpperCase();
}

function Composer({ assets, onSend }) {
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [assetIds, setAssetIds] = useState([]);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const send = async () => {
    if (!text.trim() && !assetIds.length) return;
    setSending(true);
    const ok = await onSend({ body: text.trim(), priceCents: parseDollarsToCents(price), attachmentAssetId: assetIds[0] || null });
    setSending(false);
    if (ok) {
      setText("");
      setPrice("");
      setAssetIds([]);
    }
  };

  return (
    <div className="space-y-2 border-t border-border p-3">
      {assetIds.length ? (
        <div className="flex items-center gap-2">
          <AssetThumbnail asset={assetById.get(assetIds[0])} assetId={assetIds[0]} className="h-10 w-10 rounded-md" iconClassName="h-4 w-4" />
          <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{assetById.get(assetIds[0])?.name || "Attachment"}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Remove attachment" className="h-7 w-7 text-text-secondary hover:bg-surface-active" onClick={() => setAssetIds([])}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Write a message…"
          className="max-h-32 min-h-10 resize-none bg-surface-card"
        />
        <Button size="icon" aria-label="Send" className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90" disabled={sending || (!text.trim() && !assetIds.length)} onClick={send}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => setPicking(true)}>
          <Paperclip className="h-4 w-4" />
          Attach
        </Button>
        <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-card pl-2">
          <Lock className="h-3.5 w-3.5 text-text-tertiary" />
          <span className="text-xs text-text-tertiary">$</span>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Free" aria-label="Unlock price" className="h-7 w-20 border-0 bg-transparent px-0 text-xs focus-visible:ring-0" />
        </div>
        <span className="text-[11px] text-text-tertiary">{parseDollarsToCents(price) ? "Fan pays to unlock" : "Free message"}</span>
      </div>
      <MediaPickerDialog
        open={picking}
        onOpenChange={setPicking}
        assets={assets}
        selected={assetIds}
        max={1}
        title="Attach to message"
        onDone={(ids) => {
          setAssetIds(ids);
          setPicking(false);
        }}
      />
    </div>
  );
}

export function InboxScreen({ projectId }) {
  const [messages, setMessages, loading] = useCreatorRows(listPaidMessages, projectId);
  const [members] = useCreatorRows(listMembers, projectId);
  const [assets] = useCreatorRows(listAssets, projectId);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startMemberId, setStartMemberId] = useState("");
  const endRef = useRef(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // One conversation per member with any 1:1 message; mass drops are excluded.
  const conversations = useMemo(() => {
    const byMember = new Map();
    for (const m of messages) {
      if (!m.memberId || m.status === "draft") continue;
      const list = byMember.get(m.memberId) || [];
      list.push(m);
      byMember.set(m.memberId, list);
    }
    if (openId && !byMember.has(openId)) byMember.set(openId, []);
    return [...byMember.entries()]
      .map(([memberId, list]) => {
        const sorted = [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        const last = sorted[sorted.length - 1];
        return {
          memberId,
          member: memberById.get(memberId),
          messages: sorted,
          last,
          unread: sorted.filter((m) => m.direction === "inbound" && !m.readAt).length,
        };
      })
      .sort((a, b) => String(b.last?.createdAt || "9").localeCompare(String(a.last?.createdAt || "9")));
  }, [messages, memberById, openId]);

  const visible = useMemo(() => {
    if (!search) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => [c.member?.fanName, c.member?.fanEmail].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [conversations, search]);

  const stats = useMemo(() => {
    const outbound = messages.filter((m) => m.memberId && m.direction !== "inbound" && m.priceCents > 0);
    const unlocked = outbound.filter((m) => m.status === "unlocked");
    return [
      { label: "Conversations", value: String(conversations.filter((c) => c.messages.length).length), footer: "1:1 with members" },
      { label: "Unread", value: String(conversations.reduce((s, c) => s + c.unread, 0)), footer: "fan replies waiting" },
      { label: "Locked DMs", value: String(outbound.length), footer: `${unlocked.length} unlocked` },
      { label: "DM revenue", value: formatMoney(unlocked.reduce((s, m) => s + m.priceCents, 0)), footer: "from 1:1 unlocks" },
    ];
  }, [messages, conversations]);

  const open = openId ? conversations.find((c) => c.memberId === openId) : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [openId, open?.messages.length]);

  const openThread = async (memberId) => {
    setOpenId(memberId);
    const unread = messages.filter((m) => m.memberId === memberId && m.direction === "inbound" && !m.readAt);
    if (!unread.length) return;
    const now = new Date().toISOString();
    setMessages((list) => list.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, readAt: now } : m)));
    await Promise.all(unread.map((m) => updatePaidMessage(m.id, { readAt: now })));
  };

  const send = async ({ body, priceCents, attachmentAssetId }) => {
    if (!open) return false;
    const user = await getUser();
    const now = new Date().toISOString();
    const input = {
      id: crypto.randomUUID(),
      projectId,
      memberId: open.memberId,
      body,
      priceCents,
      attachmentAssetId,
      direction: "outbound",
      status: priceCents ? "locked" : "unlocked",
      sentAt: now,
      createdBy: user?.id || null,
    };
    setMessages((list) => [...list, { ...input, currency: "usd", readAt: "", createdAt: now, updatedAt: now }]);
    const created = await createPaidMessage(input);
    if (!created) {
      setMessages((list) => list.filter((m) => m.id !== input.id));
      toast.error("Couldn't send the message");
      return false;
    }
    setMessages((list) => list.map((m) => (m.id === input.id ? created : m)));
    return true;
  };

  const startConversation = () => {
    if (!startMemberId) return toast.error("Pick a member");
    setStarting(false);
    openThread(startMemberId);
    setStartMemberId("");
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Inbox"
        description="1:1 chat with members — reply, or lock a message behind a price with an attachment."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setStarting(true)}>
            <SquarePen className="h-4 w-4" />
            New message
          </Button>
        }
      />
      <StatsBar stats={stats} />
      {loading ? (
        <LoadingArea panel className="h-96 py-0" />
      ) : (
        <div className="grid h-[70dvh] min-h-[28rem] overflow-hidden rounded-xl border border-border bg-surface-subtle lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className={cn("flex min-h-0 flex-col border-border lg:border-r", open && "hidden lg:flex")}>
            <div className="border-b border-border p-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search members..." />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {visible.length ? (
                visible.map((c) => (
                  <li key={c.memberId}>
                    <button
                      type="button"
                      onClick={() => openThread(c.memberId)}
                      className={cn("flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-hover", c.memberId === openId && "bg-surface-active")}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">
                        {initial(c.member)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", c.unread ? "font-semibold text-foreground" : "text-foreground")}>{c.member?.fanName || c.member?.fanEmail || "Member"}</span>
                          <span className="shrink-0 text-[11px] text-text-tertiary">{c.last ? clock(c.last.createdAt) : ""}</span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-text-secondary">
                            {c.last ? `${c.last.direction === "inbound" ? "" : "You: "}${c.last.body || "Attachment"}` : "No messages yet"}
                          </span>
                          {c.unread ? <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{c.unread}</span> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <EmptyState icon={MessagesSquare} title="No conversations" description={search ? "No member matches." : "When members message you, they show up here."} className="py-10" />
              )}
            </ul>
          </aside>

          <section className={cn("flex min-h-0 flex-col", !open && "hidden lg:flex")}>
            {open ? (
              <>
                <header className="flex items-center gap-3 border-b border-border px-3 py-2.5">
                  <Button variant="ghost" size="icon-sm" aria-label="Back to conversations" className="h-8 w-8 text-text-secondary hover:bg-surface-active lg:hidden" onClick={() => setOpenId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-card text-xs font-semibold text-foreground">{initial(open.member)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{open.member?.fanName || "Member"}</p>
                    <p className="truncate text-[11px] text-text-tertiary">{open.member?.fanEmail || ""}</p>
                  </div>
                </header>
                <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {open.messages.length ? (
                    open.messages.map((m) => {
                      const mine = m.direction !== "inbound";
                      return (
                        <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                          <div
                            className={cn(
                              "max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm sm:max-w-[70%]",
                              mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-surface-card text-foreground",
                            )}
                          >
                            {m.body ? <p className="whitespace-pre-line">{m.body}</p> : null}
                            {m.attachmentAssetId ? (
                              <AssetThumbnail asset={assets.find((a) => a.id === m.attachmentAssetId)} assetId={m.attachmentAssetId} className="h-32 w-48 rounded-lg" iconClassName="h-6 w-6" />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 px-1 text-[11px] text-text-tertiary">
                            <span>{clock(m.createdAt)}</span>
                            {mine && m.priceCents ? (
                              <>
                                <span>· {formatMoney(m.priceCents, m.currency)}</span>
                                <StatusPill status={m.status} map={MSG_STATUS_META} className="text-[9px]" />
                              </>
                            ) : null}
                            {mine && m.readAt ? <span>· seen</span> : null}
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li>
                      <EmptyState icon={MessagesSquare} title="Start the conversation" description="Say hi, or send something locked." className="py-10" />
                    </li>
                  )}
                  <li ref={endRef} aria-hidden />
                </ul>
                <Composer key={open.memberId} assets={assets} onSend={send} />
              </>
            ) : (
              <EmptyState icon={MessagesSquare} title="Pick a conversation" description="Replies from members land here." className="m-auto" />
            )}
          </section>
        </div>
      )}
      <CreateDialog open={starting} onOpenChange={setStarting} title="New message" description="Start a 1:1 conversation with a member." submitLabel="Open conversation" onSubmit={startConversation}>
        <SelectField
          label="Member"
          value={startMemberId}
          onChange={setStartMemberId}
          placeholder="Select member"
          options={members.filter((m) => m.status !== "blocked").map((m) => ({ value: m.id, label: m.fanName || m.fanEmail || m.id.slice(0, 8) }))}
        />
      </CreateDialog>
    </MainScreenWrapper>
  );
}

export default InboxScreen;
