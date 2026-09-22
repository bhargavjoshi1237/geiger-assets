"use client";

// General — project identity, identifiers, availability and workspace
// defaults. Name/slug/description write to public.projects (via patchProject,
// then a context refresh); everything else is promoted project_settings
// columns (via patchColumns). All writes are optimistic with rollback.

import React, { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { useCopied } from "@/lib/use-copied";
import { useProject } from "@/context/project-context";
import { projectNav } from "@/components/internal/sidebar/projects/sidebar_data";
import {
  PAGE_SIZE_OPTIONS,
  PROJECT_REGION_OPTIONS,
  PROJECT_VISIBILITY_OPTIONS,
} from "./constants";
import { SelectSettingRow, useProjectSettings } from "./settings_kit";

const SLUG_RE = /^[a-z0-9-]+$/;

export function CopyButton({ value, label }) {
  const [copied, flashCopied] = useCopied(2000);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label || "Copy"}
      className="h-7 w-7 shrink-0 text-text-secondary hover:bg-surface-active hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          flashCopied();
        } catch {
          toast.error("Couldn't copy.");
        }
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function IdentifierRow({ title, description, value }) {
  return (
    <SettingRow
      title={title}
      description={description}
      control={
        <div className="flex min-w-0 items-center gap-1.5">
          <code className="max-w-[220px] truncate font-mono text-xs text-foreground sm:max-w-xs">
            {value || "—"}
          </code>
          {value ? <CopyButton value={value} label={`Copy ${title}`} /> : null}
        </div>
      }
    />
  );
}

export function GeneralSettingsScreen({ projectId }) {
  const { project, refresh, loading: projectLoading } = useProject();
  const { settings, loading: settingsLoading, patchColumns, patchProject } =
    useProjectSettings(projectId);
  // Drafts are tagged with the project they belong to, so switching projects
  // discards a stale draft without a reset effect.
  const [nameDraft, setNameDraft] = useState({ id: null, value: null });
  const [slugDraft, setSlugDraft] = useState({ id: null, value: null });
  const [descriptionDraft, setDescriptionDraft] = useState({
    id: null,
    value: null,
  });

  const loading = projectLoading || settingsLoading;

  const name =
    nameDraft.id === project?.id && nameDraft.value !== null
      ? nameDraft.value
      : (project?.name ?? "");
  const slug =
    slugDraft.id === project?.id && slugDraft.value !== null
      ? slugDraft.value
      : (project?.slug ?? "");
  const description =
    descriptionDraft.id === project?.id && descriptionDraft.value !== null
      ? descriptionDraft.value
      : (project?.description ?? "");

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed === (project?.name ?? "")) return;
    if (!trimmed) {
      toast.error("Project name can't be empty.");
      setNameDraft({ id: null, value: null });
      return;
    }
    const saved = await patchProject({ name: trimmed });
    if (saved) {
      await refresh();
      toast.success("Project name saved.");
    }
    setNameDraft({ id: null, value: null });
  };

  const saveSlug = async () => {
    const trimmed = slug.trim().toLowerCase();
    if (trimmed === (project?.slug ?? "")) {
      setSlugDraft({ id: null, value: null });
      return;
    }
    if (!SLUG_RE.test(trimmed)) {
      toast.error("Slugs use lowercase letters, numbers and hyphens only.");
      setSlugDraft({ id: null, value: null });
      return;
    }
    const saved = await patchProject({ slug: trimmed });
    if (saved) {
      await refresh();
      toast.success("Project slug saved.");
    } else {
      toast.error("That slug is already taken.");
    }
    setSlugDraft({ id: null, value: null });
  };

  const saveDescription = async () => {
    if (description === (project?.description ?? "")) return;
    const saved = await patchProject({ description });
    if (saved) {
      await refresh();
      toast.success("Project description saved.");
    }
  };

  const landingTabOptions = projectNav.map((item) => ({
    value: item.title,
    label: item.title,
  }));

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="General"
          description="Name, identifiers, and the basics that describe this project."
        />
        <LoadingArea size={56} label="Loading project settings" />
      </SecondaryScreenWrapper>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="General"
        description="Name, identifiers, and the basics that describe this project."
      />

      <SectionCard
        title="Identity"
        description="Saved automatically when you leave a field."
      >
        <div className="grid gap-4">
          <Field label="Project name">
            <Input
              value={name}
              onChange={(e) =>
                setNameDraft({ id: project?.id ?? null, value: e.target.value })
              }
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="e.g. Brand Assets"
              className="border-border bg-surface-card text-foreground"
            />
          </Field>
          <Field
            label="Slug"
            hint="Lowercase letters, numbers and hyphens. Used in URLs."
          >
            <Input
              value={slug}
              onChange={(e) =>
                setSlugDraft({ id: project?.id ?? null, value: e.target.value })
              }
              onBlur={saveSlug}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="e.g. brand-assets"
              className="border-border bg-surface-card font-mono text-foreground"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) =>
                setDescriptionDraft({
                  id: project?.id ?? null,
                  value: e.target.value,
                })
              }
              onBlur={saveDescription}
              placeholder="What is this project for?"
              rows={3}
              className="resize-y border-border bg-surface-card text-foreground"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Identifiers"
        description="Read-only ids for API and support use."
      >
        <SettingsList>
          <IdentifierRow
            title="Project ID"
            description="The workspace id used across the suite."
            value={project?.id ?? ""}
          />
          <IdentifierRow
            title="DAM project ID"
            description="The external DAM reference, when linked."
            value={project?.dam_project_id ?? project?.damProjectId ?? ""}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Availability"
        description="Who can discover and access this project, and where it runs."
      >
        <SettingsList>
          <SelectSettingRow
            title="Visibility"
            description="Private projects are invite-only."
            value={settings.visibility}
            options={PROJECT_VISIBILITY_OPTIONS}
            onSave={(next) => patchColumns({ visibility: next })}
          />
          <SelectSettingRow
            title="Region"
            description="Primary deployment region for compute and data."
            value={settings.region}
            options={PROJECT_REGION_OPTIONS}
            onSave={(next) => patchColumns({ region: next })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Workspace defaults"
        description="Starting points for tables and navigation."
      >
        <SettingsList>
          <SelectSettingRow
            title="Default rows per page"
            description="New tables start here."
            value={String(settings.defaultPageSize)}
            options={PAGE_SIZE_OPTIONS}
            onSave={(next) => patchColumns({ defaultPageSize: Number(next) })}
          />
          <SelectSettingRow
            title="Default landing tab"
            description="Where members land when they open the project."
            value={settings.defaultTab}
            options={landingTabOptions}
            onSave={(next) => patchColumns({ defaultTab: next })}
          />
        </SettingsList>
      </SectionCard>
    </SecondaryScreenWrapper>
  );
}

export default GeneralSettingsScreen;
