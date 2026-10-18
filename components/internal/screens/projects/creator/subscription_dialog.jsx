"use client";

import React, { useMemo, useState } from "react";
import { CreateDialog, FieldRow, SelectField, TextField } from "./creator_kit";
import { addInterval, formatMoney, intervalLabel } from "./constants";

// A new subscription as the data layer wants it: trial tiers start "trialing"
// and roll into their first paid period when the trial ends; everyone else
// starts a paid period today.
export function buildSubscription({ projectId, memberId, tier, trialDays }) {
  const now = new Date();
  const days = Math.max(0, Number(trialDays) || 0);
  const trialEnd = days ? new Date(now.getTime() + days * 86400000).toISOString() : null;
  const start = trialEnd || now.toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    memberId,
    tierId: tier.id,
    status: trialEnd ? "trialing" : "active",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: trialEnd || addInterval(start, tier.interval),
    trialEnd,
    cancelAtPeriodEnd: false,
  };
}

function tierLabel(t) {
  const price = t.isFree || !t.priceCents ? "Free" : `${formatMoney(t.priceCents, t.currency)} / ${intervalLabel(t.interval)}`;
  return `${t.name} — ${price}`;
}

export function SubscriptionDialog({ open, onOpenChange, members, member, tiers, onSubmit }) {
  const [memberId, setMemberId] = useState("");
  const [tierId, setTierId] = useState("");
  const [trialDays, setTrialDays] = useState("0");

  const activeTiers = useMemo(() => tiers.filter((t) => t.isActive), [tiers]);

  React.useEffect(() => {
    if (!open) return;
    setMemberId(member?.id ?? "");
    setTierId("");
    setTrialDays("0");
  }, [open, member]);

  const pickTier = (id) => {
    setTierId(id);
    const tier = tiers.find((t) => t.id === id);
    setTrialDays(String(tier?.trialDays || 0));
  };

  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `Assign a tier to ${member.fanName || member.fanEmail || "member"}` : "New subscription"}
      description="Attach a member to a tier — the first period (or trial) starts today."
      submitLabel="Create subscription"
      onSubmit={() => onSubmit({ memberId, tierId, trialDays })}
    >
      {member ? null : (
        <SelectField
          label="Member"
          value={memberId}
          onChange={setMemberId}
          placeholder="Select member"
          options={(members || []).map((m) => ({ value: m.id, label: m.fanName || m.fanEmail || m.id.slice(0, 8) }))}
        />
      )}
      <FieldRow>
        <SelectField label="Tier" value={tierId} onChange={pickTier} placeholder="Select tier" options={activeTiers.map((t) => ({ value: t.id, label: tierLabel(t) }))} />
        <TextField
          label="Trial days"
          value={trialDays}
          onChange={(v) => setTrialDays(v.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder="0"
          hint="0 bills the first period today."
        />
      </FieldRow>
    </CreateDialog>
  );
}
