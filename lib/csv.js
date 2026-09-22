// CSV export for list screens: turn view-model rows into a CSV string and hand
// it to the browser as a download. Columns are `{ key, header, value? }`, where
// `value(row)` overrides the raw field for formatted output.

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.header ?? c.key)).join(",");
  const body = (rows || []).map((row) =>
    columns.map((c) => escapeCell(c.value ? c.value(row) : row[c.key])).join(","),
  );
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename, csv) {
  if (typeof window === "undefined") return false;
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function exportRowsToCsv(filename, rows, columns) {
  return downloadCsv(filename, toCsv(rows, columns));
}
