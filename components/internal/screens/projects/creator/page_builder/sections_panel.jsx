"use client";

// The builder's Sections tab: the Home tab's blocks in order — drag or nudge to
// reorder, hide, duplicate, delete — with each block's settings inline.

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clapperboard,
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  Gem,
  GripVertical,
  HandCoins,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  Package,
  Plus,
  Rows3,
  Star,
  Timer,
  Trash2,
  Type,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { Textarea } from "@geiger/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { Field } from "@/components/internal/shared/screen_kit";
import { SelectField, TextAreaField, TextField } from "@/components/internal/shared/module_kit";
import {
  ANIMATIONS,
  AUDIENCE_OPTIONS,
  COUNTDOWN_STYLES,
  CTA_ACTIONS,
  EFFECTS,
  MEDIA_EFFECTS,
  OVERLAY_OPTIONS,
  PADDING_OPTIONS,
  SECTION_BACKGROUNDS,
  SECTION_STYLE_DEFAULTS,
  SECTION_TYPE_ORDER,
  SECTION_TYPES,
  embedSrc,
  newSection,
} from "@/lib/creator/page_config";
import { cn } from "@/lib/utils";
import { AssetSlot, ChoiceField } from "./builder_fields";

export const SECTION_ICONS = {
  hero: LayoutTemplate,
  featured: Star,
  tiers: Gem,
  feed: Rows3,
  gallery: LayoutGrid,
  bundles: Package,
  text: Type,
  links: Link2,
  faq: CircleHelp,
  countdown: Timer,
  follow: UserPlus,
  tip: HandCoins,
  embed: Clapperboard,
};

const AUDIENCE_SHORT = { guests: "Non-members", members: "Members", tier: "Tier+" };

function summary(section) {
  const p = section.props;
  return p.title || p.heading || p.eyebrow || SECTION_TYPES[section.type].description;
}

function CtaFields({ props, set }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Button label" value={props.ctaLabel} onChange={set("ctaLabel")} placeholder="Leave empty to hide" />
        <SelectField label="Button action" value={props.ctaAction} onChange={set("ctaAction")} options={CTA_ACTIONS} />
      </div>
      {props.ctaAction === "link" ? <TextField label="Link" value={props.ctaUrl} onChange={set("ctaUrl")} placeholder="https://" /> : null}
    </>
  );
}

function FaqItems({ items, onChange }) {
  const update = (i, key, value) => onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  return (
    <Field label="Questions">
      <div className="grid gap-2">
        {items.map((item, i) => (
          <div key={i} className="grid gap-1.5 rounded-lg border border-border bg-surface-card p-2">
            <div className="flex items-center gap-1.5">
              <Input value={item.q} onChange={(e) => update(i, "q", e.target.value)} placeholder="Question" className="h-8" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove question" className="h-8 w-8 shrink-0 text-text-secondary hover:text-foreground" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea value={item.a} onChange={(e) => update(i, "a", e.target.value)} placeholder="Answer" rows={2} className="bg-surface-subtle" />
          </div>
        ))}
        <Button variant="outline" size="sm" className="border-dashed border-border bg-transparent text-text-secondary hover:bg-surface-active hover:text-foreground" onClick={() => onChange([...items, { q: "", a: "" }])}>
          <Plus className="h-4 w-4" />
          Add question
        </Button>
      </div>
    </Field>
  );
}

