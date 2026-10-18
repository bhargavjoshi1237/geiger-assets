"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Ban, CalendarClock, CreditCard, HandCoins, KeyRound, Layers, Loader2, MessagesSquare, ReceiptText, ShieldCheck, User } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { EditorShell } from "@/components/internal/shared/editor_shell";
import { EditorSaveActions, useEditorGuard } from "@/components/internal/shared/unsaved_changes";
import { EmptyState, Field, SectionCard, SettingRow, SettingsList, StatusPill } from "@/components/internal/shared/screen_kit";
import {
  INVOICE_STATUS_META,
  MEMBER_STATUS_META,
  MSG_STATUS_META,
  SUB_STATUS_META,
  TIP_STATUS_META,
  formatDate,
  formatMoney,
} from "./constants";
import { SelectField } from "./creator_kit";
import { SubscriptionDialog, buildSubscription } from "./subscription_dialog";
import { createSubscription, updateMember, updateSubscription } from "@/lib/supabase/creator";
import { getUser } from "@/lib/supabase/user";

const NAV = [
  {
    group: null,
    items: [
      { key: "profile", label: "Profile", icon: User, desc: "Name, email, status and notes." },
      { key: "subscriptions", label: "Subscriptions", icon: CalendarClock, desc: "Tiers this member is on." },
      { key: "billing", label: "Billing", icon: ReceiptText, desc: "Renewal invoices and failed payments." },
      { key: "activity", label: "Activity", icon: Activity, desc: "Tips and paid messages." },
    ],
  },
  {
    group: "Account",
    items: [{ key: "account", label: "Access", icon: ShieldCheck, desc: "Suspend or reactivate." }],
  },
];

const STATUS_OPTIONS = Object.entries(MEMBER_STATUS_META).map(([value, m]) => ({ value, label: m.label }));
const LIVE = new Set(["active", "trialing", "past_due"]);

function draftOf(m) {
  return { fanName: m.fanName, fanEmail: m.fanEmail, status: m.status, notes: m.notes ?? "" };
}

function Row({ children }) {
  return <div className="flex items-center gap-3 py-3">{children}</div>;
}

