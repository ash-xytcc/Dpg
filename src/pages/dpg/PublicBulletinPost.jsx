import React from "react";
import { applyAppVariantToDocument } from "../../lib/appVariant.js";
import { getDpgPublicTheme, useDpgPublicSiteConfig } from "../../lib/dpgPublicSite.js";

function normalizePost(post = {}) {
  return {
    ...post,
    slug: String(post?.slug || "").trim(),
    title: String(post?.title || "").trim(),
    excerpt: String(post?.excerpt || post?.summary || "").trim(),
    body: String(post?.body || post?.content || "").trim(),
    publishedAt: post?.publishedAt || post?.published_at || post?.createdAt || post?.created_at || "",
    featureImage: post?.featureImage || post?.feature_image || "",
  };
}

async function fetchBulletinPost(slug) {
  const attempts = [
    `/api/public/posts/${encodeURIComponent(slug)}?org=dpg`,
    `/api/public/bulletin/${encodeURIComponent(slug)}?org=dpg`,
  ];

  let lastError = "Post not found";

  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => ({}));
      const post = normalizePost(data?.post || data?.item || data);

      if (res.ok && (data?.ok !== false) && post?.title) {
        return post;
      }

      lastError = data?.error || `Request failed for ${url}`;
    } catch (e) {
      lastError = String(e?.message || e);
    }
  }

  throw new Error(lastError || "Post not found");
}

export default function PublicBulletinPost() {
  const { config } = useDpgPublicSiteConfig();
  const theme = getDpgPublicTheme(config);

  const slug = React.useMemo(() => {
    const parts = String(window.location.pathname || "/").split("/").filter(Boolean);
    return decodeURIComponent(parts[1] || "");
  }, []);

  const [state, setState] = React.useState({ loading: true, post: null, error: "" });

  React.useEffect(() => {
    try {
      document.documentElement.dataset.app = "dpg";
      document.body.dataset.app = "dpg";
    } catch {}
    applyAppVariantToDocument();
  }, []);

  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const post = await fetchBulletinPost(slug);
        if (dead) return;
        setState({ loading: false, post, error: "" });
      } catch (e) {
        if (dead) return;
        setState({ loading: false, post: null, error: String(e?.message || e) });
      }
    })();
    return () => { dead = true; };
  }, [slug]);

  if (state.loading) {
    return (
      <div style={{ ...theme.page, padding: 24, color: "#d7ddd8", fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
        Loading…
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ ...theme.page, padding: 24, color: "#ffb8b8", fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
        {state.error}
      </div>
    );
  }

  const post = state.post;
  return (
    <div style={{ ...theme.page, fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px 72px" }}>
        <a
          href="/bulletin"
          style={{
            ...theme.link,
            fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
            display: "inline-block",
            marginBottom: 18,
          }}
        >
          ← Back to bulletin
        </a>

        <div
          style={{
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "#93b4f0",
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "Public note"}
        </div>

        <h1
          className="dpg-heading"
          style={{
            margin: "0 0 14px",
            fontSize: "clamp(2.3rem, 5vw, 4.8rem)",
            lineHeight: 0.96,
            color: "#f3efe8",
            fontFamily: 'var(--dpg-display-font, "Fancy Shadow", Georgia, serif)',
          }}
        >
          {post.title}
        </h1>

        {post.excerpt ? (
          <p style={{ margin: "0 0 22px", lineHeight: 1.7, fontSize: 18, color: "#f3efe8" }}>
            {post.excerpt}
          </p>
        ) : null}

        {post.featureImage ? (
          <img
            src={post.featureImage}
            alt={post.title}
            style={{
              width: "100%",
              maxHeight: 460,
              objectFit: "cover",
              display: "block",
              borderRadius: 22,
              marginBottom: 24,
            }}
          />
        ) : null}

        <article
          style={{
            ...theme.articleCard,
            color: "#f3efe8",
            whiteSpace: "pre-wrap",
            lineHeight: 1.75,
            borderRadius: 24,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 18px 42px rgba(0,0,0,0.16)",
          }}
        >
          {post.body}
        </article>
      </div>
    </div>
  );
}