function PostPicker({ posts, value, onChange }) {
  const published = posts.filter((p) => p.status === "published");
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id].slice(0, 12));
  return (
    <Field label="Posts" hint="Shown in the order you pick them.">
      {published.length ? (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-card p-1">
          {published.map((post) => {
            const index = value.indexOf(post.id);
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => toggle(post.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover"
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-semibold",
                    index >= 0 ? "border-transparent bg-primary text-primary-foreground" : "border-border-strong text-transparent",
                  )}
                >
                  {index >= 0 ? index + 1 : ""}
                </span>
                <span className="truncate text-foreground">{post.title || "Untitled post"}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">No published posts yet.</p>
      )}
    </Field>
  );
}

const SECTION_ANIMATIONS = [{ value: "inherit", label: "Page default" }, ...ANIMATIONS];

/** How the section looks: backdrop, image treatment, effect layer, spacing and entrance. */
function StyleFields({ section, onChange, ctx }) {
  const style = { ...SECTION_STYLE_DEFAULTS, ...section.style };
  const set = (key) => (value) => onChange({ ...section, style: { ...style, [key]: value } });
  const framed = style.background !== "none";
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface-card p-3">
      <p className="text-xs font-semibold text-foreground">Style</p>
      <SelectField label="Background" value={style.background} onChange={set("background")} options={SECTION_BACKGROUNDS} />
      {style.background === "image" ? (
        <>
          <AssetSlot
            label="Background image"
            wide
            asset={ctx.assetById.get(style.bgAssetId)}
            onPick={() => ctx.pickAsset({ kinds: ["image"], title: "Choose a background", onPick: (a) => set("bgAssetId")(a.id) })}
            onClear={() => set("bgAssetId")(null)}
          />
          <SelectField label="Image effect" value={style.mediaEffect} onChange={set("mediaEffect")} options={MEDIA_EFFECTS} />
          <ChoiceField label="Dim" value={style.overlay} onChange={set("overlay")} options={OVERLAY_OPTIONS} />
        </>
      ) : null}
      {framed ? (
        <>
          <SelectField label="Effect" value={style.effect} onChange={set("effect")} options={EFFECTS} />
          <ChoiceField label="Spacing" value={style.padding} onChange={set("padding")} options={PADDING_OPTIONS} />
          <ChoiceField label="Width" value={style.width} onChange={set("width")} options={[{ value: "contained", label: "Contained" }, { value: "full", label: "Full bleed" }]} />
        </>
      ) : null}
      <SelectField label="Animation" value={style.animation} onChange={set("animation")} options={SECTION_ANIMATIONS} hint="Plays as the section scrolls into view." />
    </div>
  );
}

