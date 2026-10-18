"use client";

import React, { useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Slider } from "@geiger/ui/slider";
import { cn } from "@/lib/utils";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

// Suite-styled replacement for the browser's native <audio controls>: the
// element stays hidden and drives play/pause, seek, and volume state.
export function AudioPlayer({ src, onError, className }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const ended = duration > 0 && current >= duration;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      if (ended) el.currentTime = 0;
      setLoading(true);
      el.play().catch(() => setLoading(false));
    } else {
      el.pause();
    }
  };

  const seek = ([value]) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = value;
    setCurrent(value);
  };

  const changeVolume = ([value]) => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = value;
    el.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    const next = !muted;
    el.muted = next;
    setMuted(next);
    if (!next && volume === 0) changeVolume([1]);
  };

  const PlayIcon = loading ? Loader2 : playing ? Pause : ended ? RotateCcw : Play;
  const VolumeIcon = muted || volume === 0 ? VolumeX : Volume2;

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-border bg-surface-card px-3 py-2.5",
        className,
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPlaying={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPause={() => {
          setPlaying(false);
          setLoading(false);
        }}
        onEnded={() => setPlaying(false)}
        onError={onError}
      />

      <Button
        size="icon"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <PlayIcon
          className={cn("h-4 w-4", loading && "animate-spin", !loading && !playing && !ended && "ml-0.5")}
          fill={!loading && !ended ? "currentColor" : "none"}
        />
      </Button>

      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-text-secondary">
        {formatTime(current)}
      </span>
      <Slider
        value={[Math.min(current, duration || 0)]}
        max={duration || 1}
        step={0.1}
        disabled={!duration}
        onValueChange={seek}
        aria-label="Seek"
        className="min-w-0 flex-1"
      />
      <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-text-tertiary">
        {formatTime(duration)}
      </span>

      <div className="group/volume flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="h-8 w-8 text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <VolumeIcon className="h-4 w-4" />
        </Button>
        <Slider
          value={[muted ? 0 : volume]}
          max={1}
          step={0.05}
          onValueChange={changeVolume}
          aria-label="Volume"
          className="hidden w-16 sm:flex"
        />
      </div>
    </div>
  );
}

export default AudioPlayer;
