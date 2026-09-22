"use client";

import React, { useState } from "react";
import { Lock } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";

/**
 * Password gate for a protected gallery. The value is POSTed to the unlock
 * route, which compares it server-side and sets an httpOnly cookie — the page's
 * contents are never sent to the browser until that cookie exists.
 */
export function GalleryPasswordForm({ slug, name }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/g/${slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // The cookie is set; a reload re-runs the server-side access check.
        window.location.reload();
        return;
      }
      setError(res.status === 401 ? "That password didn't work." : "Something went wrong.");
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-border bg-surface-subtle p-6"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-card">
          <Lock className="h-4 w-4 text-text-secondary" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{name || "Protected gallery"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This gallery is password protected. Enter it to continue.
        </p>

        <label htmlFor="gallery-password" className="sr-only">
          Password
        </label>
        <Input
          id="gallery-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="mt-4 bg-surface-card"
        />
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

        <Button
          type="submit"
          className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={busy || !password}
        >
          {busy ? "Checking…" : "Open gallery"}
        </Button>
      </form>
    </div>
  );
}

export default GalleryPasswordForm;
