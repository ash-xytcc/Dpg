export function normalizeBulletinFields(input = {}) {
  const rawStatus =
    input?.bulletinStatus ??
    input?.bulletin_status ??
    input?.status ??
    "";

  const normalizedStatus =
    rawStatus === true
      ? "published"
      : rawStatus === false
      ? "draft"
      : String(rawStatus || "").toLowerCase();

  const bulletinSlug =
    input?.bulletinSlug ??
    input?.bulletin_slug ??
    "";

  const bulletinExcerpt =
    input?.bulletinExcerpt ??
    input?.bulletin_excerpt ??
    "";

  const bulletinPublishedAt =
    input?.bulletinPublishedAt ??
    input?.bulletin_published_at ??
    input?.publishedAt ??
    input?.published_at ??
    "";

  return {
    ...input,
    bulletinSlug,
    bulletin_slug: bulletinSlug,
    bulletinExcerpt,
    bulletin_excerpt: bulletinExcerpt,
    bulletinPublishedAt,
    bulletin_published_at: bulletinPublishedAt,
    bulletinStatus: normalizedStatus,
    bulletin_status: normalizedStatus,
  };
}

export function isPublishedBulletin(input = {}) {
  return normalizeBulletinFields(input).bulletinStatus === "published";
}

export function buildBulletinPayload(input = {}) {
  const n = normalizeBulletinFields(input);
  return {
    ...input,
    bulletinSlug: n.bulletinSlug,
    bulletin_slug: n.bulletinSlug,
    bulletinExcerpt: n.bulletinExcerpt,
    bulletin_excerpt: n.bulletinExcerpt,
    bulletinPublishedAt: n.bulletinPublishedAt,
    bulletin_published_at: n.bulletinPublishedAt,
    bulletinStatus: n.bulletinStatus,
    bulletin_status: n.bulletinStatus,
  };
}
