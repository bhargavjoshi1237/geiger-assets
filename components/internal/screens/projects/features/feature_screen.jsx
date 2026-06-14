"use client";

import React from "react";
import {
  ArrowRight,
  Check,
  CircleDashed,
  Layers3,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ScreenHeader,
  SectionCard,
  StatGrid,
} from "@/components/internal/shared/screen_kit";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  featureDomains,
  featureItemsByTitle,
} from "@/components/internal/sidebar/projects/feature_registry";

const maturityStyles = {
  "In progress": "border-blue-400/20 bg-blue-400/10 text-blue-300",
  Planned: "border-amber-400/20 bg-amber-400/10 text-amber-300",
};

export function FeatureScreen({ title, onNavigate }) {
  const item = featureItemsByTitle.get(title);

  if (!item) {
    return null;
  }

  const domain = featureDomains.find((entry) => entry.title === item.domain);
  const related = domain?.features.filter((entry) => entry.title !== title).slice(0, 5) || [];
  const Icon = item.icon;

  return (
    <MainScreenWrapper className="dark">
      <ScreenHeader
        title={item.title}
        description={item.description}
        actions={
          <Badge
            variant="outline"
            className={maturityStyles[item.maturity] || maturityStyles.Planned}
          >
            <CircleDashed className="h-3 w-3" />
            {item.maturity}
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="rounded-md border-border bg-surface-card px-2.5 py-1 text-text-secondary"
        >
          <Layers3 className="h-3.5 w-3" />
          {item.domain}
        </Badge>
        <Badge
          variant="outline"
          className="rounded-md border-border bg-surface-card px-2.5 py-1 text-text-secondary"
        >
          <Sparkles className="h-3.5 w-3" />
          Competitor researched
        </Badge>
      </div>

      <StatGrid
        columns={3}
        stats={[
          {
            label: "Included capabilities",
            value: String(item.capabilities.length),
            hint: "Normalized functions in this workspace",
            icon: Check,
          },
          {
            label: "Product domain",
            value: item.domain,
            hint: domain?.description,
            icon: item.domainIcon,
          },
          {
            label: "Implementation",
            value: item.maturity,
            hint:
              item.maturity === "In progress"
                ? "A working screen or foundation exists"
                : "Navigation and scope are defined",
            icon: CircleDashed,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <SectionCard
          title="Feature scope"
          description="Functions gathered from the current DAM competitor research."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {item.capabilities.map((capability, index) => (
              <div
                key={capability}
                className="group flex min-h-16 items-start gap-3 rounded-xl border border-border bg-surface-card px-3.5 py-3 transition-colors hover:bg-surface-hover"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-xs font-semibold tabular-nums text-text-secondary">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-sm font-medium leading-5 text-foreground">
                    {capability}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Workspace status"
            description="This entry is now part of the product information architecture."
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Scope registered
                    </p>
                    <p className="text-xs text-text-secondary">
                      Ready for prioritization and implementation.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-text-tertiary">
                Navigation availability does not mean the operational workflow is
                complete. Each feature can be replaced with a dedicated screen as
                product work progresses.
              </p>
            </div>
          </SectionCard>

          {related.length ? (
            <SectionCard
              title={`More in ${item.domain}`}
              description="Adjacent capabilities in the same product domain."
              bodyPadding={false}
            >
              <div className="divide-y divide-border">
                {related.map((relatedItem) => {
                  const RelatedIcon = relatedItem.icon;

                  return (
                    <Button
                      key={relatedItem.title}
                      type="button"
                      variant="ghost"
                      onClick={() => onNavigate?.(relatedItem.title)}
                      className="h-auto w-full justify-start rounded-none px-5 py-3 text-left hover:bg-surface-hover"
                    >
                      <RelatedIcon className="h-4 w-4 shrink-0 text-text-secondary" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {relatedItem.title}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    </Button>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </MainScreenWrapper>
  );
}
