"use client";

import React, { useMemo } from "react";
import { Blocks } from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Badge } from "@geiger/ui/badge";
import { Switch } from "@geiger/ui/switch";
import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { useProjectSettings } from "./use_project_settings";
import { ADDON_CATALOG } from "./constants";

// Add-ons — installable capability toggles with state and short descriptions.
// Every toggle persists immediately through lib/supabase/settings.js as
// settings.addons[id]; nothing here is a stub.

export function AddonsScreen({ projectId }) {
  const { settings, loading, save } = useProjectSettings(projectId);

  const enabledCount = useMemo(
    () => ADDON_CATALOG.filter((addon) => settings.addons?.[addon.id]).length,
    [settings],
  );

  const setAddon = async (id, enabled) =>
    save(
      { addons: { ...(settings.addons || {}), [id]: enabled } },
      { error: "Couldn't save that add-on." },
    );

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Add-ons"
        description={`${enabledCount} of ${ADDON_CATALOG.length} capabilities installed. Changes apply immediately.`}
      />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading add-ons" />
        </div>
      ) : (
        <SectionCard
          title="Capabilities"
          description="Install only what this workspace uses — everything else stays out of the way."
          action={
            <Badge variant={enabledCount > 0 ? "success" : "neutral"}>
              {enabledCount} installed
            </Badge>
          }
        >
          <SettingsList>
            {ADDON_CATALOG.map((addon) => {
              const enabled = Boolean(settings.addons?.[addon.id]);
              return (
                <SettingRow
                  key={addon.id}
                  title={addon.label}
                  description={addon.description}
                  icon={Blocks}
                  control={
                    <div className="flex items-center gap-2">
                      <Badge variant={enabled ? "success" : "neutral"}>
                        {enabled ? "Installed" : "Off"}
                      </Badge>
                      <Switch
                        checked={enabled}
                        aria-label={`${enabled ? "Uninstall" : "Install"} ${addon.label}`}
                        onCheckedChange={(value) => setAddon(addon.id, value)}
                      />
                    </div>
                  }
                />
              );
            })}
          </SettingsList>
        </SectionCard>
      )}
    </SecondaryScreenWrapper>
  );
}

export default AddonsScreen;
