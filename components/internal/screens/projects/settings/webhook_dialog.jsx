"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Field } from "@/components/internal/shared/screen_kit";
import { WEBHOOK_EVENT_OPTIONS } from "./constants";

// Create / edit an outbound webhook endpoint.
//
// Delivery stays server-side (lib/media/webhooks.js signs and POSTs a
// `{ id, event, projectId, createdAt, data }` envelope with a
// Stripe-style `webhook-signature` header). This form only collects the URL,
// the subscribed events, and the active flag; the screen persists through
// lib/supabase/settings.js, which reaches the server code over
// /api/webhooks/endpoints.

// The caller remounts this on every open (a key carrying the target id), so
// state seeds from props once and a half-typed URL never survives reopening.
export function WebhookDialog({ open, onOpenChange, endpoint, onSubmit }) {
  const editing = Boolean(endpoint);
  const [url, setUrl] = useState(endpoint?.url || "");
  const [events, setEvents] = useState(endpoint?.events || []);
  const [active, setActive] = useState(endpoint?.active ?? true);
  const [busy, setBusy] = useState(false);

  const toggleEvent = (value) =>
    setEvents((prev) => (prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]));

  const submit = async () => {
    if (busy) return;
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Give the endpoint a URL.");
      return;
    }
    let parsed = null;
    try {
      parsed = new URL(trimmed);
    } catch {
      parsed = null;
    }
    // Matches the server SSRF guard's headline rule: https only.
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      toast.error("That URL isn't valid — use an https:// address.");
      return;
    }
    if (events.length === 0) {
      toast.error("Subscribe to at least one event.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({ url: trimmed, events, active });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit endpoint" : "Add endpoint"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update where this subscriber lives and which events it receives."
              : "Deliveries are signed with the endpoint secret so the receiver can verify them."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Endpoint URL" htmlFor="webhook-url" hint="https only — plain http never leaves development.">
            <Input
              id="webhook-url"
              className="bg-surface-card"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/assets"
              autoFocus
            />
          </Field>
          <Field label="Subscribed events" hint="The endpoint only receives the events it subscribes to.">
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENT_OPTIONS.map((option) => {
                const on = events.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleEvent(option.value)}
                    aria-pressed={on}
                  >
                    <Badge variant={on ? "success" : "outline"} className="cursor-pointer">
                      {option.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Enabled" hint="A paused endpoint keeps its subscriptions but receives nothing.">
            <div className="flex h-9 items-center">
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : editing ? (
              "Save changes"
            ) : (
              "Add endpoint"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WebhookDialog;
