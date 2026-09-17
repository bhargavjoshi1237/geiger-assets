"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Captions,
  Copy,
  Film,
  KeyRound,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { LogoLoading } from "@geiger/ui";

import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { ActionMenu } from "@geiger/ui/action-menu";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import FilterDropdown from "@/components/internal/screens/projects/home/filter_dropdown";
import { listAssets } from "@/lib/supabase/assets";
import {
  createVideoConfig,
  listVideoConfigs,
  updateVideoConfig,
} from "@/lib/supabase/delivery";
import {
  CAPTION_LANGUAGE_OPTIONS,
  POSTER_VARIANT_OPTIONS,
  VIDEO_RENDITION_ROWS,
  formatBytes,
  formatDate,
} from "./constants";

// Video Delivery — player configuration, poster images, captions, and signed
// streams for video assets.
//
// Transcoding is NOT available in this deployment: there is no ffmpeg, so the
// derive pipeline returns null for video originals and delivery falls back to
// the file itself. The rendition ladder below is therefore configuration with
// a clear "not yet available" state — it never pretends a rendition exists,
// and there is no embedded player faking adaptive playback.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const CONFIG_FILTER_OPTIONS = [
  { value: "all", label: "All videos" },
  { value: "configured", label: "Configured" },
  { value: "unconfigured", label: "Not configured" },
];

const VIDEO_STATUS_MAP = {
  configured: { label: "Configured", variant: "success", dotClass: "bg-emerald-400" },
  draft: { label: "Not configured", variant: "neutral", dotClass: "bg-zinc-400" },
};

function isVideoAsset(asset) {
  if (!asset) return false;
  if (String(asset.type || "").toLowerCase() === "video") return true;
  return String(asset.mimeType || "").toLowerCase().startsWith("video/");
}

// Keyed by asset id so switching videos always starts from the stored row.
function PlayerConfigEditor({ asset, config, saving, onSave }) {
  const [autoplay, setAutoplay] = useState(config?.autoplay ?? false);
  const [muted, setMuted] = useState(config?.muted ?? true);
  const [loopEnabled, setLoopEnabled] = useState(config?.loopEnabled ?? false);
  const [showControls, setShowControls] = useState(config?.showControls ?? true);
  const [posterVariant, setPosterVariant] = useState(config?.posterVariant ?? "poster");
  const [captionsEnabled, setCaptionsEnabled] = useState(config?.captionsEnabled ?? false);
  const [captionsLanguage, setCaptionsLanguage] = useState(config?.captionsLanguage ?? "en");
  const [signedUrls, setSignedUrls] = useState(config?.signedUrls ?? false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Autoplay" hint="Starts muted where browsers require it.">
        <div className="flex h-9 items-center">
          <Switch checked={autoplay} onCheckedChange={setAutoplay} aria-label="Autoplay" />
        </div>
      </Field>
      <Field label="Muted by default" hint="Required for autoplay on most browsers.">
        <div className="flex h-9 items-center">
          <Switch checked={muted} onCheckedChange={setMuted} aria-label="Muted by default" />
        </div>
      </Field>
      <Field label="Loop" hint="Restart when playback reaches the end.">
        <div className="flex h-9 items-center">
          <Switch checked={loopEnabled} onCheckedChange={setLoopEnabled} aria-label="Loop" />
        </div>
      </Field>
      <Field label="Player controls" hint="Scrubber, volume, and fullscreen affordances.">
        <div className="flex h-9 items-center">
          <Switch checked={showControls} onCheckedChange={setShowControls} aria-label="Player controls" />
        </div>
      </Field>
      <Field label="Poster image" htmlFor="player-poster" hint="Still shown before playback starts.">
        <Select value={posterVariant} onValueChange={setPosterVariant}>
          <SelectTrigger id="player-poster" className="bg-surface-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSTER_VARIANT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Caption language" htmlFor="player-captions-lang">
        <Select value={captionsLanguage} onValueChange={setCaptionsLanguage}>
          <SelectTrigger id="player-captions-lang" className="bg-surface-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAPTION_LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Captions" hint="Expose a caption track in the configured language.">
        <div className="flex h-9 items-center gap-2">
          <Switch checked={captionsEnabled} onCheckedChange={setCaptionsEnabled} aria-label="Captions" />
          <Captions className="h-4 w-4 text-text-tertiary" />
        </div>
      </Field>
      <Field label="Signed streams" hint="Mint expiring URLs per viewer instead of stable ones.">
        <div className="flex h-9 items-center gap-2">
          <Switch checked={signedUrls} onCheckedChange={setSignedUrls} aria-label="Signed streams" />
          <KeyRound className="h-4 w-4 text-text-tertiary" />
        </div>
      </Field>
      <div className="sm:col-span-2">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving}
          onClick={() =>
            onSave(asset, {
              autoplay,
              muted,
              loopEnabled,
              showControls,
              posterVariant,
              captionsEnabled,
              captionsLanguage,
              signedUrls,
            })
          }
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save player config"
          )}
        </Button>
      </div>
    </div>
  );
}

