"use client";

import React, { useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { accentStyle, formatMoney } from "./public_kit";

/** Pick or type an amount, add a note, then hand off to checkout via `onSubmit`. */
export function TipDialog({ open, onOpenChange, profile, target, onSubmit }) {
  const suggested = profile.suggestedTips.length ? profile.suggestedTips : [300, 500, 1000, 2500];
  const [amount, setAmount] = useState(String((target?.amountCents || suggested[1] || suggested[0]) / 100));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cents = Math.round((Number(String(amount).replace(/[^0-9.]/g, "")) || 0) * 100);
  const tooLow = cents < profile.minTipCents;

  const submit = async () => {
    if (tooLow) return;
    setBusy(true);
    await onSubmit({ amountCents: cents, note, targetType: target?.type || "profile", targetId: target?.id || null });
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send {profile.displayName} a tip</DialogTitle>
          <DialogDescription>{target?.label ? `For “${target.label}”.` : "A thank-you on top of your membership."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-2">
            {suggested.slice(0, 4).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value / 100))}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors",
                  cents === value ? "border-transparent" : "border-border bg-surface-card text-foreground hover:bg-surface-hover",
                )}
                style={cents === value ? accentStyle(profile.accentColor) : undefined}
              >
                {formatMoney(value)}
              </button>
            ))}
          </div>
          <Field label="Amount (USD)" hint={`Minimum ${formatMoney(profile.minTipCents)}.`}>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface-card pl-3 focus-within:border-border-strong">
              <span className="text-sm text-text-tertiary">$</span>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="border-0 bg-transparent px-0 focus-visible:ring-0" />
            </div>
          </Field>
          <Field label="Note (optional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} rows={2} placeholder="Say something nice…" className="resize-none bg-surface-card" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="text-muted-foreground hover:bg-surface-active" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={tooLow || busy} onClick={submit} className="hover:opacity-90" style={accentStyle(profile.accentColor)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
            Tip {tooLow ? "" : formatMoney(cents)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
