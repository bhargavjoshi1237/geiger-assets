"use client";

// The builder's Design tab: theme (presets, colours, type, shape, backdrop),
// motion & effects, header layout and look, navigation and the join button.

import React from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { SelectField, TextField } from "@/components/internal/shared/module_kit";
import {
  ANIMATIONS,
  BACKDROP_OPTIONS,
  BUTTON_STYLES,
  CARD_HOVERS,
  CARD_STYLES,
  EFFECTS,
  FONTS,
  HEADER_LAYOUTS,
  MEDIA_EFFECTS,
  NAV_STYLES,
  OVERLAY_OPTIONS,
  PAGE_TABS,
  RADIUS_OPTIONS,
  THEME_PRESETS,
  WIDTH_OPTIONS,
  presetTheme,
} from "@/lib/creator/page_config";
import { cn } from "@/lib/utils";
import { AssetSlot, ChoiceField, ColorField, PanelGroup } from "./builder_fields";

const FONT_OPTIONS = Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label }));

const COLOR_FIELDS = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Cards" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted text" },
  { key: "border", label: "Borders" },
  { key: "accent", label: "Accent" },
];

/** A tiny drawing of each header layout so the choice reads at a glance. */
function LayoutThumb({ layout }) {
  const bar = "rounded-sm bg-text-tertiary/40";
  return (
    <div className="relative h-14 w-full overflow-hidden rounded-md border border-border bg-surface-subtle">
      {layout === "banner" ? (
        <>
          <div className="h-6 bg-surface-strong" />
          <div className="absolute left-2 top-4 h-5 w-5 rounded-full border-2 border-surface-subtle bg-primary/70" />
          <div className={cn(bar, "absolute left-8 top-8 h-1.5 w-10")} />
        </>
      ) : layout === "centered" ? (
        <>
          <div className="h-6 bg-surface-strong" />
          <div className="absolute left-1/2 top-3.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-surface-subtle bg-primary/70" />
          <div className={cn(bar, "absolute left-1/2 top-10 h-1.5 w-12 -translate-x-1/2")} />
        </>
      ) : layout === "hero" ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-surface-subtle to-surface-strong" />
          <div className={cn(bar, "absolute bottom-4 left-2 h-2.5 w-16 bg-foreground/50")} />
          <div className={cn(bar, "absolute bottom-2 left-2 h-1 w-10")} />
        </>
      ) : layout === "split" ? (
        <>
          <div className={cn(bar, "absolute left-2 top-4 h-2.5 w-12 bg-foreground/50")} />
          <div className={cn(bar, "absolute left-2 top-8 h-1 w-9")} />
          <div className="absolute bottom-1.5 right-2 top-1.5 w-8 rounded-sm bg-surface-strong" />
        </>
      ) : (
        <>
          <div className="absolute left-2 top-4 h-5 w-5 rounded-full bg-primary/70" />
          <div className={cn(bar, "absolute left-9 top-5 h-1.5 w-14 bg-foreground/50")} />
          <div className={cn(bar, "absolute left-9 top-8 h-1 w-9")} />
        </>
      )}
    </div>
  );
}