export function VideoDeliveryScreen({ projectId }) {
  const [videos, setVideos] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [configFilter, setConfigFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signedUrl, setSignedUrl] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([listAssets(projectId), listVideoConfigs(projectId)]).then(
      ([assetRows, configRows]) => {
        if (!alive) return;
        const list = (assetRows ?? []).filter(isVideoAsset);
        setVideos(list);
        setConfigs(configRows ?? []);
        if (list.length > 0) setSelectedId(list[0].id);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const configByAsset = useMemo(() => {
    const map = new Map();
    for (const config of configs) {
      if (config.assetId) map.set(config.assetId, config);
    }
    return map;
  }, [configs]);

  const stats = useMemo(
    () => [
      { label: "Videos", value: String(videos.length), footer: "video assets in this project" },
      { label: "Configured", value: String(configs.length), footer: "with a saved player config" },
      {
        label: "Captions on",
        value: String(configs.filter((c) => c.captionsEnabled).length),
        footer: "exposing a caption track",
      },
      {
        label: "Signed streams",
        value: String(configs.filter((c) => c.signedUrls).length),
        footer: "requiring expiring URLs",
      },
    ],
    [videos, configs],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return videos.filter((video) => {
      const configured = configByAsset.has(video.id);
      if (configFilter === "configured" && !configured) return false;
      if (configFilter === "unconfigured" && configured) return false;
      if (needle && !`${video.name} ${video.format}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [videos, configByAsset, search, configFilter]);

  const filtersActive = configFilter !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setConfigFilter("all");
    setSearch("");
  };

  const selected = useMemo(
    () => videos.find((video) => video.id === selectedId) || null,
    [videos, selectedId],
  );

  const selectVideo = (video) => {
    setSelectedId(video.id);
    setSignedUrl("");
  };

  const saveConfig = async (asset, draft) => {
    setSaving(true);
    const existing = configByAsset.get(asset.id);
    if (existing) {
      const previous = configs;
      setConfigs((rows) => rows.map((c) => (c.id === existing.id ? { ...c, ...draft } : c)));
      const saved = await updateVideoConfig(existing.id, draft);
      setSaving(false);
      if (!saved) {
        setConfigs(previous);
        toast.error("Could not save the player config.");
        return;
      }
      setConfigs((rows) => rows.map((c) => (c.id === saved.id ? saved : c)));
      toast.success(`Saved player config for ${asset.name || "video"}.`);
      return;
    }
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      assetId: asset.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };
    setConfigs((rows) => [optimistic, ...rows]);
    const created = await createVideoConfig({ id, projectId, assetId: asset.id, ...draft });
    setSaving(false);
    if (!created) {
      setConfigs((rows) => rows.filter((c) => c.id !== id));
      toast.error("Could not save the player config.");
      return;
    }
    setConfigs((rows) => rows.map((c) => (c.id === id ? created : c)));
    toast.success(`Saved player config for ${asset.name || "video"}.`);
  };

  const mintSignedStream = async () => {
    if (!selected || signing) return;
    setSigning(true);
    try {
      const res = await fetch(`${BASE}/api/media/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selected.id,
          variant: "original",
          scope: "view",
          ttlSeconds: 3600,
        }),
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok || !payload?.url) {
        toast.error(
          payload?.error === "signing_unconfigured"
            ? "Token signing is not configured on the server."
            : "Could not mint a signed stream URL.",
        );
        return;
      }
      setSignedUrl(payload.url);
      toast.success("Signed stream URL minted — expires in 1 hour.");
    } catch (e) {
      console.error("[videoDelivery.sign]", e);
      toast.error("Could not mint a signed stream URL.");
    } finally {
      setSigning(false);
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  };

  const columns = [
    {
      key: "video",
      header: "Video",
      render: (video) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="max-w-[260px] truncate font-medium text-foreground">
            {video.name || "Untitled video"}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {[video.format, formatBytes(video.sizeBytes)].filter(Boolean).join(" · ") || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "config",
      header: "Player",
      render: (video) => (
        <StatusPill
          status={configByAsset.has(video.id) ? "configured" : "draft"}
          map={VIDEO_STATUS_MAP}
        />
      ),
    },
    {
      key: "updated",
      header: "Updated",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (video) => formatDate(video.updatedAt),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (video) => (
        <ActionMenu
          label={`Actions for ${video.name}`}
          items={[
            {
              icon: Film,
              label: "Configure player",
              onSelect: () => selectVideo(video),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Video Delivery"
        description="Stream optimized video experiences."
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            value={configFilter}
            onValueChange={setConfigFilter}
            options={CONFIG_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Search videos…" />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-border bg-surface-subtle px-6 py-16">
          <LogoLoading size={56} aria-label="Loading video delivery" />
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Film}
            title="No videos yet"
            description="Upload a video asset to configure its player, posters, and captions."
          />
        </div>
      ) : (
        <div className="space-y-6">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(video) => video.id}
            onRowClick={selectVideo}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Film}
                  title="No videos match these filters"
                  description="Try a different configuration state or search term."
                  action={
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </div>
            }
          />

          {selected ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title={`Player — ${selected.name || "Untitled video"}`}
                description="Saved per video. Applies wherever this asset is embedded."
              >
                <PlayerConfigEditor
                  key={selected.id}
                  asset={selected}
                  config={configByAsset.get(selected.id)}
                  saving={saving}
                  onSave={saveConfig}
                />
              </SectionCard>

              <div className="space-y-6">
                <SectionCard
                  title="Signed streams"
                  description="Expiring bearer URLs minted by the share route — no session required to play."
                  action={
                    <Button
                      variant="outline"
                      className="border-border bg-surface-card text-foreground hover:bg-surface-active"
                      onClick={mintSignedStream}
                      disabled={signing}
                    >
                      {signing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      Mint URL
                    </Button>
                  }
                >
                  {signedUrl ? (
                    <div className="space-y-2">
                      <div className="break-all rounded-md border border-border bg-surface-card px-3 py-2 font-mono text-xs text-foreground">
                        {signedUrl}
                      </div>
                      <Button
                        variant="ghost"
                        className="text-text-secondary hover:text-foreground"
                        onClick={() => copyText(signedUrl, "Signed URL")}
                      >
                        <Copy className="h-4 w-4" /> Copy URL
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      Mint an expiring playback URL for this video. The token names one asset
                      and one variant and stops working at expiry.
                    </p>
                  )}
                </SectionCard>

                <SectionCard
                  title="Adaptive renditions"
                  description="Why this ladder stays dark."
                >
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Transcoding is not yet available — this deployment has no ffmpeg, so
                      these controls are configuration only. Delivery serves the original
                      file until renditions exist.
                    </span>
                  </div>
                  <div className="space-y-2">
                    {VIDEO_RENDITION_ROWS.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2 opacity-70"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {row.label}
                          </span>
                          <span className="block truncate text-[11px] text-text-tertiary">
                            {row.detail}
                          </span>
                        </span>
                        <Badge variant="neutral">Not yet available</Badge>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default VideoDeliveryScreen;
