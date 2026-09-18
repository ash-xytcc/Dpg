import json, re
from pathlib import Path

SRC = Path("imports/dual-power-west.ghost.json")
if not SRC.exists():
    raise SystemExit(f"FAILED: missing Ghost export at {SRC}")

raw = json.loads(SRC.read_text(encoding="utf-8"))
db = raw["db"][0]["data"]

posts = db.get("posts", [])
newsletters = db.get("newsletters", [])
theme = db.get("custom_theme_settings", [])

def clean_html(value):
    if not value:
        return ""
    return value.replace("__GHOST_URL__", "https://dualpowergathering.org").strip()

def clean_text(value):
    if not value:
        return ""
    return value.replace("__GHOST_URL__", "https://dualpowergathering.org").strip()

def slug_to_route(slug, item_type):
    core_pages = {"faq", "rsvp", "volunteer", "donate", "press", "about", "about-2"}
    if item_type == "page" or slug in core_pages:
        if slug == "about-2":
            return "/about"
        return f"/{slug}"
    return f"/archive/{slug}"

def strip_rsvp_signup(html_value, slug):
    if slug != "rsvp":
        return html_value
    html_value = re.sub(
        r'<div class="kg-card kg-signup-card[\s\S]*?</div>\s*<hr>',
        '<div class="dpg-rsvp-placeholder"><p><strong>RSVP flow coming soon in the DPG app.</strong></p></div><hr>',
        html_value,
        flags=re.IGNORECASE
    )
    html_value = re.sub(
        r'<div class="kg-card kg-signup-card[\s\S]*?</div>',
        '<div class="dpg-rsvp-placeholder"><p><strong>RSVP flow coming soon in the DPG app.</strong></p></div>',
        html_value,
        flags=re.IGNORECASE
    )
    return html_value

def extract_media_refs(item):
    refs = set()
    for k in ("feature_image", "html", "plaintext", "lexical"):
        v = item.get(k)
        if not v or not isinstance(v, str):
            continue
        v = v.replace("__GHOST_URL__", "https://dualpowergathering.org")
        matches = re.findall(r'https://dualpowerwest\.org/[^"\')\s>]+', v)
        for m in matches:
            if "/content/images/" in m or "/content/media/" in m:
                refs.add(m)
    return sorted(refs)

items = []
media_refs = set()

for item in posts:
    if item.get("status") != "published":
        continue
    if item.get("visibility") not in (None, "public"):
        continue

    slug = item.get("slug") or ""
    title = item.get("title") or ""
    item_type = item.get("type") or "post"

    html_value = clean_html(item.get("html") or "")
    html_value = strip_rsvp_signup(html_value, slug)

    plaintext = clean_text(item.get("plaintext") or "")
    feature_image = clean_text(item.get("feature_image") or "")
    refs = extract_media_refs(item)
    media_refs.update(refs)

    items.append({
        "id": item.get("id"),
        "uuid": item.get("uuid"),
        "title": title,
        "slug": slug,
        "route": slug_to_route(slug, item_type),
        "type": item_type,
        "featured": bool(item.get("featured")),
        "publishedAt": item.get("published_at"),
        "updatedAt": item.get("updated_at"),
        "featureImage": feature_image or None,
        "customExcerpt": item.get("custom_excerpt"),
        "plaintext": plaintext,
        "html": html_value,
        "mediaRefs": refs,
    })

dedup = {}
for item in items:
    route = item["route"]
    prev = dedup.get(route)
    if not prev or (item.get("updatedAt") or "") > (prev.get("updatedAt") or ""):
        dedup[route] = item

items = sorted(dedup.values(), key=lambda x: ((x["type"] != "page"), x["route"], x["title"]))

page_items = [
    x for x in items
    if x["type"] == "page" or x["route"] in ["/about", "/faq", "/rsvp", "/volunteer", "/donate", "/press"]
]
post_items = [x for x in items if x not in page_items]

theme_map = {row["key"]: row.get("value") for row in theme}
newsletter_map = [
    {
        "name": n.get("name"),
        "slug": n.get("slug"),
        "status": n.get("status"),
        "description": n.get("description"),
        "headerImage": clean_text(n.get("header_image") or ""),
    }
    for n in newsletters
]

content_js = """// generated from Ghost export
export const dpgGhostTheme = %s;

export const dpgGhostNewsletters = %s;

export const dpgGhostPages = %s;

export const dpgGhostPosts = %s;

export function getDpgGhostPageByRoute(route) {
  return dpgGhostPages.find((item) => item.route === route) || null;
}

export function getDpgGhostPostByRoute(route) {
  return dpgGhostPosts.find((item) => item.route === route) || null;
}

export function getAllDpgGhostRoutes() {
  return [
    ...dpgGhostPages.map((item) => item.route),
    ...dpgGhostPosts.map((item) => item.route),
  ];
}
""" % (
    json.dumps(theme_map, indent=2, ensure_ascii=False),
    json.dumps(newsletter_map, indent=2, ensure_ascii=False),
    json.dumps(page_items, indent=2, ensure_ascii=False),
    json.dumps(post_items, indent=2, ensure_ascii=False),
)

routes_js = """// generated from Ghost export
export const dpgGhostStaticRoutes = %s;
export const dpgGhostArchiveRoutes = %s;
""" % (
    json.dumps([x["route"] for x in page_items], indent=2, ensure_ascii=False),
    json.dumps([x["route"] for x in post_items], indent=2, ensure_ascii=False),
)

media_manifest = {
    "count": len(sorted(media_refs)),
    "items": sorted(media_refs),
}

Path("src/content/dpgGhostContent.js").write_text(content_js, encoding="utf-8")
Path("src/content/dpgGhostRoutes.js").write_text(routes_js, encoding="utf-8")
Path("public/dpg-ghost-media-manifest.json").write_text(json.dumps(media_manifest, indent=2, ensure_ascii=False), encoding="utf-8")

print("WROTE src/content/dpgGhostContent.js")
print("WROTE src/content/dpgGhostRoutes.js")
print("WROTE public/dpg-ghost-media-manifest.json")
print(f"Imported {len(page_items)} page-like items and {len(post_items)} archive items")