export function DesignPanel({ page, onChange, ctx }) {
  const { theme, header, nav, cta } = page;
  const setTheme = (patch) => onChange({ ...page, theme: { ...theme, ...patch } });
  const setColor = (key) => (value) => setTheme({ [key]: value, preset: "custom" });
  const setHeader = (patch) => onChange({ ...page, header: { ...header, ...patch } });
  const setNav = (patch) => onChange({ ...page, nav: { ...nav, ...patch } });
  const setCta = (patch) => onChange({ ...page, cta: { ...cta, ...patch } });
  const updateLink = (i, key, value) => setNav({ links: nav.links.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)) });

  return (
    <div>
      <PanelGroup title="Theme" description="A starting palette — every colour stays editable below.">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => {
            const active = theme.preset === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme({ ...presetTheme(key) })}
                className={cn(
                  "group relative overflow-hidden rounded-lg border p-2 text-left transition-colors",
                  active ? "border-primary" : "border-border hover:border-border-strong",
                )}
                style={{ backgroundColor: preset.background }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-6 flex-1 rounded" style={{ backgroundColor: preset.surface, border: `1px solid ${preset.border}` }} />
                  <span className="h-6 w-6 rounded-full" style={{ backgroundColor: preset.accent }} />
                </div>
                <p className="mt-1.5 text-xs font-medium" style={{ color: preset.text }}>
                  {preset.label}
                </p>
                {active ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </PanelGroup>

      <PanelGroup title="Colours">
        <div className="grid grid-cols-2 gap-3">
          {COLOR_FIELDS.map((f) => (
            <ColorField key={f.key} label={f.label} value={theme[f.key]} onChange={setColor(f.key)} />
          ))}
        </div>
      </PanelGroup>

      <PanelGroup title="Typography">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Headings" value={theme.fontHeading} onChange={(v) => setTheme({ fontHeading: v })} options={FONT_OPTIONS} />
          <SelectField label="Body" value={theme.fontBody} onChange={(v) => setTheme({ fontBody: v })} options={FONT_OPTIONS} />
        </div>
      </PanelGroup>

      <PanelGroup title="Shape & layout">
        <ChoiceField label="Corners" value={theme.radius} onChange={(v) => setTheme({ radius: v })} options={RADIUS_OPTIONS} />
        <ChoiceField label="Cards" value={theme.card} onChange={(v) => setTheme({ card: v })} options={CARD_STYLES} />
        <ChoiceField label="Page width" value={theme.width} onChange={(v) => setTheme({ width: v })} options={WIDTH_OPTIONS} />
        <SelectField label="Backdrop" value={theme.backdrop} onChange={(v) => setTheme({ backdrop: v })} options={BACKDROP_OPTIONS} />
        {theme.backdrop === "image" ? (
          <AssetSlot
            label="Backdrop image"
            wide
            asset={ctx.assetById.get(theme.backdropAssetId)}
            onPick={() => ctx.pickAsset({ kinds: ["image"], title: "Choose a backdrop", onPick: (a) => setTheme({ backdropAssetId: a.id }) })}
            onClear={() => setTheme({ backdropAssetId: null })}
          />
        ) : null}
      </PanelGroup>

      <PanelGroup title="Motion & effects" description="Page-wide defaults — each section can override its entrance.">
        <SelectField label="Section entrance" value={theme.sectionAnimation} onChange={(v) => setTheme({ sectionAnimation: v })} options={ANIMATIONS} hint="Plays as sections scroll into view." />
        <ChoiceField label="Card hover" value={theme.cardHover} onChange={(v) => setTheme({ cardHover: v })} options={CARD_HOVERS} />
        <ChoiceField label="Buttons" value={theme.buttonStyle} onChange={(v) => setTheme({ buttonStyle: v })} options={BUTTON_STYLES} />
      </PanelGroup>

      <PanelGroup title="Header">
        <div className="grid grid-cols-3 gap-2">
          {HEADER_LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={header.layout === l.value}
              title={l.description}
              onClick={() => setHeader({ layout: l.value })}
              className={cn(
                "space-y-1.5 rounded-lg border p-1.5 text-left transition-colors",
                header.layout === l.value ? "border-primary bg-surface-card" : "border-border hover:border-border-strong",
              )}
            >
              <LayoutThumb layout={l.value} />
              <p className="px-0.5 text-xs font-medium text-foreground">{l.label}</p>
            </button>
          ))}
        </div>
        {header.layout !== "minimal" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Image effect" value={header.mediaEffect} onChange={(v) => setHeader({ mediaEffect: v })} options={MEDIA_EFFECTS} />
              <SelectField label="Overlay effect" value={header.effect} onChange={(v) => setHeader({ effect: v })} options={EFFECTS} />
            </div>
            {header.layout !== "split" ? <ChoiceField label="Dim" value={header.overlay} onChange={(v) => setHeader({ overlay: v })} options={OVERLAY_OPTIONS} /> : null}
          </>
        ) : null}
        <SettingsList>
          <SettingRow title="Entrance animation" description="Name, links and buttons glide in on load." checked={header.animate} onCheckedChange={(v) => setHeader({ animate: v })} />
          <SettingRow title="Show stats" description="Post, member and follower counts." checked={header.showStats} onCheckedChange={(v) => setHeader({ showStats: v })} />
          <SettingRow title="Show links" description="Your profile links as chips under your name." checked={header.showSocials} onCheckedChange={(v) => setHeader({ showSocials: v })} />
        </SettingsList>
      </PanelGroup>

      <PanelGroup title="Navigation">
        <ChoiceField label="Tab style" value={nav.style} onChange={(v) => setNav({ style: v })} options={NAV_STYLES} />
        <SettingsList>
          <SettingRow title="Sticky tabs" description="Tabs stay pinned while fans scroll." checked={nav.sticky} onCheckedChange={(v) => setNav({ sticky: v })} />
          {PAGE_TABS.filter((t) => !t.locked).map((t) => (
            <SettingRow
              key={t.value}
              title={`${t.label} tab`}
              description={t.value === "shop" ? "Only shows when you have bundles." : undefined}
              checked={nav.tabs[t.value] !== false}
              onCheckedChange={(v) => setNav({ tabs: { ...nav.tabs, [t.value]: v } })}
            />
          ))}
        </SettingsList>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">Extra links in the tab bar</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
              disabled={nav.links.length >= 5}
              onClick={() => setNav({ links: [...nav.links, { label: "", url: "" }] })}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {nav.links.map((link, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] gap-1.5">
              <Input value={link.label} onChange={(e) => updateLink(i, "label", e.target.value)} placeholder="Merch" className="h-8 bg-surface-card" />
              <Input value={link.url} onChange={(e) => updateLink(i, "url", e.target.value)} placeholder="https://" className="h-8 bg-surface-card" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove link" className="h-8 w-8 text-text-secondary hover:text-foreground" onClick={() => setNav({ links: nav.links.filter((_, idx) => idx !== i) })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </PanelGroup>

      <PanelGroup title="Join button">
        <TextField label="Label" value={cta.label} onChange={(v) => setCta({ label: v })} placeholder="Become a member" />
        <SettingsList>
          <SettingRow title="Mobile join bar" description="A pinned bar with your lowest price on phones." checked={cta.mobileBar} onCheckedChange={(v) => setCta({ mobileBar: v })} />
        </SettingsList>
      </PanelGroup>
    </div>
  );
}
