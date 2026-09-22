"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

const AddonRegistryContext = createContext();

const INSTALLED_ADDONS = [];
const DEFAULT_ENABLED_ADDONS = ["brand-kit"];

export function loadAddon(addonModule) {
  const existing = INSTALLED_ADDONS.findIndex((a) => a.id === addonModule.id);
  if (existing !== -1) {
    INSTALLED_ADDONS[existing] = addonModule;
  } else {
    INSTALLED_ADDONS.push(addonModule);
  }
}

export function getInstalledAddons() {
  return INSTALLED_ADDONS;
}

export function getEnabledAddons(enabledIds) {
  return INSTALLED_ADDONS.filter((addon) => enabledIds.includes(addon.id));
}

export function getAddonScreens(enabledIds) {
  const screens = {};
  getEnabledAddons(enabledIds).forEach((addon) => {
    addon.screens.forEach((screen) => {
      screens[screen.id] = screen.component;
    });
    if (addon.navItem?.subItems) {
      addon.screens.forEach((screen) => {
        if (screen.navLabel) {
          screens[screen.navLabel] = screen.component;
        }
      });
    }
  });
  return screens;
}

export function getAddonScreenOptions(enabledIds) {
  const options = {};
  getEnabledAddons(enabledIds).forEach((addon) => {
    addon.screens.forEach((screen) => {
      options[screen.id] = {
        fullBleed: Boolean(screen.fullBleed),
      };
    });
  });
  return options;
}

export function getAddonNavItems(enabledIds, navPositions = {}, addonColors = {}) {
  const items = [];
  getEnabledAddons(enabledIds).forEach((addon) => {
    if (addon.navItem) {
      const item = { ...addon.navItem, addonId: addon.id };
      if (addon.navItem.subItems) {
        item.subItems = addon.navItem.subItems;
      }
      if (addonColors[addon.id]) {
        item.iconColor = addonColors[addon.id];
      }
      items.push(item);
    }
  });

  if (Object.keys(navPositions).length === 0) return items;

  const sorted = items.map((item) => {
    const pos = navPositions[item.addonId];
    return pos !== undefined && pos !== null
      ? { ...item, _sortPos: pos }
      : { ...item, _sortPos: 9999 };
  });

  sorted.sort((a, b) => a._sortPos - b._sortPos);
  return sorted.map(({ _sortPos, ...item }) => item);
}

export function mergeNavWithAddons(baseNav, addonNavItems) {
  if (!addonNavItems || addonNavItems.length === 0) return baseNav;
  const merged = [...baseNav];
  const getSettingsIndex = () => merged.findIndex((item) => item.title === "Settings");
  const insertBeforeSettings = (addonItem) => {
    const settingsIndex = getSettingsIndex();
    if (settingsIndex === -1) {
      merged.push(addonItem);
    } else {
      merged.splice(settingsIndex, 0, addonItem);
    }
  };

  addonNavItems.forEach((addonItem) => {
    const insertAfter = addonItem.insertAfter;
    const settingsIndex = getSettingsIndex();

    if (insertAfter) {
      const idx = merged.findIndex((item) => item.title === insertAfter);
      if (idx !== -1 && (settingsIndex === -1 || idx < settingsIndex)) {
        merged.splice(idx + 1, 0, addonItem);
      } else {
        insertBeforeSettings(addonItem);
      }
    } else {
      insertBeforeSettings(addonItem);
    }
  });
  return merged;
}

// `initialEnabledAddons` lets a host start from a different set. Set at
// initial state rather than corrected in an effect, so no child can mount
// against the wrong set.
export function AddonRegistryProvider({
  children,
  initialEnabledAddons = DEFAULT_ENABLED_ADDONS,
}) {
  const [enabledAddons, setEnabledAddons] = useState(initialEnabledAddons);
  const [navPositions, setNavPositions] = useState({});
  const [addonColors, setAddonColors] = useState({});

  const toggleAddon = useCallback((addonId) => {
    setEnabledAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  }, []);

  const isAddonEnabled = useCallback(
    (addonId) => enabledAddons.includes(addonId),
    [enabledAddons]
  );

  const setAddonNavPosition = useCallback((addonId, position) => {
    setNavPositions((prev) => ({ ...prev, [addonId]: position }));
  }, []);

  const setAddonColor = useCallback((addonId, color) => {
    setAddonColors((prev) => ({ ...prev, [addonId]: color }));
  }, []);

  return (
    <AddonRegistryContext.Provider
      value={{ enabledAddons, toggleAddon, isAddonEnabled, navPositions, setAddonNavPosition, addonColors, setAddonColor }}
    >
      {children}
    </AddonRegistryContext.Provider>
  );
}

export function useAddonRegistry() {
  const context = useContext(AddonRegistryContext);
  if (context === undefined) {
    throw new Error(
      "useAddonRegistry must be used within an AddonRegistryProvider"
    );
  }
  return context;
}