/** Settings for one section: its own props, its style, then who sees it. */
function SectionInspector({ section, onChange, ctx }) {
  const p = section.props;
  const set = (key) => (value) => onChange({ ...section, props: { ...p, [key]: value } });
  const tierOptions = ctx.tiers.map((t) => ({ value: t.id, label: t.name }));

  let fields = null;
  switch (section.type) {
    case "hero":
      fields = (
        <>
          <TextField label="Eyebrow" value={p.eyebrow} onChange={set("eyebrow")} placeholder="New every Friday" />
          <TextField label="Headline" value={p.heading} onChange={set("heading")} placeholder="Behind the lens, every week" />
          <TextAreaField label="Pitch" value={p.body} onChange={set("body")} rows={3} placeholder="What fans get when they join." />
          <AssetSlot
            label="Image or video"
            wide
            asset={ctx.assetById.get(p.mediaAssetId)}
            onPick={() => ctx.pickAsset({ kinds: ["image", "video"], title: "Choose hero media", onPick: (a) => set("mediaAssetId")(a.id) })}
            onClear={() => set("mediaAssetId")(null)}
          />
          <ChoiceField label="Alignment" value={p.align} onChange={set("align")} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centred" }]} />
          <CtaFields props={p} set={set} />
        </>
      );
      break;
    case "featured":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} />
          <ChoiceField
            label="Show"
            value={p.mode}
            onChange={set("mode")}
            options={[
              { value: "pinned", label: "Pinned" },
              { value: "picked", label: "Hand-picked" },
              { value: "popular", label: "Most liked" },
            ]}
          />
          {p.mode === "picked" ? <PostPicker posts={ctx.posts} value={p.postIds} onChange={set("postIds")} /> : null}
          <SelectField label="How many" value={String(p.limit)} onChange={(v) => set("limit")(Number(v))} options={[1, 2, 3, 4, 6, 9].map((n) => ({ value: String(n), label: String(n) }))} />
        </>
      );
      break;
    case "tiers":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} />
          <TextField label="Subtitle" value={p.subtitle} onChange={set("subtitle")} placeholder="Cancel any time." />
          <SelectField label="Highlight" value={p.highlightTierId || ""} onChange={(v) => set("highlightTierId")(v || null)} options={[{ value: "", label: "No highlight" }, ...tierOptions]} hint="Marked “Most popular”." />
        </>
      );
      break;
    case "feed":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} />
          <ChoiceField label="Layout" value={p.layout} onChange={set("layout")} options={[{ value: "list", label: "Full posts" }, { value: "grid", label: "Grid" }]} />
          <SelectField
            label="Posts"
            value={p.filter}
            onChange={set("filter")}
            options={[
              { value: "all", label: "All posts" },
              { value: "public", label: "Public posts" },
              { value: "members", label: "Member posts" },
              { value: "ppv", label: "Pay-per-view posts" },
            ]}
          />
          <SelectField label="How many" value={String(p.limit)} onChange={(v) => set("limit")(Number(v))} options={[3, 5, 6, 9, 12, 20].map((n) => ({ value: String(n), label: String(n) }))} />
        </>
      );
      break;
    case "gallery":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} />
          <ChoiceField label="Layout" value={p.layout} onChange={set("layout")} options={[{ value: "grid", label: "Grid" }, { value: "masonry", label: "Masonry" }]} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Columns" value={String(p.columns)} onChange={(v) => set("columns")(Number(v))} options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} />
            <SelectField label="Items" value={String(p.limit)} onChange={(v) => set("limit")(Number(v))} options={[6, 9, 12, 18, 24, 36].map((n) => ({ value: String(n), label: String(n) }))} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div>
              <p className="text-sm text-foreground">Include locked media</p>
              <p className="text-xs text-text-secondary">Shown blurred, with a lock — a teaser.</p>
            </div>
            <Switch checked={p.includeLocked} onCheckedChange={set("includeLocked")} />
          </div>
        </>
      );
      break;
    case "bundles":
      fields = <TextField label="Title" value={p.title} onChange={set("title")} />;
      break;
    case "text":
      fields = (
        <>
          <TextField label="Heading" value={p.heading} onChange={set("heading")} />
          <TextAreaField label="Text" value={p.body} onChange={set("body")} rows={6} />
          <ChoiceField label="Alignment" value={p.align} onChange={set("align")} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centred" }]} />
        </>
      );
      break;
    case "links":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} />
          <ChoiceField label="Style" value={p.style} onChange={set("style")} options={[{ value: "buttons", label: "Buttons" }, { value: "list", label: "List" }]} />
          <p className="text-xs text-text-tertiary">Links come from the Profile tab.</p>
        </>
      );
      break;
    case "faq":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} />
          <FaqItems items={p.items} onChange={set("items")} />
        </>
      );
      break;
    case "countdown":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} placeholder="Next drop" />
          <TextAreaField label="Text" value={p.body} onChange={set("body")} rows={2} />
          <Field label="Counts down to">
            <Input type="datetime-local" value={p.date} onChange={(e) => set("date")(e.target.value)} className="bg-surface-card" />
          </Field>
          <ChoiceField label="Display" value={p.display} onChange={set("display")} options={COUNTDOWN_STYLES} />
          <CtaFields props={p} set={set} />
        </>
      );
      break;
    case "follow":
    case "tip":
      fields = (
        <>
          <TextField label="Heading" value={p.heading} onChange={set("heading")} />
          <TextAreaField label="Text" value={p.body} onChange={set("body")} rows={2} placeholder={section.type === "follow" ? "Defaults to a short follow pitch." : "Say what tips go towards."} />
        </>
      );
      break;
    case "embed":
      fields = (
        <>
          <TextField label="Title" value={p.title} onChange={set("title")} />
          <TextField label="Link" value={p.url} onChange={set("url")} placeholder="https://youtube.com/watch?v=…" hint={p.url && !embedSrc(p.url) ? "Paste a YouTube, Vimeo, Spotify or SoundCloud link." : undefined} />
        </>
      );
      break;
    default:
      break;
  }

  return (
    <div className="grid gap-3 border-t border-border px-3 pb-4 pt-3">
      {fields}
      <StyleFields section={section} onChange={onChange} ctx={ctx} />
      <div className="grid gap-3 rounded-lg border border-border bg-surface-card p-3">
        <SelectField label="Who sees this" value={section.audience} onChange={(v) => onChange({ ...section, audience: v })} options={AUDIENCE_OPTIONS} />
        {section.audience === "tier" ? (
          <SelectField label="Minimum tier" value={section.minTierId || ""} onChange={(v) => onChange({ ...section, minTierId: v || null })} options={tierOptions} placeholder="Pick a tier" />
        ) : null}
      </div>
    </div>
  );
}

