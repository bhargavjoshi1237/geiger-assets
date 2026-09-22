"use client";

// Brand Kit — logo lockups, palette, type scale and usage notes. Everything
// inline-editable; text fields commit on blur, discrete actions (upload,
// pickers, add/remove) commit immediately. State lives in
// metadata.brandKit ({ logos, palette, typography, dos, donts }).

import React, { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Palette, Plus, X } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  LoadingArea,
  ScreenHeader,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { RowActions } from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { useProjectSettings } from "@/components/internal/screens/projects/settings/settings_kit";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_LOGO_BYTES = 500 * 1024;

function CommitInput({ value, onCommit, ...props }) {
  return (
    <Input
      key={String(value ?? "")}
      defaultValue={value ?? ""}
      onBlur={(e) => {
        if (e.target.value !== (value ?? "")) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      {...props}
    />
  );
}

function NoteList({ title, items, onAdd, onRemove }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onAdd(text);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-tertiary">
          Nothing listed yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((note, i) => (
            <li
              key={`${note}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground"
            >
              <span className="min-w-0 flex-1">{note}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove note ${note}`}
                className="h-7 w-7 shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                onClick={() => onRemove(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder={`Add a ${title.toLowerCase().slice(0, -1)}…`}
          aria-label={`Add a ${title.toLowerCase().slice(0, -1)}`}
          className="h-9 border-border bg-surface-card text-sm text-foreground"
        />
        <Button
          variant="outline"
          onClick={add}
          disabled={!draft.trim()}
          className="h-9 shrink-0 border-border bg-surface-card text-foreground hover:bg-surface-hover"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function RowActionsRemoveIcon() {
  return <span aria-hidden="true" className="text-base leading-none">×</span>;
}

export function BrandKitScreen({ projectId }) {
  const { settings, loading, patchSection } = useProjectSettings(projectId);
  const brandKit = settings.brandKit ?? {};
  const logos = Array.isArray(brandKit.logos) ? brandKit.logos : [];
  const palette = Array.isArray(brandKit.palette) ? brandKit.palette : [];
  const typography = Array.isArray(brandKit.typography) ? brandKit.typography : [];
  const dos = Array.isArray(brandKit.dos) ? brandKit.dos : [];
  const donts = Array.isArray(brandKit.donts) ? brandKit.donts : [];

  const save = async (patch) => {
    const saved = await patchSection("brandKit", {
      logos,
      palette,
      typography,
      dos,
      donts,
      ...patch,
    });
    return Boolean(saved);
  };

  const setLogos = async (next, notice) => {
    if (await save({ logos: next }) && notice) toast.success(notice);
  };
  const setPalette = async (next, notice) => {
    if (await save({ palette: next }) && notice) toast.success(notice);
  };
  const setTypography = async (next, notice) => {
    if (await save({ typography: next }) && notice) toast.success(notice);
  };

  const patchLogo = (id, partial) =>
    setLogos(logos.map((l) => (l.id === id ? { ...l, ...partial } : l)));

  const addLogo = () =>
    setLogos(
      [
        ...logos,
        { id: crypto.randomUUID(), label: "New lockup", url: "", clearSpace: "", minSize: "" },
      ],
      "Logo lockup added.",
    );

  const uploadLogo = (id, file) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Keep lockup uploads under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patchLogo(id, { url: String(reader.result || "") });
      toast.success("Logo uploaded.");
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  const addSwatch = () =>
    setPalette(
      [
        ...palette,
        { id: crypto.randomUUID(), name: "New swatch", hex: "#737373", role: "" },
      ],
      "Swatch added.",
    );

  const patchSwatch = (id, partial, rawHex) => {
    if (rawHex !== undefined && !HEX_RE.test(rawHex.trim())) {
      toast.error("Use a #rgb or #rrggbb hex value.");
      return;
    }
    setPalette(palette.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  };

  const addTypeRow = () =>
    setTypography(
      [
        ...typography,
        { id: crypto.randomUUID(), name: "Body", usage: "", size: 16 },
      ],
      "Type row added.",
    );

  const patchTypeRow = (id, partial) =>
    setTypography(typography.map((t) => (t.id === id ? { ...t, ...partial } : t)));

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="Brand Kit"
          description="Logos, colours, type and usage notes for this project."
        />
        <LoadingArea size={56} label="Loading brand kit" />
      </SecondaryScreenWrapper>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Brand Kit"
        description="Logos, colours, type and usage notes for this project."
      />

      <SectionCard
        title="Logo lockups"
        description="Uploads stay under 500 KB; notes print beside the lockup."
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={addLogo}
          >
            <Plus className="h-4 w-4" />
            Add lockup
          </Button>
        }
      >
        {logos.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="No lockups yet"
            description="Add the primary lockup first."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={addLogo}
              >
                <Plus className="h-4 w-4" />
                Add lockup
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className="rounded-xl border border-border bg-surface-card p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                    {logo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo.url} alt={logo.label || "Logo lockup"} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-text-tertiary" />
                    )}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <Field label="Label">
                      <CommitInput
                        value={logo.label ?? ""}
                        onCommit={(v) => patchLogo(logo.id, { label: v })}
                        placeholder="Primary lockup"
                        aria-label="Logo label"
                        className="border-border bg-surface-subtle text-foreground"
                      />
                    </Field>
                    <Field label="Image URL">
                      <CommitInput
                        value={logo.url ?? ""}
                        onCommit={(v) => patchLogo(logo.id, { url: v.trim() })}
                        placeholder="https://… or upload below"
                        aria-label="Logo image URL"
                        className="border-border bg-surface-subtle font-mono text-foreground"
                      />
                    </Field>
                    <Field label="Clear space" hint="e.g. Height of the mark on all sides.">
                      <CommitInput
                        value={logo.clearSpace ?? ""}
                        onCommit={(v) => patchLogo(logo.id, { clearSpace: v })}
                        placeholder="1× mark height"
                        aria-label="Clear space note"
                        className="border-border bg-surface-subtle text-foreground"
                      />
                    </Field>
                    <Field label="Minimum size" hint="e.g. 24 px digital, 8 mm print.">
                      <CommitInput
                        value={logo.minSize ?? ""}
                        onCommit={(v) => patchLogo(logo.id, { minSize: v })}
                        placeholder="24 px"
                        aria-label="Minimum size note"
                        className="border-border bg-surface-subtle text-foreground"
                      />
                    </Field>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      onDelete={() =>
                        setLogos(
                          logos.filter((l) => l.id !== logo.id),
                          "Logo lockup removed.",
                        )
                      }
                      deleteLabel="Remove"
                    />
                  </div>
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-text-secondary hover:text-foreground">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Upload a file
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      uploadLogo(logo.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Colour palette"
        description="Swatches with hex values and roles."
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={addSwatch}
          >
            <Plus className="h-4 w-4" />
            Add swatch
          </Button>
        }
      >
        {palette.length === 0 ? (
          <EmptyState
            icon={Palette}
            title="No swatches yet"
            description="Add the brand colours members should reach for."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={addSwatch}
              >
                <Plus className="h-4 w-4" />
                Add swatch
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {palette.map((swatch) => (
              <div
                key={swatch.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-card p-3"
              >
                <input
                  type="color"
                  value={HEX_RE.test(swatch.hex || "") ? swatch.hex : "#737373"}
                  onChange={(e) => patchSwatch(swatch.id, { hex: e.target.value })}
                  aria-label={`${swatch.name || "Swatch"} colour`}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
                />
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                  <CommitInput
                    value={swatch.name ?? ""}
                    onCommit={(v) => patchSwatch(swatch.id, { name: v })}
                    placeholder="Name"
                    aria-label="Swatch name"
                    className="border-border bg-surface-subtle text-foreground"
                  />
                  <CommitInput
                    value={swatch.hex ?? ""}
                    onCommit={(v) => patchSwatch(swatch.id, { hex: v.trim() }, v)}
                    placeholder="#000000"
                    aria-label="Swatch hex"
                    className="border-border bg-surface-subtle font-mono text-foreground"
                  />
                  <CommitInput
                    value={swatch.role ?? ""}
                    onCommit={(v) => patchSwatch(swatch.id, { role: v })}
                    placeholder="Role — e.g. Primary"
                    aria-label="Swatch role"
                    className="border-border bg-surface-subtle text-foreground"
                  />
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <RowActions
                    onDelete={() =>
                      setPalette(
                        palette.filter((s) => s.id !== swatch.id),
                        "Swatch removed.",
                      )
                    }
                    deleteLabel="Remove"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Typography scale"
        description="Type rows with usage guidance."
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={addTypeRow}
          >
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        }
      >
        {typography.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
            No type rows yet — add display, heading and body rows.
          </p>
        ) : (
          <div className="space-y-2">
            {typography.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-border bg-surface-card p-3"
              >
                <p
                  className="truncate text-foreground"
                  style={{ fontSize: Math.min(32, Math.max(12, Number(row.size) || 16)) }}
                >
                  {row.name || "Untitled"} — {row.usage || "General use"}
                </p>
                <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_96px_auto]">
                  <CommitInput
                    value={row.name ?? ""}
                    onCommit={(v) => patchTypeRow(row.id, { name: v })}
                    placeholder="Name"
                    aria-label="Type row name"
                    className="border-border bg-surface-subtle text-foreground"
                  />
                  <CommitInput
                    value={row.usage ?? ""}
                    onCommit={(v) => patchTypeRow(row.id, { usage: v })}
                    placeholder="Usage — e.g. Headlines"
                    aria-label="Type row usage"
                    className="border-border bg-surface-subtle text-foreground"
                  />
                  <CommitInput
                    value={String(row.size ?? 16)}
                    onCommit={(v) => {
                      const size = Math.round(Number(v));
                      if (!Number.isFinite(size) || size <= 0) {
                        toast.error("Sizes are positive numbers.");
                        return;
                      }
                      patchTypeRow(row.id, { size });
                    }}
                    inputMode="numeric"
                    placeholder="16"
                    aria-label="Type row size"
                    className="border-border bg-surface-subtle text-foreground"
                  />
                  <div onClick={(e) => e.stopPropagation()}>
                    <RowActions
                      onDelete={() =>
                        setTypography(
                          typography.filter((t) => t.id !== row.id),
                          "Type row removed.",
                        )
                      }
                      deleteLabel="Remove"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Usage notes" description="Do this, not that.">
        <div className="grid gap-6 md:grid-cols-2">
          <NoteList
            title="Dos"
            items={dos}
            onAdd={(text) => save({ dos: [...dos, text] }).then((ok) => ok && toast.success("Note added."))}
            onRemove={(i) => save({ dos: dos.filter((_, n) => n !== i) }).then((ok) => ok && toast.success("Note removed."))}
          />
          <NoteList
            title="Don'ts"
            items={donts}
            onAdd={(text) => save({ donts: [...donts, text] }).then((ok) => ok && toast.success("Note added."))}
            onRemove={(i) => save({ donts: donts.filter((_, n) => n !== i) }).then((ok) => ok && toast.success("Note removed."))}
          />
        </div>
      </SectionCard>
    </SecondaryScreenWrapper>
  );
}

export default BrandKitScreen;
