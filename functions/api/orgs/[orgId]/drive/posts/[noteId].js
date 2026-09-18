import { bad, json, now } from "../../../../_lib/http.js";
import { requireOrgRole } from "../../../../_lib/auth.js";
import { ensureDriveSchema, getDb } from "../../../../_lib/drive.js";

function safeSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function firstParagraph(body = "") {
  const raw = String(body || "")
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#.*$/gm, "")
    .trim();
  const parts = raw.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return String(parts[0] || "").slice(0, 280);
}

export async function onRequestGet({ env, request, params }) {
  const orgId = params.orgId;
  const noteId = params.noteId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "viewer" });
  if (!auth.ok) return auth.resp;

  await ensureDriveSchema(env);
  const db = getDb(env);
  const row = await db.prepare(
    `SELECT note_id, org_id, slug, title_override, excerpt, status, published_at, author_name, created_at, updated_at
     FROM drive_note_posts
     WHERE org_id = ? AND note_id = ?`
  ).bind(orgId, noteId).first();

  return json({
    ok: true,
    post: row ? {
      noteId: row.note_id,
      slug: row.slug,
      titleOverride: row.title_override || "",
      excerpt: row.excerpt || "",
      status: row.status || "draft",
      publishedAt: Number(row.published_at || 0),
      authorName: row.author_name || "",
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
    } : null
  });
}

export async function onRequestPatch({ env, request, params }) {
  const orgId = params.orgId;
  const noteId = params.noteId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;

  await ensureDriveSchema(env);
  const db = getDb(env);

  const note = await db.prepare(
    `SELECT id, title, content, encrypted_blob
     FROM drive_notes
     WHERE org_id = ? AND id = ?`
  ).bind(orgId, noteId).first();

  if (!note) return bad(404, "NOTE_NOT_FOUND");
  if (note.encrypted_blob) return bad(400, "CANNOT_PUBLISH_ENCRYPTED_NOTE");

  const body = await request.json().catch(() => ({}));
  const t = now();
  const slug = safeSlug(body.slug || body.titleOverride || note.title || "post");
  if (!slug) return bad(400, "INVALID_SLUG");

  const titleOverride = String(body.titleOverride || "").trim();
  const excerpt = String(body.excerpt || "").trim() || firstParagraph(note.content || "");
  const status = String(body.status || "published").trim() || "published";
  const authorName = String(body.authorName || "").trim();
  const publishedAt = status === "published" ? Number(body.publishedAt || t) : null;

  const conflict = await db.prepare(
    `SELECT note_id
     FROM drive_note_posts
     WHERE org_id = ? AND slug = ? AND note_id != ?`
  ).bind(orgId, slug, noteId).first();

  if (conflict) return bad(409, "SLUG_ALREADY_EXISTS");

  await db.prepare(
    `INSERT INTO drive_note_posts
       (note_id, org_id, slug, title_override, excerpt, status, published_at, author_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(note_id)
     DO UPDATE SET
       slug = excluded.slug,
       title_override = excluded.title_override,
       excerpt = excluded.excerpt,
       status = excluded.status,
       published_at = excluded.published_at,
       author_name = excluded.author_name,
       updated_at = excluded.updated_at`
  ).bind(
    noteId, orgId, slug, titleOverride || null, excerpt || null, status,
    publishedAt, authorName || null, t, t
  ).run();

  const row = await db.prepare(
    `SELECT note_id, org_id, slug, title_override, excerpt, status, published_at, author_name, created_at, updated_at
     FROM drive_note_posts
     WHERE org_id = ? AND note_id = ?`
  ).bind(orgId, noteId).first();

  return json({
    ok: true,
    post: {
      noteId: row.note_id,
      slug: row.slug,
      titleOverride: row.title_override || "",
      excerpt: row.excerpt || "",
      status: row.status || "draft",
      publishedAt: Number(row.published_at || 0),
      authorName: row.author_name || "",
      createdAt: Number(row.created_at || 0),
      updatedAt: Number(row.updated_at || 0),
    }
  });
}

export async function onRequestDelete({ env, request, params }) {
  const orgId = params.orgId;
  const noteId = params.noteId;
  const auth = await requireOrgRole({ env, request, orgId, minRole: "member" });
  if (!auth.ok) return auth.resp;

  await ensureDriveSchema(env);
  const db = getDb(env);
  await db.prepare(`DELETE FROM drive_note_posts WHERE org_id = ? AND note_id = ?`).bind(orgId, noteId).run();
  return json({ ok: true, deleted: true, noteId });
}
