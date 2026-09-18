import { json } from "../_lib/http.js";
import { ensureDriveSchema, getDb } from "../_lib/drive.js";

function firstParagraph(body = "") {
  const raw = String(body || "")
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#.*$/gm, "")
    .trim();
  const parts = raw.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return String(parts[0] || "").slice(0, 280);
}

export async function onRequestGet({ env, request }) {
  await ensureDriveSchema(env);
  const db = getDb(env);
  const url = new URL(request.url);
  const orgId = String(url.searchParams.get("org") || "dpg").trim() || "dpg";

  const res = await db.prepare(
    `SELECT p.note_id, p.slug, p.title_override, p.excerpt, p.published_at, p.author_name, n.title, n.content, n.tags
     FROM drive_note_posts p
     JOIN drive_notes n ON n.id = p.note_id AND n.org_id = p.org_id
     WHERE p.org_id = ? AND p.status = 'published' AND (n.encrypted_blob IS NULL OR n.encrypted_blob = '')
     ORDER BY COALESCE(p.published_at, p.updated_at, p.created_at) DESC
     LIMIT 50`
  ).bind(orgId).all();

  return json({
    ok: true,
    posts: (res.results || []).map((row) => ({
      noteId: row.note_id,
      slug: row.slug,
      title: row.title_override || row.title || "Untitled",
      excerpt: row.excerpt || firstParagraph(row.content || ""),
      body: row.content || "",
      authorName: row.author_name || "",
      publishedAt: Number(row.published_at || 0),
      tags: String(row.tags || "").split(",").map((x) => x.trim()).filter(Boolean),
    }))
  });
}
