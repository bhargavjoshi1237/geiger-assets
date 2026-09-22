"use client";

// Generic, guarded CRUD primitives shared by the data-access modules in this
// folder. Every helper degrades to "no DB" (null / [] / false) when Supabase is
// unconfigured or the call fails — it never throws and never toasts; the screen
// owns UX.

import { assetsClient, isSupabaseConfigured } from "@/supabase/components/assets-client";

export function meta(row) {
  return row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one helper serves a full create and a partial update.
export function toRowGeneric(input, map, { numerics = [], arrays = [] } = {}) {
  const row = {};
  for (const [key, col] of Object.entries(map)) {
    if (!(key in input)) continue;
    if (numerics.includes(key)) row[col] = Number(input[key]) || 0;
    else if (arrays.includes(key)) row[col] = Array.isArray(input[key]) ? input[key] : [];
    else row[col] = input[key];
  }
  if ("metadata" in input) row.metadata = input.metadata || {};
  if (input.id) row.id = input.id;
  return row;
}

// "" -> null for date columns, so an empty form field clears the date.
export function dateOrNull(value) {
  return value ? value : null;
}

export async function listRows(table, projectId, { order = "updated_at", ascending = false, softDeleted = true, match } = {}) {
  if (!isSupabaseConfigured()) return null;
  try {
    let query = assetsClient().from(table).select("*");
    if (softDeleted) query = query.is("deleted_at", null);
    if (projectId) query = query.eq("project_id", projectId);
    for (const [col, value] of Object.entries(match || {})) {
      if (value !== undefined && value !== null) query = query.eq(col, value);
    }
    const { data, error } = await query.order(order, { ascending });
    if (error) {
      console.error(`[${table}.list]`, error.message);
      return null;
    }
    return data ?? [];
  } catch (err) {
    console.error(`[${table}.list]`, err?.message);
    return null;
  }
}

export async function getRow(table, id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().from(table).select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error(`[${table}.get]`, error.message);
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error(`[${table}.get]`, err?.message);
    return null;
  }
}

export async function createRow(table, payload) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().from(table).insert(payload).select("*").single();
    if (error) {
      console.error(`[${table}.create]`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`[${table}.create]`, err?.message);
    return null;
  }
}

export async function createRows(table, payloads) {
  if (!isSupabaseConfigured()) return null;
  if (!payloads?.length) return [];
  try {
    const { data, error } = await assetsClient().from(table).insert(payloads).select("*");
    if (error) {
      console.error(`[${table}.createMany]`, error.message);
      return null;
    }
    return data ?? [];
  } catch (err) {
    console.error(`[${table}.createMany]`, err?.message);
    return null;
  }
}

export async function updateRow(table, id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await assetsClient().from(table).update(patch).eq("id", id).select("*").single();
    if (error) {
      console.error(`[${table}.update]`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`[${table}.update]`, err?.message);
    return null;
  }
}

export async function softDeleteRow(table, id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const { error } = await assetsClient()
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error(`[${table}.delete]`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${table}.delete]`, err?.message);
    return false;
  }
}
