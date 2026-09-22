"use client";

// Advanced — operational toggles, environment variables, cache actions and
// the danger zone. Toggles persist through patchSection("advanced", …);
// variables/watermarks-shaped arrays replace wholesale through the same hook.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, Plus } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import {
  CreateDialog,
  RowActions,
  SelectField,
  TextField,
} from "@/components/internal/shared/module_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import { useProject } from "@/context/project-context";
import {
  softDeleteProjectRecord,
  updateProjectRecord,
} from "@/lib/supabase/project_settings";
import {
  DEFAULT_ADDON_PREFS,
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
  DEFAULT_USAGE_LIMITS,
} from "./constants";
import { CopyButton } from "./general_settings";
import {
  ConfirmDeleteDialog,
  DangerZoneCard,
  useProjectSettings,
} from "./settings_kit";

const ADVANCED_ROWS = [
  {
    key: "readOnly",
    title: "Read-only mode",
    description: "Temporarily prevent any writes to the project.",
  },
  {
    key: "maintenanceMode",
    title: "Maintenance mode",
    description: "Members see a maintenance notice instead of the workspace.",
  },
  {
    key: "auditLogging",
    title: "Audit logging",
    description: "Record API requests, mutations and access events.",
  },
  {
    key: "rateLimiting",
    title: "Rate limiting",
    description: "Throttle API requests to prevent abuse.",
  },
  {
    key: "requestSigning",
    title: "Request signing",
    description: "Require signed requests for API mutations.",
  },
  {
    key: "webhookRetries",
    title: "Webhook retries",
    description: "Retry failed webhook deliveries with backoff.",
  },
];

const EMPTY_VAR_DRAFT = { id: null, key: "", value: "", secret: true };

function VariableDialog({ open, onOpenChange, draft, onDraftChange, onSave, taken }) {
  const set = (key) => (value) => onDraftChange({ ...draft, [key]: value });
  return (
    <CreateDialog
      open={open}
      onOpenChange={onOpenChange}
      title={draft.id ? "Edit variable" : "Add variable"}
      description="Secret values are masked in the table."
      submitLabel={draft.id ? "Save changes" : "Add variable"}
      onSubmit={() => {
        if (!draft.key.trim()) {
          toast.error("Give the variable a key first.");
          return;
        }
        if (taken(draft)) {
          toast.error("That key is already in use.");
          return;
        }
        onSave();
      }}
    >
      <TextField
        label="Key"
        value={draft.key}
        onChange={set("key")}
        placeholder="API_BASE_URL"
      />
      <TextField
        label="Value"
        value={draft.value}
        onChange={set("value")}
        placeholder="https://api.example.com"
      />
      <Field label="Secret" hint="Mask the value in the table.">
        <Switch
          checked={Boolean(draft.secret)}
          onCheckedChange={set("secret")}
          aria-label="Secret"
        />
      </Field>
    </CreateDialog>
  );
}

