"use client";

// The fan's chat with one creator, in a drawer over their page: 1:1 DMs, mass
// drops and the fan's own replies, oldest first. Locked messages show their
// copy and a blurred attachment until unlocked at checkout. The thread is
// fetched each time the drawer opens, which also marks it read.

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HandCoins, Loader2, Megaphone, MessagesSquare, Send } from "lucide-react";
import { LogoLoading } from "@geiger/ui";
import { Button } from "@geiger/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@geiger/ui/drawer";
import { Textarea } from "@geiger/ui/textarea";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { MediaBlock } from "./post_card";
import { accentStyle, formatMoney, postJson, timeAgo } from "./public_kit";

function Bubble({ message, profile, busy, onUnlock, onTip }) {
  const accent = accentStyle(profile.accentColor);
  const mine = message.fromFan;
  return (
    <li className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm",
          mine ? "rounded-br-md" : "rounded-bl-md border border-border bg-surface-card text-foreground",
        )}
        style={mine ? accent : undefined}
      >
        {message.isBroadcast ? (
          <p className="flex items-center gap-1 text-[11px] text-text-tertiary">
            <Megaphone className="h-3 w-3" />
            To all members
          </p>
        ) : null}
        {message.body ? <p className="whitespace-pre-line">{message.body}</p> : null}
        {message.media || message.locked ? (
          <MediaBlock media={message.media} locked={message.locked} className="min-w-[14rem]">
            {message.expired ? (
              <p className="text-sm font-medium">This offer has expired</p>
            ) : (
              <Button size="sm" className="hover:opacity-90" style={accent} disabled={busy === `unlock:${message.id}`} onClick={() => onUnlock(message)}>
                {busy === `unlock:${message.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Unlock for {formatMoney(message.priceCents, message.currency)}
              </Button>
            )}
          </MediaBlock>
        ) : null}
      </div>
      <div className="flex items-center gap-2 px-1 text-[11px] text-text-tertiary">
        <span>{timeAgo(message.sentAt)}</span>
        {!mine && message.priceCents && !message.locked ? <span>· unlocked</span> : null}
        {!mine && profile.tipsEnabled ? (
          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onTip(message)}>
            <HandCoins className="h-3 w-3" />
            Tip
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * `actions` is the page's useFanActions (sign-in, checkout, engage); `onTip`
 * opens the page's tip dialog and `onMembership` sends a non-member to the
 * membership tab.
 */
export function FanInboxDrawer({ open, onOpenChange, creator, viewer, actions, onTip, onMembership }) {
  const { profile } = creator;
  const accent = accentStyle(profile.accentColor);
  const memberId = viewer.member?.id || null;
  const canWrite = Boolean(memberId) && !viewer.blocked;
  // Keyed by member so signing in (or switching accounts) loads their thread.
  const [inbox, setInbox] = useState({ memberId: null, messages: [] });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  // The builder preview's stand-in fan has no thread to fetch.
  const loading = open && Boolean(memberId) && !actions.preview && inbox.memberId !== memberId;
  const messages = inbox.memberId === memberId ? inbox.messages : [];

  useEffect(() => {
    if (!open || !memberId || actions.preview) return undefined;
    let alive = true;
    postJson(`/api/creator/${encodeURIComponent(profile.handle)}`, { action: "inbox" }).then((result) => {
      if (!alive) return;
      if (result.error) toast.error(result.error);
      setInbox({ memberId, messages: result.messages || [] });
    });
    return () => {
      alive = false;
    };
  }, [open, memberId, profile.handle, actions.preview]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const result = await actions.engage("message", { body: text });
    setSending(false);
    if (result?.message) {
      setInbox((current) => ({ ...current, messages: [...current.messages, result.message] }));
      setText("");
    }
  };

  let body;
  if (!viewer.fan) {
    body = (
      <EmptyState
        icon={MessagesSquare}
        title="Sign in to see your messages"
        description={`Messages from ${profile.displayName} land here once you're a member.`}
        action={
          <Button className="hover:opacity-90" style={accent} onClick={actions.signIn}>
            Sign in
          </Button>
        }
      />
    );
  } else if (!memberId) {
    body = (
      <EmptyState
        icon={MessagesSquare}
        title="Join to start chatting"
        description={`${profile.displayName} messages their members directly.`}
        action={
          <Button className="hover:opacity-90" style={accent} onClick={onMembership}>
            See membership
          </Button>
        }
      />
    );
  } else if (loading) {
    body = (
      <div className="flex h-full items-center justify-center py-16">
        <LogoLoading size={40} />
      </div>
    );
  } else if (!messages.length) {
    body = <EmptyState icon={MessagesSquare} title="No messages yet" description={profile.welcomeMessage || `Say hi to ${profile.displayName} below.`} />;
  } else {
    body = (
      <ul className="space-y-4 p-4">
        {messages.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            profile={profile}
            busy={actions.busy}
            onUnlock={(msg) => actions.checkout(`unlock:${msg.id}`, { kind: "message_unlock", targetId: msg.id })}
            onTip={(msg) => onTip({ type: "message", id: msg.id, label: msg.body.slice(0, 40) })}
          />
        ))}
        <li ref={endRef} aria-hidden />
      </ul>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="border-border data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-md">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle>Messages</DrawerTitle>
          <DrawerDescription className="text-text-secondary">Your chat with {profile.displayName}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
        {canWrite ? (
          <div className="flex items-end gap-2 border-t border-border p-3">
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
              placeholder={`Message ${profile.displayName}…`}
              className="max-h-32 min-h-10 resize-none bg-surface-card"
            />
            <Button size="icon" aria-label="Send message" className="h-10 w-10 shrink-0 hover:opacity-90" style={accent} disabled={sending || !text.trim()} onClick={send}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export default FanInboxDrawer;
