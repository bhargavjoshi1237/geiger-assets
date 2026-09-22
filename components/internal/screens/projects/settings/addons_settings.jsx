"use client";

// Add-ons — the installed catalog with enable switches, nav positions and
// accent colours. Toggles apply to the registry context immediately and
// persist through patchSection("addons", …), rolling back on a falsy write.
// The registry hydrates from the project's persisted prefs on mount.

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  LayoutGrid,
  LayoutList,
  LucidePackagePlus,
} from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  LoadingArea,
  ScreenHeader,
} from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Switch } from "@geiger/ui/switch";
import {
  getInstalledAddons,
  useAddonRegistry,
} from "@/addons/registry";
import { projectNav } from "@/components/internal/sidebar/projects/sidebar_data";
import { cn } from "@/lib/utils";
import { useProjectSettings } from "./settings_kit";

const ACCENT_CHOICES = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#f97316",
];

function AddonCard({
  addon,
  enabled,
  positionOptions,
  selectValue,
  currentColor,
  onToggle,
  onPositionChange,
  onColorChange,
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = addon.icon;
  const effectiveColor = currentColor || addon.color;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300",
        enabled
          ? "border-border bg-surface-subtle shadow-sm hover:border-border-strong"
          : "border-border bg-background opacity-60 hover:opacity-75",
      )}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
            enabled ? "" : "border-border bg-surface-subtle",
          )}
          style={
            enabled
              ? {
                  backgroundColor: `${effectiveColor}10`,
                  borderColor: `${effectiveColor}30`,
                }
              : undefined
          }
        >
          {Icon ? (
            <Icon
              className="h-5 w-5 transition-colors duration-300"
              style={{ color: enabled ? effectiveColor : "var(--muted-foreground)" }}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-foreground">
              {addon.name}
            </span>
            <Badge className="h-4 border-border bg-surface-subtle px-1.5 text-[9px] font-medium text-muted-foreground hover:bg-surface-subtle">
              v{addon.version}
            </Badge>
            <Badge className="h-4 border-border bg-surface-subtle px-1.5 text-[9px] font-medium text-muted-foreground hover:bg-surface-subtle">
              {addon.category}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-sm leading-relaxed text-muted-foreground">
            {addon.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {enabled ? (
            <div className="mr-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Active
            </div>
          ) : null}
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label={`${enabled ? "Disable" : "Enable"} ${addon.name}`}
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        variant="ghost"
        className="flex h-auto w-full items-center justify-center gap-1.5 rounded-none rounded-b-xl border-t border-border py-2.5 transition-colors duration-200 hover:bg-surface-hover"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[11px] font-medium text-muted-foreground">
          {expanded ? "Less details" : "More details"}
        </span>
      </Button>

      {expanded ? (
        <div className="space-y-5 border-t border-border p-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Features
            </span>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {(addon.features || []).join(". ") + "."}
            </p>
          </div>

          {enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full border-2 border-border-strong">
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: effectiveColor }}
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[12px] text-foreground">Accent color</span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Custom color for the sidebar icon and UI accents
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {ACCENT_CHOICES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onColorChange(color)}
                      aria-label={`Accent ${color}`}
                      aria-pressed={effectiveColor === color}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-all hover:scale-110",
                        effectiveColor === color
                          ? "scale-110 border-foreground shadow-lg"
                          : "border-border hover:border-border-strong",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {addon.navItem ? (
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 shrink-0 text-text-tertiary" />
                  <div className="flex-1">
                    <span className="text-[12px] text-foreground">Sidebar position</span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Choose where this add-on appears in the navigation sidebar
                    </p>
                  </div>
                  <Select value={selectValue} onValueChange={onPositionChange}>
                    <SelectTrigger
                      aria-label={`${addon.name} sidebar position`}
                      className="h-8 min-w-[180px] w-auto border-border bg-surface-card text-xs text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-surface-subtle">
                      {positionOptions.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-xs text-foreground focus:bg-surface-hover focus:text-foreground"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AddonsSettingsScreen({ projectId }) {
  const { settings, loading, patchSection } = useProjectSettings(projectId);
  const {
    enabledAddons,
    isAddonEnabled,
    toggleAddon,
    navPositions,
    setAddonNavPosition,
    addonColors,
    setAddonColor,
  } = useAddonRegistry();
  const installedAddons = getInstalledAddons();
  const hydratedRef = useRef(null);

  const [compactView, setCompactView] = useState(false);

  // Hydrate the registry from the project's persisted add-on prefs. Runs per
  // project; user edits persist afterwards (guarded by hydratedRef so the
  // hydration itself never writes).
  useEffect(() => {
    if (loading || !projectId || hydratedRef.current === projectId) return;
    hydratedRef.current = projectId;
    const prefs = settings.addons;
    installedAddons.forEach((addon) => {
      const shouldBeEnabled = prefs.enabled.includes(addon.id);
      if (shouldBeEnabled !== isAddonEnabled(addon.id)) {
        toggleAddon(addon.id);
      }
      const position = prefs.navPositions[addon.id];
      if (position !== undefined) {
        setAddonNavPosition(addon.id, position);
      }
      const color = prefs.colors[addon.id];
      if (color !== undefined && color !== null) {
        setAddonColor(addon.id, color);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, projectId]);

  const handleToggle = async (addonId) => {
    const nextEnabled = enabledAddons.includes(addonId)
      ? enabledAddons.filter((id) => id !== addonId)
      : [...enabledAddons, addonId];
    toggleAddon(addonId);
    const saved = await patchSection("addons", {
      enabled: nextEnabled,
      navPositions,
      colors: addonColors,
    });
    if (!saved) {
      toggleAddon(addonId);
      toast.error("Couldn't save add-on preferences.");
    }
  };

  const handlePositionChange = (addonId) => async (val) => {
    const prev = navPositions[addonId];
    const position =
      val === "auto" ? null : val === "end" ? projectNav.length - 1 : Number(val);
    const nextPositions = { ...navPositions, [addonId]: position };
    setAddonNavPosition(addonId, position);
    const saved = await patchSection("addons", {
      enabled: enabledAddons,
      navPositions: nextPositions,
      colors: addonColors,
    });
    if (!saved) {
      setAddonNavPosition(addonId, prev ?? null);
      toast.error("Couldn't save add-on preferences.");
    }
  };

  const handleColorChange = (addon) => async (color) => {
    const prev = addonColors[addon.id];
    const nextColor = color === addon.color ? null : color;
    const nextColors = { ...addonColors, [addon.id]: nextColor };
    setAddonColor(addon.id, nextColor);
    const saved = await patchSection("addons", {
      enabled: enabledAddons,
      navPositions,
      colors: nextColors,
    });
    if (!saved) {
      setAddonColor(addon.id, prev ?? null);
      toast.error("Couldn't save add-on preferences.");
    }
  };

  const positionOptions = projectNav.map((item, idx) => ({
    value: String(idx),
    label: `Before "${item.title}"`,
  }));
  positionOptions.push({
    value: "end",
    label: 'At the end (before "Settings")',
  });
  positionOptions.push({
    value: "auto",
    label: "Auto (default)",
  });

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader
          title="Add-ons"
          description="Optional modules that add screens and capabilities."
        />
        <LoadingArea size={56} label="Loading add-ons" />
      </SecondaryScreenWrapper>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Add-ons"
        description="Optional modules that add screens and capabilities."
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={compactView ? "Switch to list view" : "Switch to grid view"}
            title={compactView ? "Switch to list view" : "Switch to grid view"}
            onClick={() => setCompactView((v) => !v)}
            className={cn(
              "h-8 w-8 border border-border",
              compactView
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : "bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {compactView ? (
              <LayoutList className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
        }
      />

      {installedAddons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background">
          <EmptyState
            icon={LucidePackagePlus}
            title="No add-ons installed"
            description="Add-ons will appear here when installed."
          />
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3 transition-all duration-300",
            compactView ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {installedAddons.map((addon) => {
            const enabled = isAddonEnabled(addon.id);
            const currentPosition = navPositions[addon.id];
            const selectValue =
              currentPosition === undefined || currentPosition === null
                ? "auto"
                : String(currentPosition);
            const currentColor = addonColors[addon.id];

            return (
              <AddonCard
                key={addon.id}
                addon={addon}
                enabled={enabled}
                positionOptions={positionOptions}
                selectValue={selectValue}
                currentColor={currentColor}
                onToggle={() => handleToggle(addon.id)}
                onPositionChange={handlePositionChange(addon.id)}
                onColorChange={handleColorChange(addon)}
              />
            );
          })}
        </div>
      )}
    </SecondaryScreenWrapper>
  );
}

export default AddonsSettingsScreen;