export function AdvancedSettingsScreen({ projectId }) {
  const router = useRouter();
  const { project, projects, refresh } = useProject();
  const { settings, loading, patchColumns, patchSection } =
    useProjectSettings(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_VAR_DRAFT);
  const [revealed, setRevealed] = useState({});
  const [purging, setPurging] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const variables = useMemo(
    () => (Array.isArray(settings.variables) ? settings.variables : []),
    [settings.variables],
  );

  const openAdd = () => {
    setDraft(EMPTY_VAR_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setDraft({
      id: row.id,
      key: row.key ?? "",
      value: row.value ?? "",
      secret: row.secret !== false,
    });
    setDialogOpen(true);
  };

  const taken = (candidate) => {
    const key = candidate.key.trim();
    return variables.some(
      (v) => v.key === key && (!candidate.id || v.id !== candidate.id),
    );
  };

  const handleSaveVariable = async () => {
    const entry = {
      id: draft.id || crypto.randomUUID(),
      key: draft.key.trim(),
      value: draft.value,
      secret: draft.secret !== false,
    };
    const prev = variables;
    const next = draft.id
      ? prev.map((v) => (v.id === draft.id ? entry : v))
      : [entry, ...prev];
    setDialogOpen(false);
    setDraft(EMPTY_VAR_DRAFT);
    const saved = await patchSection("variables", next);
    if (saved) {
      toast.success(
        draft.id ? "Variable saved." : `Variable "${entry.key}" added.`,
      );
    }
  };

  const handleDeleteVariable = async (row) => {
    const prev = variables;
    const saved = await patchSection(
      "variables",
      prev.filter((v) => v.id !== row.id),
    );
    if (saved) toast.success(`Variable "${row.key}" removed.`);
  };

  const handlePurge = async () => {
    if (purging) return;
    setPurging(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setPurging(false);
    toast.success("CDN cache purge requested.");
  };

  const handleRebuild = async () => {
    if (rebuilding) return;
    setRebuilding(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setRebuilding(false);
    toast.success("Rendition rebuild queued.");
  };

  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    const results = await Promise.all([
      patchColumns({
        visibility: "private",
        region: "us-east-1",
        defaultPageSize: 25,
        defaultTab: "Overview",
        storageQuotaGb: DEFAULT_USAGE_LIMITS.storageQuotaGb,
        maxUploadMb: DEFAULT_USAGE_LIMITS.maxUploadMb,
        trashRetentionDays: DEFAULT_USAGE_LIMITS.trashRetentionDays,
        autoArchiveDays: DEFAULT_USAGE_LIMITS.autoArchiveDays,
        quotaAlertPercent: DEFAULT_USAGE_LIMITS.quotaAlertPercent,
      }),
      patchSection("advanced", { ...DEFAULT_ADVANCED_SETTINGS }),
      patchSection("security", { ...DEFAULT_SECURITY_SETTINGS }),
      patchSection("usage", {
        allowedFileTypes: [...DEFAULT_USAGE_LIMITS.allowedFileTypes],
      }),
      patchSection("variables", []),
      patchSection("brandKit", {
        logos: [],
        palette: [],
        typography: [],
        dos: [],
        donts: [],
      }),
      patchSection("watermarks", []),
      patchSection("contactSheets", []),
      patchSection("addons", {
        enabled: [...DEFAULT_ADDON_PREFS.enabled],
        navPositions: {},
        colors: {},
      }),
    ]);
    setResetting(false);
    setResetOpen(false);
    if (results.every(Boolean)) toast.success("Settings reset to defaults.");
  };

  const orgOptions = useMemo(() => {
    const seen = new Map();
    for (const p of projects || []) {
      const org = p.organization_id ?? p.organizationId;
      if (org && !seen.has(org)) {
        seen.set(org, {
          value: org,
          label: org === project?.organization_id ? `${org} (current)` : org,
        });
      }
    }
    return [...seen.values()].filter(
      (o) => o.value !== (project?.organization_id ?? project?.organizationId),
    );
  }, [projects, project]);

  const handleTransfer = async () => {
    if (!transferTarget || transferring) return;
    setTransferring(true);
    const saved = await updateProjectRecord(projectId, {
      organizationId: transferTarget,
    });
    setTransferring(false);
    if (saved) {
      await refresh();
      setTransferOpen(false);
      setTransferTarget("");
      toast.success("Project transfer saved.");
    } else {
      toast.error("Couldn't transfer the project.");
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const ok = await softDeleteProjectRecord(projectId);
    setDeleting(false);
    if (!ok) {
      toast.error("Couldn't delete the project.");
      return;
    }
    setDeleteOpen(false);
    toast.success("Project deleted.");
    await refresh();
    router.push("/");
  };

  const variableColumns = [
    {
      key: "key",
      header: "Key",
      render: (v) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs text-foreground">
            {v.key}
          </span>
          {v.secret !== false ? (
            <Badge className="border border-amber-500/30 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-300">
              SECRET
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "value",
      header: "Value",
      render: (v) => {
        const masked = v.secret !== false && !revealed[v.id];
        return (
          <span className="block max-w-[280px] truncate font-mono text-xs text-text-secondary">
            {masked ? "••••••••••••" : (v.value ?? "")}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (v) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {v.secret !== false ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={revealed[v.id] ? "Hide value" : "Reveal value"}
              className="h-7 w-7 text-text-secondary hover:bg-surface-active hover:text-foreground"
              onClick={() =>
                setRevealed((r) => ({ ...r, [v.id]: !r[v.id] }))
              }
            >
              {revealed[v.id] ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
          <CopyButton value={v.value ?? ""} label={`Copy ${v.key}`} />
          <RowActions onEdit={() => openEdit(v)} onDelete={() => handleDeleteVariable(v)} />
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="Advanced"
          description="Operational controls, environment, and destructive actions."
        />
        <LoadingArea size={56} label="Loading advanced settings" />
      </SecondaryScreenWrapper>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Advanced"
        description="Operational controls, environment, and destructive actions."
      />

      <SectionCard
        title="Operations"
        description="Core behaviour switches for this project."
      >
        <SettingsList>
          {ADVANCED_ROWS.map((row) => (
            <SettingRow
              key={row.key}
              title={row.title}
              description={row.description}
              checked={Boolean(settings.advanced?.[row.key])}
              onCheckedChange={(next) =>
                patchSection("advanced", { [row.key]: next === true })
              }
            />
          ))}
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Environment variables"
        description="Secrets and configuration for this project."
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" />
            Add variable
          </Button>
        }
      >
        {variables.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No variables yet"
            description="Store secrets and configuration for this project."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={openAdd}
              >
                <Plus className="h-4 w-4" />
                Add variable
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={variableColumns}
            data={variables}
            getRowKey={(v) => v.id || v.key}
          />
        )}
      </SectionCard>

      <SectionCard title="Cache" description="Delivery and rendition caches.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={purging}
            onClick={handlePurge}
            className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
          >
            {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Purge CDN cache
          </Button>
          <Button
            variant="outline"
            disabled={rebuilding}
            onClick={handleRebuild}
            className="border-border bg-surface-card text-foreground hover:bg-surface-hover"
          >
            {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Rebuild renditions
          </Button>
        </div>
      </SectionCard>

      <DangerZoneCard>
        <SettingsList>
          <SettingRow
            title="Reset settings to defaults"
            description="Visibility, limits, toggles and variables return to defaults."
            control={
              <Button
                variant="outline"
                onClick={() => setResetOpen(true)}
                className="border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                Reset settings
              </Button>
            }
          />
          <SettingRow
            title="Transfer project"
            description="Move this project to another organization."
            control={
              <Button
                variant="outline"
                onClick={() => setTransferOpen(true)}
                className="border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                Transfer project
              </Button>
            }
          />
          <SettingRow
            title="Delete project"
            description="Soft-delete this project and leave the workspace."
            control={
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                Delete project
              </Button>
            }
          />
        </SettingsList>
      </DangerZoneCard>

      <VariableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        onDraftChange={setDraft}
        onSave={handleSaveVariable}
        taken={taken}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset settings to defaults?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Visibility, limits, toggles, variables and add-on prefs return
              to their defaults. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              disabled={resetting}
              className="bg-red-500/90 text-white hover:bg-red-500"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Reset settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer this project?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              The project and its settings move to the target organization.
            </DialogDescription>
          </DialogHeader>
          {orgOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
              No other organizations found among your projects.
            </p>
          ) : (
            <SelectField
              label="Target organization"
              value={transferTarget}
              onChange={setTransferTarget}
              options={orgOptions}
              placeholder="Choose an organization"
            />
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setTransferOpen(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!transferTarget || transferring}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {transferring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Transfer project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this project?"
        description={`“${project?.name ?? "This project"}” will be soft-deleted. This can’t be undone.`}
        requireText={project?.name ?? ""}
        confirmLabel={deleting ? "Deleting…" : "Delete project"}
        pending={deleting}
        onConfirm={handleDelete}
      />
    </SecondaryScreenWrapper>
  );
}

export default AdvancedSettingsScreen;
