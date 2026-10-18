"use client";

// The builder's Profile tab (who you are: handle, name, pitch, images, links)
// and Settings tab (going live, tips & inbox, SEO, footer, promo links).

import React from "react";
import { Globe, HandCoins, MessagesSquare, Plus, Tag, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Field, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { TextAreaField, TextField } from "@/components/internal/shared/module_kit";
import { CopyButton } from "@/components/internal/screens/projects/settings/general_settings";
import { AssetSlot, PanelGroup } from "./builder_fields";

export function ProfilePanel({ draft, set, ctx }) {
  const updateLink = (index, key, value) => set("links")(draft.links.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  return (
    <div>
      <PanelGroup title="Identity">
        <Field label="Handle" hint="Your page lives at /c/handle.">
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface-card pl-3 focus-within:border-border-strong">
            <span className="text-sm text-text-tertiary">/c/</span>
            <Input
              value={draft.handle}
              onChange={(e) => set("handle")(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32))}
              className="border-0 bg-transparent px-0 focus-visible:ring-0"
            />
          </div>
        </Field>
        <TextField label="Display name" value={draft.displayName} onChange={set("displayName")} />
        <TextField label="Tagline" hint="One line under your name." value={draft.tagline} onChange={(v) => set("tagline")(v.slice(0, 140))} placeholder="Photographer · weekly behind-the-scenes drops" />
        <TextAreaField label="About" value={draft.bio} onChange={set("bio")} rows={5} placeholder="Tell fans what they get for joining." />
      </PanelGroup>

      <PanelGroup title="Images">
        <AssetSlot
          label="Avatar"
          round
          asset={ctx.assetById.get(draft.avatarAssetId)}
          onPick={() => ctx.pickAsset({ kinds: ["image"], title: "Choose avatar", onPick: (a) => set("avatarAssetId")(a.id) })}
          onClear={() => set("avatarAssetId")(null)}
        />
        <AssetSlot
          label="Banner"
          hint="Wide images work best (3:1). The Split header shows it as a portrait."
          wide
          asset={ctx.assetById.get(draft.bannerAssetId)}
          onPick={() => ctx.pickAsset({ kinds: ["image"], title: "Choose banner", onPick: (a) => set("bannerAssetId")(a.id) })}
          onClear={() => set("bannerAssetId")(null)}
        />
      </PanelGroup>

      <PanelGroup
        title="Links"
        description="Shown on About, in the Links section and — if you turn it on — under your name."
        action={
          <Button variant="ghost" size="sm" className="h-7 text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => set("links")([...draft.links, { label: "", url: "" }])}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
      >
        {draft.links.length ? (
          <div className="grid gap-2">
            {draft.links.map((link, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-1.5">
                <Input value={link.label} onChange={(e) => updateLink(index, "label", e.target.value)} placeholder="Label" className="h-9 bg-surface-card" />
                <Input value={link.url} onChange={(e) => updateLink(index, "url", e.target.value)} placeholder="https://" className="h-9 bg-surface-card" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove link"
                  className="h-9 w-9 text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={() => set("links")(draft.links.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">No links yet.</p>
        )}
      </PanelGroup>
    </div>
  );
}

export function SettingsPanel({ draft, set, page, onPageChange, publicUrl, published }) {
  const setSeo = (patch) => onPageChange({ ...page, seo: { ...page.seo, ...patch } });
  const setFooter = (patch) => onPageChange({ ...page, footer: { ...page.footer, ...patch } });
  return (
    <div>
      <PanelGroup title="Visibility">
        <SettingsList>
          <SettingRow
            icon={Globe}
            title="Page is live"
            description={draft.isPublished ? "Anyone with the link can see your page." : "Only your team can see it — fans get a 404 until you publish."}
            checked={draft.isPublished}
            onCheckedChange={set("isPublished")}
          />
        </SettingsList>
        {publicUrl ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-card px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary">{publicUrl}</span>
            <CopyButton value={publicUrl} label="Copy page link" />
          </div>
        ) : null}
        {!published ? <p className="text-xs text-text-tertiary">Publishing turns this on for you.</p> : null}
      </PanelGroup>

      <PanelGroup title="Tips & messages">
        <SettingsList>
          <SettingRow icon={HandCoins} title="Accept tips" description="Fans can tip on your profile, posts and messages." checked={draft.tipsEnabled} onCheckedChange={set("tipsEnabled")} />
          <SettingRow icon={MessagesSquare} title="Fan inbox" description="Members get a Messages page for your DMs and mass drops." checked={draft.messagesEnabled} onCheckedChange={set("messagesEnabled")} />
        </SettingsList>
        {draft.tipsEnabled ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Minimum tip" prefix="$" value={draft.minTip} onChange={set("minTip")} inputMode="decimal" />
            <TextField label="Suggested tips" hint="Up to four, comma separated." value={draft.suggestedTips} onChange={set("suggestedTips")} placeholder="3, 5, 10, 25" />
          </div>
        ) : null}
        {draft.messagesEnabled ? (
          <TextAreaField label="Empty inbox message" hint="What members see before you've messaged them." value={draft.welcomeMessage} onChange={set("welcomeMessage")} rows={2} />
        ) : null}
      </PanelGroup>

      <PanelGroup title="Search & sharing" description="How your page shows up in search results and link previews.">
        <TextField label="Page title" value={page.seo.title} onChange={(v) => setSeo({ title: v.slice(0, 70) })} placeholder={`${draft.displayName || "Your name"} (@${draft.handle})`} />
        <TextAreaField label="Description" value={page.seo.description} onChange={(v) => setSeo({ description: v.slice(0, 200) })} rows={2} placeholder="Defaults to your tagline." />
      </PanelGroup>

      <PanelGroup title="Footer">
        <TextAreaField label="Footer text" value={page.footer.text} onChange={(v) => setFooter({ text: v.slice(0, 280) })} rows={2} placeholder="Terms, contact, a sign-off…" />
        <SettingsList>
          <SettingRow title="Show “Powered by Geiger”" checked={page.footer.showBranding} onCheckedChange={(v) => setFooter({ showBranding: v })} />
        </SettingsList>
      </PanelGroup>

      <PanelGroup title="Promo links" description="Share a link that applies a code on arrival.">
        <div className="flex items-start gap-2 rounded-md border border-border bg-surface-card px-3 py-2">
          <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <p className="min-w-0 break-all font-mono text-xs text-text-secondary">{publicUrl || `/c/${draft.handle}`}?promo=YOURCODE</p>
        </div>
        <p className="text-xs text-text-tertiary">Codes come from Promos. Trial and free-month codes start without a card; discounts apply at checkout.</p>
      </PanelGroup>
    </div>
  );
}
