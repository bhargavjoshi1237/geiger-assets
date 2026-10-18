"use client";

import React from "react";
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@geiger/ui/select";
import { TRIGGER_CATALOG, groupByGroup } from "./constants";

/** Trigger choices for a Select, grouped (Ingest & review, Commerce…). */
export function TriggerOptions() {
  return groupByGroup(TRIGGER_CATALOG).map((group, index) => (
    <React.Fragment key={group.group}>
      {index > 0 ? <SelectSeparator /> : null}
      <SelectGroup>
        <SelectLabel className="text-[11px] text-text-tertiary">{group.group}</SelectLabel>
        {group.items.map((t) => (
          <SelectItem key={t.key} value={t.key}>
            {t.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </React.Fragment>
  ));
}

export default TriggerOptions;
