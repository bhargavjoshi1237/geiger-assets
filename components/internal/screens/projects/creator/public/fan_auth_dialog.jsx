"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { accentStyle, postJson } from "./public_kit";

const MODES = [
  { value: "signup", label: "Create account" },
  { value: "login", label: "Sign in" },
];

/**
 * Fan sign-in / sign-up. One fan account works on every creator page;
 * `onSignedIn` runs after the session cookie is set.
 */
export function FanAuthDialog({ open, onOpenChange, creatorName, accent, reason, title, onSignedIn }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await postJson("/api/fans/auth", { action: mode, email, password, displayName });
    setBusy(false);
    if (result.error) return setError(result.error);
    setPassword("");
    onSignedIn?.(result.fan);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title || (mode === "signup" ? `Join ${creatorName}` : "Welcome back")}</DialogTitle>
          <DialogDescription>{reason || "One fan account works across every creator page."}</DialogDescription>
        </DialogHeader>
        <SegmentedTabs tabs={MODES} value={mode} onChange={(v) => { setMode(v); setError(""); }} fullWidth />
        <form onSubmit={submit} className="grid gap-4">
          {mode === "signup" ? (
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What the creator sees" autoComplete="nickname" />
            </Field>
          ) : null}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </Field>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button
            type="submit"
            disabled={busy}
            className={accent ? "h-10 hover:opacity-90" : "h-10 bg-primary text-primary-foreground hover:bg-primary/90"}
            style={accent ? accentStyle(accent) : undefined}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