export function SectionsPanel({ sections, onChange, ctx }) {
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const replace = (next) => onChange(sections.map((s) => (s.id === next.id ? next : s)));
  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const list = [...sections];
    [list[index], list[target]] = [list[target], list[index]];
    onChange(list);
  };
  const add = (type) => {
    const section = newSection(type);
    onChange([...sections, section]);
    setOpenId(section.id);
    ctx.focusSection(section.id);
  };
  const duplicate = (section) => {
    const copy = { ...JSON.parse(JSON.stringify(section)), id: crypto.randomUUID() };
    const index = sections.findIndex((s) => s.id === section.id);
    onChange([...sections.slice(0, index + 1), copy, ...sections.slice(index + 1)]);
    setOpenId(copy.id);
  };
  const drop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const list = sections.filter((s) => s.id !== dragId);
    const index = list.findIndex((s) => s.id === targetId);
    list.splice(index, 0, sections.find((s) => s.id === dragId));
    onChange(list);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary">
        Your Home tab, top to bottom. Posts, Membership and About stay available as tabs.
      </p>
      <ul className="space-y-2">
        {sections.map((section, index) => {
          const Icon = SECTION_ICONS[section.type];
          const open = openId === section.id;
          return (
            <li
              key={section.id}
              draggable={!open}
              onDragStart={(e) => {
                setDragId(section.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(section.id);
              }}
              onDragLeave={() => setOverId((id) => (id === section.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                drop(section.id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={cn(
                "rounded-xl border bg-surface-subtle transition-colors",
                open ? "border-border-strong" : "border-border",
                overId === section.id && dragId !== section.id && "border-primary",
                dragId === section.id && "opacity-50",
                section.hidden && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2 px-2 py-2">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-text-tertiary" aria-hidden />
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(open ? null : section.id);
                    if (!open) ctx.focusSection(section.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">{SECTION_TYPES[section.type].label}</span>
                      {AUDIENCE_SHORT[section.audience] ? (
                        <span className="rounded border border-border px-1 text-[10px] text-text-secondary">{AUDIENCE_SHORT[section.audience]}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-text-tertiary">{summary(section)}</span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={section.hidden ? "Show section" : "Hide section"}
                  className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
                  onClick={() => replace({ ...section, hidden: !section.hidden })}
                >
                  {section.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Section actions" className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 border-border bg-surface-subtle">
                    <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, -1)}>
                      <ChevronUp className="h-4 w-4" />
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index === sections.length - 1} onSelect={() => move(index, 1)}>
                      <ChevronDown className="h-4 w-4" />
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => duplicate(section)}>
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" className="text-red-600 dark:text-red-400 focus:bg-red-500/10" onSelect={() => onChange(sections.filter((s) => s.id !== section.id))}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {open ? <SectionInspector section={section} onChange={replace} ctx={ctx} /> : null}
            </li>
          );
        })}
      </ul>
      {!sections.length ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-text-tertiary">
          No sections — your Home tab falls back to your latest posts.
        </p>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full border-dashed border-border bg-transparent text-text-secondary hover:bg-surface-active hover:text-foreground">
            <Plus className="h-4 w-4" />
            Add section
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60dvh] w-80 overflow-y-auto border-border bg-surface-subtle">
          <DropdownMenuLabel className="text-xs font-normal text-text-secondary">Add to your Home tab</DropdownMenuLabel>
          {SECTION_TYPE_ORDER.map((type) => {
            const Icon = SECTION_ICONS[type];
            return (
              <DropdownMenuItem key={type} onSelect={() => add(type)} className="items-start gap-2.5 py-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">{SECTION_TYPES[type].label}</span>
                  <span className="block text-xs text-text-secondary">{SECTION_TYPES[type].description}</span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
