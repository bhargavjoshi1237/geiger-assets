"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown, FolderPlus } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@geiger/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { SectionCard, Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { TagInput } from "../tag_input";
import { TYPE_OPTIONS, STATUS_OPTIONS } from "../constants";

function FolderCombobox({ value, folders = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? folders.filter((f) => f.toLowerCase().includes(q)) : folders;
  }, [folders, query]);

  const typed = query.trim();
  const canCreate = typed && !folders.some((f) => f.toLowerCase() === typed.toLowerCase());

  const select = (folder) => {
    onChange?.(folder);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-border bg-surface-card font-normal text-foreground hover:bg-surface-hover"
        >
          <span className="truncate">{value || "Choose a folder…"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-text-tertiary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] border-border bg-surface-subtle p-0"
      >
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create a folder…"
            className="h-8 border-border bg-surface-card text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                e.preventDefault();
                select(typed);
              }
            }}
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {matches.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => select(folder)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  folder === value ? "text-primary" : "text-transparent",
                )}
              />
              <span className="truncate">{folder}</span>
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              onClick={() => select(typed)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              <span className="truncate">
                Create &ldquo;{typed}&rdquo;
              </span>
            </button>
          ) : null}
          {!matches.length && !canCreate ? (
            <p className="px-2 py-3 text-center text-xs text-text-tertiary">
              No folders yet.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DetailsSection({ asset, folders = [], onPatch }) {
  if (!asset) return null;
  const patch = onPatch || (() => {});

  return (
    <SectionCard title="Details">
      <div className="grid gap-4">
        <Field label="Name" htmlFor="asset-name">
          <Input
            id="asset-name"
            value={asset.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="Description" htmlFor="asset-desc">
          <Textarea
            id="asset-desc"
            value={asset.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Add a description…"
            className="min-h-20 border-border bg-surface-card text-foreground"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={asset.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={asset.type} onValueChange={(v) => patch({ type: v })}>
              <SelectTrigger className="border-border bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-surface-subtle text-foreground">
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Folder" hint="Pick an existing folder or type a new name to create one.">
          <FolderCombobox
            value={asset.folder}
            folders={folders}
            onChange={(folder) => patch({ folder })}
          />
        </Field>
        <Field label="Tags" hint="Press Enter or comma to add a tag.">
          <TagInput value={asset.tags} onChange={(tags) => patch({ tags })} />
        </Field>
      </div>
    </SectionCard>
  );
}

export default DetailsSection;
