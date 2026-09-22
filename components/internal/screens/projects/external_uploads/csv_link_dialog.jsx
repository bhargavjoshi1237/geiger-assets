"use client";

import React, { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@geiger/ui/button";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { Field } from "@/components/internal/shared/screen_kit";
import { FileDropzone } from "@/components/internal/shared/file_dropzone";
import { looksLikeLink, normalizeLink } from "./constants";

const MAX_ROWS = 10000;

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = String(text || "").replace(/^﻿/, "");

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (quoted) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") endField();
    else if (char === "\n") endRow();
    else if (char === "\r") {
    } else field += char;
    if (rows.length >= MAX_ROWS) break;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

function bestColumn(rows) {
  if (!rows.length) return 0;
  const width = Math.max(...rows.map((r) => r.length));
  let best = 0;
  let bestHits = -1;
  for (let col = 0; col < width; col += 1) {
    const hits = rows.reduce((n, r) => n + (looksLikeLink(r[col]) ? 1 : 0), 0);
    if (hits > bestHits) {
      bestHits = hits;
      best = col;
    }
  }
  return best;
}

export function CsvLinkDialog({ open, onOpenChange, onAddLinks }) {
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [column, setColumn] = useState("0");
  const parsingRef = useRef(false);

  const reset = () => {
    setFilename("");
    setRows([]);
    setHasHeader(true);
    setColumn("0");
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file || parsingRef.current) return;
    parsingRef.current = true;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error("That file has no rows.");
        return;
      }

      const header = !parsed[0].some((cell) => looksLikeLink(cell));
      const body = header ? parsed.slice(1) : parsed;
      setFilename(file.name || "links.csv");
      setRows(parsed);
      setHasHeader(header);
      setColumn(String(bestColumn(body.length ? body : parsed)));
    } catch {
      toast.error("Couldn't read that CSV.");
    } finally {
      parsingRef.current = false;
    }
  };

  const bodyRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader]);

  const columnOptions = useMemo(() => {
    if (!rows.length) return [];
    const headerRow = hasHeader ? rows[0] || [] : [];
    const width = Math.max(...rows.map((r) => r.length));
    return Array.from({ length: width }, (_, i) => ({
      value: String(i),
      label: headerRow[i]?.trim() || `Column ${i + 1}`,
    }));
  }, [rows, hasHeader]);

  const { links, skipped, sample } = useMemo(() => {
    const index = Number(column) || 0;
    const seen = new Set();
    const out = [];
    let bad = 0;
    for (const row of bodyRows) {
      const cell = row[index];
      if (!cell || !cell.trim()) continue;
      if (!looksLikeLink(cell)) {
        bad += 1;
        continue;
      }
      const link = normalizeLink(cell);
      if (seen.has(link)) continue;
      seen.add(link);
      out.push(link);
    }
    return { links: out, skipped: bad, sample: out.slice(0, 3) };
  }, [bodyRows, column]);

  const add = () => {
    if (!links.length) return;
    onAddLinks(links);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg border-border bg-surface-subtle text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Import links from CSV</DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            Pick the column that holds the URLs — every valid row joins the queue.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {rows.length === 0 ? (
            <FileDropzone
              onFiles={handleFiles}
              accept=".csv,text/csv"
              multiple={false}
              className="rounded-xl border-2 border-dashed border-border bg-surface-card transition-colors hover:border-border-strong"
            >
              {({ browseId, dragging }) => (
                <label
                  htmlFor={browseId}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-[10px] px-6 py-10 text-center transition-colors",
                    dragging && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-subtle transition-colors",
                      dragging && "border-primary/40 bg-primary/10",
                    )}
                  >
                    <FileSpreadsheet
                      className={cn(
                        "h-5 w-5 transition-colors",
                        dragging ? "text-primary" : "text-text-secondary",
                      )}
                    />
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {dragging ? "Drop the CSV here" : "Drop a CSV, or browse"}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    Any export works — one column just needs to hold the links.
                  </span>
                </label>
              )}
            </FileDropzone>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{filename}</p>
                  <p className="text-xs text-text-tertiary">
                    {bodyRows.length.toLocaleString()} row
                    {bodyRows.length !== 1 ? "s" : ""} · {columnOptions.length} column
                    {columnOptions.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Choose a different file"
                  className="text-text-secondary hover:text-foreground"
                  onClick={reset}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">First row is a header</p>
                  <p className="text-xs text-text-secondary">
                    Skips it and names the columns from it.
                  </p>
                </div>
                <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
              </div>

              <Field
                label="Link column"
                hint={
                  sample.length
                    ? `e.g. ${sample[0].slice(0, 58)}${sample[0].length > 58 ? "…" : ""}`
                    : "No links found in this column."
                }
              >
                <Select value={column} onValueChange={setColumn}>
                  <SelectTrigger className="border-border bg-surface-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-surface-subtle text-foreground">
                    {columnOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <p className="text-xs text-text-secondary">
                <span className="font-medium text-foreground">
                  {links.length.toLocaleString()} link{links.length !== 1 ? "s" : ""}
                </span>{" "}
                ready
                {skipped > 0 ? ` · ${skipped.toLocaleString()} row${skipped !== 1 ? "s" : ""} skipped` : ""}
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="text-text-secondary hover:text-foreground"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={add}
            disabled={!links.length}
          >
            <Upload className="h-4 w-4" />
            Add {links.length ? links.length.toLocaleString() : ""} link
            {links.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CsvLinkDialog;
