"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@geiger/ui/badge";
import { cn } from "@/lib/utils";
import { normalizeTag } from "./constants";

export function TagInput({ value = [], onChange, placeholder = "Add tags…", className }) {
  const [draft, setDraft] = useState("");
  const tags = Array.isArray(value) ? value : [];

  const commit = (raw) => {
    const tag = normalizeTag(raw);
    setDraft("");
    if (!tag || tags.some((t) => normalizeTag(t) === tag)) return;
    onChange?.([...tags, tag]);
  };

  const remove = (tag) => onChange?.(tags.filter((t) => t !== tag));

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(e.target.value);
      return;
    }
    if (e.key === "Backspace" && !e.target.value && tags.length) {
      e.preventDefault();
      remove(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-2",
        className,
      )}
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className="gap-1 border-border bg-surface-subtle text-[11px] text-muted-foreground"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => remove(tag)}
            className="text-text-tertiary hover:text-red-400"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}

        onBlur={(e) => commit(e.target.value)}
        placeholder={tags.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-text-tertiary"
      />
    </div>
  );
}

export default TagInput;
