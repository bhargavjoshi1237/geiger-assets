"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Captions, Copy, Film, Image as ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  LoadingArea,
  ScreenHeader,
  SearchInput,
  SectionCard,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { FilterDropdown, RowActions, useModuleRows } from "@/components/internal/shared/module_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { assetFileUrl } from "@/lib/storage/client";

import {
  DEFAULT_LADDER,
  VIDEO_MODE_MAP,
  VIDEO_STATUS_FILTER_OPTIONS,
  VIDEO_STATUS_MAP,
  formatBytes,
  videoEmbedSnippet,
} from "./constants";
import {
  createVideoDelivery,
  listVideoDelivery,
  softDeleteVideoDelivery,
  updateVideoDelivery,
} from "@/lib/supabase/video_delivery";
import { listAssets } from "@/lib/supabase/assets";
import { getUser } from "@/lib/supabase/user";

const DEFAULT_PLAYER = { autoplay: false, muted: false, loop: false, controls: true, preload: "metadata" };

function LadderEditor({ ladder, setLadder }) {
  const [preset, setPreset] = useState("");

  const add = () => {
    const found = DEFAULT_LADDER.find((r) => r.label === preset);
    if (!found) return;
    if (ladder.some((r) => r.label === found.label)) {
      toast.error("That rung is already on the ladder.");
      return;
    }
    setLadder([...ladder, { ...found }]);
    setPreset("");
  };

  return (
    <div className="space-y-2">
      {ladder.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-tertiary">
          No rungs yet — adaptive players fall back to the progressive master.
        </p>
      ) : (
        ladder.map((rung, i) => (
          <div key={`${rung.label}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
            <Badge className="shrink-0 border border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
              {rung.label}
            </Badge>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] tabular-nums text-text-secondary">
              {rung.width}×{rung.height}
            </span>
            <Input
              value={String(rung.bitrateKbps ?? "")}
              onChange={(e) => {
                const bitrateKbps = Number(e.target.value) || 0;
                setLadder(ladder.map((r, j) => (j === i ? { ...r, bitrateKbps } : r)));
              }}
              inputMode="numeric"
              aria-label={`${rung.label} bitrate`}
              className="h-8 w-24 bg-background text-right font-mono text-xs"
            />
            <span className="shrink-0 text-[10px] text-text-tertiary">kbps</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${rung.label}`}
              className="h-7 w-7 shrink-0 text-text-secondary hover:bg-surface-active hover:text-red-300"
              onClick={() => setLadder(ladder.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
      <div className="flex gap-2">
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="bg-surface-card">
            <SelectValue placeholder="Add a rung…" />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_LADDER.map((r) => (
              <SelectItem key={r.label} value={r.label}>
                {r.label} · {r.width}×{r.height} · {r.bitrateKbps} kbps
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="shrink-0 border-border bg-transparent" onClick={add} disabled={!preset}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <p className="text-[11px] text-text-tertiary">
        Rungs describe the stream — generating them stays in Video Processing.
      </p>
    </div>
  );
}

function CaptionsEditor({ captions, setCaptions }) {
  const [lang, setLang] = useState("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!lang.trim() || !url.trim()) {
      toast.error("A caption needs a language and a file URL.");
      return;
    }
    setCaptions([...captions, { lang: lang.trim(), label: label.trim() || lang.trim(), url: url.trim(), is_default: captions.length === 0 }]);
    setLang("");
    setLabel("");
    setUrl("");
  };

  return (
    <div className="space-y-2">
      {captions.map((c, i) => (
        <div key={`${c.lang}-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
          <Captions className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
            {c.label} <span className="font-mono text-[10px] text-text-tertiary">({c.lang})</span>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${c.label} captions`}
            className="h-7 w-7 shrink-0 text-text-secondary hover:bg-surface-active hover:text-red-300"
            onClick={() => setCaptions(captions.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Input value={lang} onChange={(e) => setLang(e.target.value)} placeholder="en" className="bg-surface-card" aria-label="Caption language" />
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="English" className="bg-surface-card" aria-label="Caption label" />
      </div>
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/captions.en.vtt" className="bg-surface-card" aria-label="Caption file URL" />
        <Button variant="outline" className="shrink-0 border-border bg-transparent" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

function DeliveryPanel({ asset, delivery, posters, onSave, onRemove, saving }) {
  const [mode, setMode] = useState(delivery?.streamingMode || "progressive");
  const [ladder, setLadder] = useState(delivery?.ladder || []);
  const [posterId, setPosterId] = useState(delivery?.posterAssetId || "");
  const [captions, setCaptions] = useState(delivery?.captions || []);
  const [signed, setSigned] = useState(!!delivery?.signed);
  const [player, setPlayer] = useState({ ...DEFAULT_PLAYER, ...(delivery?.player || {}) });
  const [status, setStatus] = useState(delivery?.status || "draft");
  const [seedId, setSeedId] = useState(delivery?.id || asset.id);

  const seed = delivery?.id || asset.id;
  if (seed !== seedId) {
    setSeedId(seed);
    setMode(delivery?.streamingMode || "progressive");
    setLadder(delivery?.ladder || []);
    setPosterId(delivery?.posterAssetId || "");
    setCaptions(delivery?.captions || []);
    setSigned(!!delivery?.signed);
    setPlayer({ ...DEFAULT_PLAYER, ...(delivery?.player || {}) });
    setStatus(delivery?.status || "draft");
  }

  const setP = (key) => (value) => setPlayer((p) => ({ ...p, [key]: value }));
  const fileUrl = asset.storageKey ? assetFileUrl(asset.id, {}) : "";
  const snippet = videoEmbedSnippet(asset.id, { streamingMode: mode, player });

  const save = () =>
    onSave(asset, { streamingMode: mode, ladder, posterAssetId: posterId || null, captions, signed, player, status });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {fileUrl ? (
          <video src={fileUrl} controls preload="metadata" className="max-h-56 w-full bg-black" />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-text-tertiary">
            <Film className="h-8 w-8" />
            <p className="text-xs">No playable file yet.</p>
          </div>
        )}
      </div>

      <FieldRow2 label="Streaming mode">
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="bg-surface-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="progressive">Progressive</SelectItem>
            <SelectItem value="hls">HLS (adaptive)</SelectItem>
            <SelectItem value="dash">DASH (adaptive)</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow2>

      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">ABR ladder</p>
        <LadderEditor ladder={ladder} setLadder={setLadder} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">Poster image</p>
        <Select value={posterId} onValueChange={setPosterId}>
          <SelectTrigger className="bg-surface-card"><SelectValue placeholder="No poster…" /></SelectTrigger>
          <SelectContent>
            {posters.length === 0 ? (
              <SelectItem value="none" disabled>No images in the library</SelectItem>
            ) : (
              posters.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">Captions</p>
        <CaptionsEditor captions={captions} setCaptions={setCaptions} />
      </div>

      <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm">
        <span className="text-foreground">Signed streams</span>
        <Switch checked={signed} onCheckedChange={setSigned} />
      </label>

      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">Player</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["controls", "Controls"],
            ["autoplay", "Autoplay"],
            ["muted", "Muted"],
            ["loop", "Loop"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs">
              <span className="text-foreground">{label}</span>
              <Switch checked={!!player[key]} onCheckedChange={setP(key)} />
            </label>
          ))}
        </div>
      </div>

      <FieldRow2 label="Status">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="bg-surface-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow2>

      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">Embed snippet</p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-black/40 p-3 font-mono text-[11px] leading-5 text-text-secondary">{snippet}</pre>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full border-border bg-transparent"
          onClick={() => {
            navigator.clipboard?.writeText(snippet);
            toast.success("Embed snippet copied.");
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Copy snippet
        </Button>
      </div>

      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {delivery ? "Save delivery" : "Enable delivery"}
      </Button>
      {delivery ? (
        <Button variant="ghost" size="sm" className="w-full text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => onRemove(delivery)}>
          <Trash2 className="h-3.5 w-3.5" /> Remove delivery
        </Button>
      ) : null}
    </div>
  );
}

function FieldRow2({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}

export function VideoDeliveryScreen({ projectId }) {
  const [assets] = useModuleRows(listAssets, projectId);
  const [rows, setRows] = useModuleRows(listVideoDelivery, projectId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loading = assets === null || rows === null;
  const videos = (assets ?? []).filter((a) => a.type === "video");
  const posters = (assets ?? []).filter((a) => a.type === "image");
  const deliveries = useMemo(() => rows ?? [], [rows]);

  const byAsset = useMemo(() => new Map(deliveries.map((d) => [d.assetId, d])), [deliveries]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return videos.filter((a) => {
      const d = byAsset.get(a.id);
      if (status !== "all" && (d?.status || "draft") !== status) return false;
      if (term && !`${a.name} ${a.format}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [videos, search, status, byAsset]);

  const openAsset = openId ? videos.find((a) => a.id === openId) ?? null : (filtered[0] || null);

  const stats = useMemo(() => {
    const adaptive = deliveries.filter((d) => d.streamingMode === "hls" || d.streamingMode === "dash").length;
    const signed = deliveries.filter((d) => d.signed).length;
    return [
      { label: "Videos", value: String(videos.length), footer: "Masters & clips" },
      { label: "Configured", value: String(deliveries.length), footer: "Have delivery state" },
      { label: "Adaptive", value: String(adaptive), footer: "HLS / DASH" },
      { label: "Signed", value: String(signed), footer: "Signed streams" },
    ];
  }, [videos, deliveries]);

  const handleSave = async (asset, patch) => {
    const existing = byAsset.get(asset.id);
    setSaving(true);
    if (existing) {
      const previous = existing;
      setRows((prev) => prev.map((d) => (d.id === existing.id ? { ...d, ...patch } : d)));
      const saved = await updateVideoDelivery(existing.id, patch);
      if (saved) {
        setRows((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
        toast.success(`Delivery saved for "${asset.name}".`);
      } else {
        setRows((prev) => prev.map((d) => (d.id === existing.id ? previous : d)));
        toast.error("Couldn't save delivery.");
      }
    } else {
      const user = await getUser();
      const optimistic = { ...patch, id: crypto.randomUUID(), projectId, assetId: asset.id };
      setRows((prev) => [optimistic, ...prev]);
      const saved = await createVideoDelivery({ ...optimistic, createdBy: user?.id || null });
      if (saved) {
        setRows((prev) => prev.map((d) => (d.id === optimistic.id ? saved : d)));
        toast.success(`Delivery enabled for "${asset.name}".`);
      } else {
        setRows((prev) => prev.filter((d) => d.id !== optimistic.id));
        toast.error("Couldn't enable delivery.");
      }
    }
    setSaving(false);
  };

  const handleRemove = async (delivery) => {
    setRows((prev) => prev.filter((d) => d.id !== delivery.id));
    const ok = await softDeleteVideoDelivery(delivery.id);
    if (ok) toast.success("Delivery removed.");
    else {
      setRows((prev) => [delivery, ...prev]);
      toast.error("Couldn't remove delivery.");
    }
  };

  const columns = [
    {
      key: "video",
      header: "Video",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/50">
            {a.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Film className="h-4 w-4 text-text-secondary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="max-w-[240px] truncate text-sm font-medium text-foreground">{a.name}</p>
            <p className="text-[11px] text-text-tertiary">{a.dimensions || "HD"} · {formatBytes(a.sizeBytes)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (a) => {
        const d = byAsset.get(a.id);
        return (
          <Badge className="border border-border bg-surface-card px-1.5 py-0 text-[10px] text-text-secondary">
            {VIDEO_MODE_MAP[d?.streamingMode || "progressive"]?.label || "Progressive"}
          </Badge>
        );
      },
    },
    {
      key: "ladder",
      header: "Ladder",
      className: "hidden text-xs text-text-secondary md:table-cell",
      headClassName: "hidden md:table-cell",
      render: (a) => {
        const d = byAsset.get(a.id);
        if (!d) return "—";
        return d.ladder.length ? `${d.ladder.length} rungs` : "Master only";
      },
    },
    {
      key: "captions",
      header: "Captions",
      className: "hidden text-xs text-text-secondary lg:table-cell",
      headClassName: "hidden lg:table-cell",
      render: (a) => {
        const d = byAsset.get(a.id);
        if (!d?.captions?.length) return "—";
        return d.captions.map((c) => c.lang).join(", ").toUpperCase();
      },
    },
    {
      key: "status",
      header: "Status",
      render: (a) => {
        const d = byAsset.get(a.id);
        return d ? (
          <StatusPill status={d.status} map={VIDEO_STATUS_MAP} className="text-[10px]" />
        ) : (
          <Badge className="border border-dashed border-border px-1.5 py-0 text-[10px] text-text-tertiary">Not configured</Badge>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => {
        const d = byAsset.get(a.id);
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <RowActions
              onEdit={() => setOpenId(a.id)}
              onDelete={d ? () => handleRemove(d) : undefined}
              editLabel="Configure"
              editIcon={d ? undefined : Plus}
            />
          </div>
        );
      },
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Video Delivery"
        description="Stream optimized video — adaptive ladders, posters, captions, and signed playback."
        actions={
          openAsset ? (
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => toast.success("Poster frame captured from the preview.")}
            >
              <ImageIcon className="h-4 w-4" /> Set poster
            </Button>
          ) : null
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <FilterDropdown value={status} onValueChange={setStatus} options={VIDEO_STATUS_FILTER_OPTIONS} height="h-9" />
        <SearchInput value={search} onChange={setSearch} placeholder="Search videos…" />
      </Toolbar>

      {loading ? (
        <LoadingArea panel size={56} label="Loading video delivery…" />
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Film}
            title="No videos yet"
            description="Upload video masters from the Asset Library, then configure how they stream."
          />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(a) => a.id}
            onRowClick={(a) => setOpenId(a.id)}
            empty={
              <div className="rounded-xl border border-border bg-surface-subtle">
                <EmptyState
                  icon={Film}
                  title="No videos match your filters"
                  description="Try clearing the search or status filter."
                />
              </div>
            }
          />
          {openAsset ? (
            <SectionCard
              title={openAsset.name}
              description="Delivery state — transcoding itself stays in Video Processing."
            >
              <DeliveryPanel
                asset={openAsset}
                delivery={byAsset.get(openAsset.id) || null}
                posters={posters}
                onSave={handleSave}
                onRemove={handleRemove}
                saving={saving}
              />
            </SectionCard>
          ) : null}
        </div>
      )}
    </MainScreenWrapper>
  );
}

export default VideoDeliveryScreen;
