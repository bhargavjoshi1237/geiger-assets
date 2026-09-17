"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Package, Terminal } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { API_ENDPOINTS, SDK_GUIDES, SDK_RELEASES, SDK_STARTERS } from "./constants";

// SDKs — copy-paste guides against the real routes, plus version history.
// There is no published package to install: each guide names what it needs
// (usually nothing beyond fetch or node:crypto) and shows a runnable snippet.

function copySnippet(text, label, onDone) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(`${label} copied.`);
      onDone();
    })
    .catch(() => toast.error("Couldn't copy — select the text manually."));
}

function GuideCard({ guide }) {
  const [copied, setCopied] = useState(false);
  return (
    <SectionCard
      title={guide.title}
      description={guide.description}
      action={
        <span className="flex items-center gap-2">
          <Badge variant="neutral">{guide.language}</Badge>
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-surface-card text-foreground hover:bg-surface-active"
            onClick={() =>
              copySnippet(guide.code, "Snippet", () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              })
            }
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </span>
      }
    >
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-xs text-text-secondary">
          <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          {guide.install}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground">
          {guide.code}
        </pre>
      </div>
    </SectionCard>
  );
}

export function SdksScreen() {
  const [search, setSearch] = useState("");

  const guides = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return SDK_GUIDES;
    return SDK_GUIDES.filter((guide) =>
      `${guide.title} ${guide.language} ${guide.description}`.toLowerCase().includes(needle),
    );
  }, [search]);

  const stats = useMemo(
    () => [
      { label: "Guides", value: String(SDK_GUIDES.length), footer: "copy-paste snippets" },
      { label: "Routes covered", value: String(API_ENDPOINTS.length), footer: "documented in API" },
      { label: "Starters", value: String(SDK_STARTERS.length), footer: "example apps" },
      {
        label: "Latest",
        value: SDK_RELEASES[0]?.version || "—",
        footer: SDK_RELEASES[0]?.date || "no releases yet",
      },
    ],
    [],
  );

  const releaseColumns = [
    {
      key: "version",
      header: "Version",
      render: (release) => (
        <span className="font-mono text-[13px] font-medium text-foreground">
          {release.version}
        </span>
      ),
    },
    {
      key: "date",
      header: "Released",
      className: "hidden sm:table-cell",
      headClassName: "hidden sm:table-cell",
      render: (release) => (
        <span className="text-xs text-text-secondary">{release.date}</span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      render: (release) => (
        <span className="text-xs text-text-secondary">{release.notes}</span>
      ),
    },
  ];

  const starterColumns = [
    {
      key: "name",
      header: "Starter",
      render: (starter) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium text-foreground">{starter.name}</span>
          <span className="max-w-[520px] truncate text-xs text-text-secondary">
            {starter.description}
          </span>
        </div>
      ),
    },
    {
      key: "stack",
      header: "Stack",
      className: "hidden md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (starter) => <Badge variant="neutral">{starter.stack}</Badge>,
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="SDKs"
        description="Guides for talking to the API from JavaScript, the browser, and Node — uploads, signed delivery, transforms, and webhook verification."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Package className="h-4 w-4" />
          No package to install — every guide lists what it needs.
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search guides…" />
      </Toolbar>

      {guides.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Package}
            title="No guides match this search"
            description="Try a different term, e.g. upload, webhook, or transform."
            action={
              <Button
                variant="outline"
                className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                onClick={() => setSearch("")}
              >
                Clear search
              </Button>
            }
          />
        </div>
      ) : (
        guides.map((guide) => <GuideCard key={guide.id} guide={guide} />)
      )}

      <SectionCard
        title="Examples & starters"
        description="Skeletons that wire the guides above into a runnable app."
      >
        <DataTable
          columns={starterColumns}
          data={SDK_STARTERS}
          getRowKey={(starter) => starter.name}
        />
      </SectionCard>

      <SectionCard title="Version history" description="What each documented surface added.">
        <DataTable
          columns={releaseColumns}
          data={SDK_RELEASES}
          getRowKey={(release) => release.version}
        />
      </SectionCard>
    </MainScreenWrapper>
  );
}

export default SdksScreen;