export function MemberDetailScreen({ member, subscriptions, invoices, tips, messages, tiers, onBack, onChange, onSubscription }) {
  const [draft, setDraft] = useState(() => draftOf(member));
  const [saving, setSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [resetting, setResetting] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  const dirty = JSON.stringify(draftOf(member)) !== JSON.stringify(draft);

  const save = async () => {
    if (!dirty || saving) return false;
    if (!draft.fanName.trim() && !draft.fanEmail.trim()) {
      toast.error("Name or email is required");
      return false;
    }
    setSaving(true);
    const { notes, ...fields } = draft;
    const saved = await updateMember(member.id, { ...fields, fanEmail: fields.fanEmail.trim() || null, metadata: { notes } });
    setSaving(false);
    if (saved) {
      onChange(saved);
      setDraft(draftOf(saved));
      toast.success("Member saved");
      return true;
    }
    toast.error("Couldn't save — is that email already used by another member?");
    return false;
  };
  const discard = () => setDraft(draftOf(member));
  const guard = useEditorGuard({ dirty, saving, save, discard, onBack, name: member.fanName || member.fanEmail });

  const live = subscriptions.filter((s) => LIVE.has(s.status));
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const tipped = tips.filter((t) => t.status === "succeeded").reduce((s, t) => s + t.amountCents, 0);

  const assign = async ({ tierId, trialDays }) => {
    const tier = tierById.get(tierId);
    if (!tier) return toast.error("Pick a tier");
    if (live.some((s) => s.tierId === tierId)) return toast.error("Already subscribed to this tier");
    setShowAssign(false);
    const user = await getUser();
    const input = { ...buildSubscription({ projectId: member.projectId, memberId: member.id, tier, trialDays }), createdBy: user?.id || null };
    const created = await createSubscription(input);
    if (created) {
      onSubscription(created);
      toast.success(`Assigned to ${tier.name}`);
    } else toast.error("Couldn't assign the tier");
  };

  const cancel = async (sub) => {
    const saved = await updateSubscription(sub.id, { cancelAtPeriodEnd: true });
    if (saved) {
      onSubscription(saved);
      toast.success("Will cancel at period end");
    } else toast.error("Couldn't cancel the subscription");
  };

  // No email sending yet: staff copy a one-time link and pass it to the fan.
  const copyResetLink = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/fans/reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't create the link");
      await navigator.clipboard.writeText(data.url);
      toast.success("Reset link copied — valid for 24 hours, works once");
    } catch (err) {
      toast.error(err.message || "Couldn't create the link");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <EditorShell
        back={{ label: "Members", onClick: guard.back }}
        title={member.fanName || member.fanEmail || "Member"}
        status={member.status}
        statusMap={MEMBER_STATUS_META}
        meta={`${member.fanEmail || "no email"} · ${formatMoney(member.totalSpentCents)} lifetime · joined ${formatDate(member.createdAt)}`}
        actions={
          <EditorSaveActions dirty={dirty} saving={saving} onSave={save} onDiscard={discard}>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setShowAssign(true)}
            >
              <Layers className="h-4 w-4" />
              Assign tier
            </Button>
          </EditorSaveActions>
        }
        nav={NAV}
        subject={member}
        active={guard.active}
        onActiveChange={guard.selectSection}
      >
        {({ active }) => (
          <>
            {active === "profile" ? (
              <div className="space-y-8">
                <SectionCard bare title="Profile">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Display name">
                      <Input value={draft.fanName} onChange={(e) => set("fanName")(e.target.value)} className="bg-surface-card" />
                    </Field>
                    <Field label="Email">
                      <Input type="email" value={draft.fanEmail} onChange={(e) => set("fanEmail")(e.target.value)} className="bg-surface-card" />
                    </Field>
                    <SelectField label="Status" value={draft.status} onChange={set("status")} options={STATUS_OPTIONS} hint="Billing moves this automatically; override it here." />
                    <Field label="Last seen">
                      <Input value={formatDate(member.lastSeenAt)} readOnly disabled className="bg-surface-card" />
                    </Field>
                  </div>
                </SectionCard>
                <SectionCard bare title="Notes" description="Private to the team.">
                  <Textarea value={draft.notes} onChange={(e) => set("notes")(e.target.value)} rows={4} className="bg-surface-card" placeholder="Preferences, custom requests, context…" />
                </SectionCard>
              </div>
            ) : null}

            {active === "subscriptions" ? (
              <SectionCard bare title="Subscriptions" description={`${live.length} live · ${subscriptions.length} all-time`} bodyPadding={false}>
                {subscriptions.length ? (
                  <div className="divide-y divide-border">
                    {subscriptions.map((s) => {
                      const tier = tierById.get(s.tierId);
                      return (
                        <Row key={s.id}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{tier?.name || "Deleted tier"}</p>
                            <p className="truncate text-[11px] text-text-tertiary">
                              Since {formatDate(s.createdAt)}
                              {LIVE.has(s.status) ? ` · ${s.cancelAtPeriodEnd ? "ends" : "renews"} ${formatDate(s.currentPeriodEnd)}` : ""}
                            </p>
                          </div>
                          <StatusPill status={s.status} map={SUB_STATUS_META} className="text-[10px]" />
                          {LIVE.has(s.status) && !s.cancelAtPeriodEnd ? (
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => cancel(s)}>
                              Cancel
                            </Button>
                          ) : null}
                        </Row>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={CalendarClock}
                    title="No subscriptions"
                    description="Assign a tier to start their first period or trial."
                    action={
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowAssign(true)}>
                        <Layers className="h-4 w-4" />
                        Assign tier
                      </Button>
                    }
                  />
                )}
              </SectionCard>
            ) : null}

            {active === "billing" ? (
              <SectionCard
                bare
                title="Invoices"
                description={`${paidInvoices.length} paid · ${formatMoney(paidInvoices.reduce((s, i) => s + i.amountCents, 0))} collected`}
                bodyPadding={false}
              >
                {invoices.length ? (
                  <div className="divide-y divide-border">
                    {invoices.map((i) => (
                      <Row key={i.id}>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm text-foreground">{i.number || i.id.slice(0, 8)}</p>
                          <p className="truncate text-[11px] text-text-tertiary">
                            {tierById.get(i.tierId)?.name || "Subscription"} · due {formatDate(i.dueAt)}
                            {i.status === "failed" && i.nextRetryAt ? ` · retry ${formatDate(i.nextRetryAt)}` : ""}
                          </p>
                        </div>
                        <StatusPill status={i.status} map={INVOICE_STATUS_META} className="text-[10px]" />
                        <span className="w-20 text-right text-sm tabular-nums text-foreground">{formatMoney(i.amountCents, i.currency)}</span>
                      </Row>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={CreditCard} title="No invoices" description="Renewal invoices from Recurring Billing show here." />
                )}
              </SectionCard>
            ) : null}

            {active === "activity" ? (
              <div className="space-y-8">
                <SectionCard bare title="Tips" description={`${formatMoney(tipped)} tipped`} bodyPadding={false}>
                  {tips.length ? (
                    <div className="divide-y divide-border">
                      {tips.map((t) => (
                        <Row key={t.id}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm capitalize text-foreground">On {t.targetType}</p>
                            <p className="truncate text-[11px] text-text-tertiary">
                              {formatDate(t.createdAt)}
                              {t.note ? ` · “${t.note}”` : ""}
                            </p>
                          </div>
                          <StatusPill status={t.status} map={TIP_STATUS_META} className="text-[10px]" />
                          <span className="w-20 text-right text-sm tabular-nums text-foreground">{formatMoney(t.amountCents, t.currency)}</span>
                        </Row>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={HandCoins} title="No tips yet" description="Tips on posts, messages and streams show here." />
                  )}
                </SectionCard>
                <SectionCard bare title="Paid messages" bodyPadding={false}>
                  {messages.length ? (
                    <div className="divide-y divide-border">
                      {messages.map((m) => (
                        <Row key={m.id}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{m.body || "Untitled message"}</p>
                            <p className="truncate text-[11px] text-text-tertiary">{formatDate(m.sentAt || m.createdAt)}</p>
                          </div>
                          <StatusPill status={m.status} map={MSG_STATUS_META} className="text-[10px]" />
                          <span className="w-20 text-right text-sm tabular-nums text-foreground">{m.priceCents ? formatMoney(m.priceCents, m.currency) : "Free"}</span>
                        </Row>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={MessagesSquare} title="No paid messages" description="1:1 locked messages to this member show here." />
                  )}
                </SectionCard>
              </div>
            ) : null}

            {active === "account" ? (
              <SectionCard bare title="Access">
                <SettingsList>
                  <SettingRow
                    icon={Ban}
                    title="Suspend this member"
                    description="Blocks sign-in to gated galleries and pauses messaging. Subscriptions stay on file — cancel them separately."
                    checked={draft.status === "blocked"}
                    onCheckedChange={(on) => set("status")(on ? "blocked" : "active")}
                  />
                  <SettingRow
                    icon={KeyRound}
                    title="Password reset link"
                    description={
                      member.fanAccountId
                        ? "Copy a one-time link (24h) that lets them set a new password for their fan account."
                        : "They haven't created a fan account on your page yet."
                    }
                    control={
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        disabled={!member.fanAccountId || resetting}
                        onClick={copyResetLink}
                      >
                        {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Copy link
                      </Button>
                    }
                  />
                </SettingsList>
              </SectionCard>
            ) : null}
          </>
        )}
      </EditorShell>

      <SubscriptionDialog open={showAssign} onOpenChange={setShowAssign} member={member} tiers={tiers} onSubmit={assign} />
      {guard.dialog}
    </>
  );
}

export default MemberDetailScreen;
