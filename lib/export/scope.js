if (typeof window !== "undefined") {
  throw new Error("lib/export/scope is server-only.");
}

// Shared scope resolution for the CSV/JSON and ZIP export routes: turn the
// screen's scope picker (project / collection / folder / filter) into asset
// rows. Both routes enforce their own output caps; this helper only bounds how
// many rows are read (paged, with a `truncated` flag so the route can say so).

const PAGE_SIZE = 1000;
export const SCOPED_LIST_LIMIT = 5000;

async function pageQuery(query) {
  const rows = [];
  for (let page = 0; rows.length < SCOPED_LIST_LIMIT; page += 1) {
    const { data, error } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { rows, truncated: rows.length >= SCOPED_LIST_LIMIT };
}

function baseAssetsQuery(sb, projectId) {
  return sb
    .schema("assets")
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
}

export async function listScopedAssets(sb, { projectId, scope, scopeId, search }) {
  if (!projectId) return { rows: [], error: "bad_request" };

  if (scope === "collection") {
    if (!scopeId) return { rows: [], error: "bad_request" };
    const { data: collection, error: collectionError } = await sb
      .schema("assets")
      .from("collections")
      .select("id, project_id")
      .eq("id", scopeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (collectionError) return { rows: [], error: collectionError.message };
    if (!collection || collection.project_id !== projectId) return { rows: [], error: "unknown_scope" };
    const { data: members, error: membersError } = await sb
      .schema("assets")
      .from("collection_assets")
      .select("asset_id")
      .eq("collection_id", scopeId);
    if (membersError) return { rows: [], error: membersError.message };
    const ids = [...new Set((members || []).map((m) => m.asset_id).filter(Boolean))];
    if (!ids.length) return { rows: [], truncated: false };
    const { data, error } = await sb
      .schema("assets")
      .from("assets")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .in("id", ids)
      .order("updated_at", { ascending: false });
    if (error) return { rows: [], error: error.message };
    return { rows: data || [], truncated: false };
  }

  let query = baseAssetsQuery(sb, projectId);

  if (scope === "folder" && scopeId) {
    const { data: folder, error: folderError } = await sb
      .schema("assets")
      .from("folders")
      .select("id, project_id, path, name")
      .eq("id", scopeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (folderError) return { rows: [], error: folderError.message };
    if (!folder || folder.project_id !== projectId) return { rows: [], error: "unknown_scope" };
    query = query.eq("folder", folder.path || folder.name || "root");
  }

  if (scope === "filter" && search && search.trim()) {
    // Strip PostgREST wildcards and `or`-syntax separators so the term can't
    // break the query — it degrades to a plain substring match.
    const term = `%${search.trim().replace(/[%_,()]/g, "")}%`;
    query = query.or(`name.ilike.${term},format.ilike.${term},type.ilike.${term}`);
  }

  const { rows, truncated, error } = await pageQuery(query);
  if (error) return { rows: [], error };
  return { rows, truncated };
}

/** Fetch related rows for a set of asset ids in small batches (URL-safe). */
export async function listRelatedByAssetIds(sb, table, ids, columns, { extraFilter } = {}) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const out = [];
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    let query = sb.schema("assets").from(table).select(columns).in("asset_id", batch);
    if (extraFilter) query = extraFilter(query);
    const { data, error } = await query;
    if (error) {
      console.error(`[export.related.${table}]`, error.message);
      return null;
    }
    out.push(...(data || []));
  }
  return out;
}
