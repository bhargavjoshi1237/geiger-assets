"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Eye,
  Globe,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  DEFAULT_PROJECT_SETTINGS,
  archiveProject,
  deleteProjectConfiguration,
} from "@/lib/supabase/settings";
import { useProjectSettings } from "./use_project_settings";
import {
  LOCALE_OPTIONS,
  TIMEZONE_OPTIONS,
  VISIBILITY_MAP,
  VISIBILITY_OPTIONS,
  slugify,
} from "./constants";

// General — workspace identity, workspace-wide defaults, and the danger zone.
// Text fields save explicitly per card; toggles and selects persist the moment
// they change. Every write goes through lib/supabase/settings.js
// optimistically and toasts only from here.

export function GeneralScreen({ projectId }) {
  const { settings, setSettings, loading, save } = useProjectSettings(projectId);
  const [draft, setDraft] = useState({ name: "", description: "", slug: "" });
  const [seededFor, setSeededFor] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Seed the form from the fetched row once per project. A render-phase
  // adjustment, not an effect — it runs only until seededFor catches up.
  if (!loading && seededFor !== projectId) {
    setSeededFor(projectId);
    setDraft({ name: settings.name, description: settings.description, slug: settings.slug });
  }
  const seeded = !loading && seededFor === projectId;

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const saveProfile = async () => {
    if (!draft.name.trim()) {
      toast.error("Give the project a name.");
      return;
    }
    setSavingProfile(true);
    const saved = await save(
      {
        name: draft.name.trim(),
        description: draft.description.trim(),
        slug: draft.slug.trim() || slugify(draft.name),
      },
      { success: "Workspace profile saved.", error: "Couldn't save the profile." },
    );
    setSavingProfile(false);
    if (saved) setDraft({ name: saved.name, description: saved.description, slug: saved.slug });
  };

  const setArchived = async (archived) => {
    setArchiving(true);
    // archiveProject is the same upsert path as save(), kept as the named
    // danger-zone action so the intent reads at the call site.
    const previous = settings.archivedAt;
    setSettings((current) => ({
      ...current,
      archivedAt: archived ? new Date().toISOString() : null,
    }));
    const saved = await archiveProject(projectId, archived);
    setArchiving(false);
    if (!saved) {
      setSettings((current) => ({ ...current, archivedAt: previous }));
      toast.error(archived ? "Couldn't archive the project." : "Couldn't restore the project.");
      return;
    }
    setSettings((current) => ({ ...current, ...saved }));
    toast.success(archived ? "Project archived." : "Project restored.");
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const ok = await deleteProjectConfiguration(projectId);
    setDeleting(false);
    if (!ok) {
      toast.error("Couldn't delete the configuration.");
      return;
    }
    setSettings({ ...DEFAULT_PROJECT_SETTINGS, projectId });
    setDraft({ name: "", description: "", slug: "" });
    setDeleteOpen(false);
    toast.success("Project configuration deleted.");
  };

  const archived = Boolean(settings.archivedAt);
  const profileDirty =
    seeded &&
    (draft.name !== settings.name ||
      draft.description !== settings.description ||
      draft.slug !== settings.slug);

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="General"
        description="Workspace identity, workspace-wide defaults, and the danger zone."
      />

      {loading || !seeded ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading general settings" />
        </div>
      ) : (
        <>
          <SectionCard
            title="Workspace profile"
            description="How this project reads across the suite."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={saveProfile}
                disabled={savingProfile || !profileDirty}
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            }
          >
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name" htmlFor="general-name">
                  <Input
                    id="general-name"
                    className="bg-surface-card"
                    value={draft.name}
                    onChange={set("name")}
                    placeholder="e.g. Launch library"
                    autoFocus
                  />
                </Field>
                <Field
                  label="Slug"
                  htmlFor="general-slug"
                  hint="Used in share links and generated URLs."
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id="general-slug"
                      className="bg-surface-card"
                      value={draft.slug}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))
                      }
                      placeholder="launch-library"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Regenerate slug from name"
                      className="shrink-0 text-text-secondary hover:text-foreground"
                      onClick={() => setDraft((d) => ({ ...d, slug: slugify(d.name) }))}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </Field>
              </div>
              <Field label="Description" htmlFor="general-description">
                <Textarea
                  id="general-description"
                  className="bg-surface-card"
                  value={draft.description}
                  onChange={set("description")}
                  placeholder="What is this workspace for?"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Defaults"
            description="Applied to new assets and new members unless overridden."
          >
            <SettingsList>
              <SettingRow
                title="Default locale"
                description="Language assumed for titles, descriptions, and metadata."
                icon={Globe}
                control={
                  <Select
                    value={settings.defaultLocale}
                    onValueChange={(value) =>
                      save({ defaultLocale: value }, { error: "Couldn't save the locale." })
                    }
                  >
                    <SelectTrigger className="w-48 bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <SettingRow
                title="Timezone"
                description="Used for scheduled publishes and activity timestamps."
                icon={Globe}
                control={
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) =>
                      save({ timezone: value }, { error: "Couldn't save the timezone." })
                    }
                  >
                    <SelectTrigger className="w-48 bg-surface-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
              <SettingRow
                title="Default asset visibility"
                description="Who can see a newly uploaded asset before anyone changes it."
                icon={Eye}
                control={
                  <div className="flex items-center gap-2">
                    <StatusPill status={settings.defaultVisibility} map={VISIBILITY_MAP} />
                    <Select
                      value={settings.defaultVisibility}
                      onValueChange={(value) =>
                        save(
                          { defaultVisibility: value },
                          { error: "Couldn't save the visibility." },
                        )
                      }
                    >
                      <SelectTrigger className="w-48 bg-surface-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIBILITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                }
              />
            </SettingsList>
          </SectionCard>

          <SectionCard
            title="Danger zone"
            description="Archiving hides the workspace from lists; deleting removes its Assets configuration."
          >
            <SettingsList>
              <SettingRow
                title={archived ? "Project archived" : "Archive project"}
                description={
                  archived
                    ? "Archived workspaces are hidden from lists but keep all data."
                    : "Hide this workspace from lists without deleting anything."
                }
                icon={Archive}
                control={
                  <Button
                    variant="outline"
                    className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                    onClick={() => setArchived(!archived)}
                    disabled={archiving}
                  >
                    {archiving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    {archived ? "Restore" : "Archive"}
                  </Button>
                }
              />
              <SettingRow
                title="Delete project configuration"
                description="Removes Assets settings and custom fields. The suite project itself is untouched."
                icon={Trash2}
                control={
                  <Button
                    variant="outline"
                    className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete…
                  </Button>
                }
              />
            </SettingsList>
          </SectionCard>
        </>
      )}

      <Dialog open={deleteOpen} onOpenChange={deleting ? undefined : setDeleteOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Delete project configuration?</DialogTitle>
            <DialogDescription>
              This removes workspace settings and custom field definitions for this project.
              Assets, uploads, and the suite project itself are left alone. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Custom field definitions are deleted with the configuration.
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-500 text-white hover:bg-red-500/90"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete configuration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SecondaryScreenWrapper>
  );
}

export default GeneralScreen;
