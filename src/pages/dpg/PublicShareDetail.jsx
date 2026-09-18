import React from "react";
import { applyAppVariantToDocument } from "../../lib/appVariant.js";
import { getDpgPublicTheme, useDpgPublicSiteConfig } from "../../lib/dpgPublicSite.js";

const DPG_BRAND = {
  name: "Dual Power Gathering",
  adminSignInHref: "/?app=dpg#/signin",
  logoSrc: "/branding/dpg-logo.png",
  logoAlt: "Dual Power Gathering",
};

const PUBLIC_NAV_LINKS = [
  { label: "Home", url: "/" },
  { label: "About", url: "/about" },
  { label: "FAQ", url: "/faq" },
  { label: "Volunteer", url: "/volunteer" },
  { label: "Donate", url: "/donate" },
  { label: "Press", url: "/press" },
  { label: "DPG Shares", url: "/dpg-shares" },
  { label: "RSVP", url: "/rsvp" },
];

const SHARE_DETAIL_MOBILE_CSS = `
  @media (max-width: 820px) {
    .dpg-public-nav {
      gap: 12px !important;
      align-items: stretch !important;
      margin-bottom: 22px !important;
    }
    .dpg-public-nav-links {
      width: 100%;
      gap: 12px !important;
      row-gap: 10px !important;
    }
    .dpg-public-nav-cta {
      width: 100%;
      justify-content: center;
    }
    .dpg-share-detail-shell {
      padding: 24px 16px 72px !important;
    }
  }
`;

function PublicNav({ links = [], authed = false, accent = "#93b4f0" }) {
  const items = Array.isArray(links) ? links : [];
  return (
    <>
      <style>{SHARE_DETAIL_MOBILE_CSS}</style>
      <nav
        className="dpg-public-nav"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
        marginBottom: 34,
      }}
    >
      <div className="dpg-public-nav-links" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        {items.map((item, idx) => (
          <a
            key={`${item?.label || "nav"}-${idx}`}
            href={item?.url || "/"}
            style={{
              color: "#f3efe8",
              textDecoration: "none",
              fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
              fontWeight: 700,
              fontSize: 15,
              textShadow: "0 1px 2px rgba(0,0,0,0.45)",
            }}
          >
            {item?.label || ""}
          </a>
        ))}
      </div>

      <button
        className="dpg-public-nav-cta"
        type="button"
        onClick={() => {
          window.location.href = authed ? "/?app=dpg#/org/dpg/overview" : DPG_BRAND.adminSignInHref;
        }}
        style={{
          border: 0,
          borderRadius: 999,
          padding: "12px 18px",
          background: accent,
          color: "#121715",
          cursor: "pointer",
          fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
          fontWeight: 800,
          boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
        }}
      >
        {authed ? "Organizer area" : "Organizer sign in"}
      </button>
    </nav>
    </>
  );
}

function toEmbedUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);

    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const v = u.searchParams.get("v");
        return v ? `https://www.youtube.com/embed/${v}` : raw;
      }
      if (u.pathname.startsWith("/embed/")) return raw;
    }

    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\/+/, "");
      return id ? `https://www.youtube.com/embed/${id}` : raw;
    }

    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.replace(/^\/+/, "");
      return id ? `https://player.vimeo.com/video/${id}` : raw;
    }

    if (u.hostname.includes("kolektiva.media")) {
      if (u.pathname.includes("/videos/embed/")) return raw;
      const m = u.pathname.match(/\/w\/([^/]+)/);
      if (m?.[1]) return `https://kolektiva.media/videos/embed/${m[1]}`;
    }

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(raw)) return raw;
    return raw;
  } catch {
    return raw;
  }
}

function isDirectVideo(url = "") {
  const raw = String(url || "").trim();
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(raw) || raw.includes("/api/public/share-file/");
}

export default function PublicShareDetail({ slug: slugProp = "" }) {
  const { config } = useDpgPublicSiteConfig();
  const theme = getDpgPublicTheme(config);
  const [authState, setAuthState] = React.useState({ checked: false, authed: false });
  const [state, setState] = React.useState({ loading: true, share: null, error: "" });
  const [relatedState, setRelatedState] = React.useState({ loading: true, items: [] });

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
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (dead) return;
        setAuthState({ checked: true, authed: !!(res.ok && data?.ok) });
      } catch {
        if (dead) return;
        setAuthState({ checked: true, authed: false });
      }
    })();
    return () => { dead = true; };
  }, []);

  const slug = React.useMemo(() => {
    if (slugProp) return String(slugProp).trim().toLowerCase();
    const parts = String(window.location.pathname || "/").split("/").filter(Boolean);
    return String(parts[1] || "").trim().toLowerCase();
  }, [slugProp]);

  React.useEffect(() => {
    let dead = false;
    setState({ loading: true, share: null, error: "" });

    (async () => {
      try {
        const res = await fetch(`/api/public/shares/${encodeURIComponent(slug)}?org=dpg`, {
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (dead) return;
        if (!res.ok || data?.ok === false) {
          setState({ loading: false, share: null, error: data?.error || `HTTP ${res.status}` });
          return;
        }
        setState({ loading: false, share: data?.share || null, error: "" });
      } catch (e) {
        if (dead) return;
        setState({ loading: false, share: null, error: String(e?.message || e) });
      }
    })();

    return () => { dead = true; };
  }, [slug]);

  React.useEffect(() => {
    const title = state.share?.title ? `${state.share.title} • Dual Power Gathering` : "Dual Power Gathering • Shares";
    document.title = title;
  }, [state.share]);

  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch("/api/public/shares?org=dpg&limit=4", {
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (dead) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setRelatedState({
          loading: false,
          items: items.filter((item) => String(item?.slug || "") !== String(slug || "")).slice(0, 3),
        });
      } catch {
        if (dead) return;
        setRelatedState({ loading: false, items: [] });
      }
    })();
    return () => { dead = true; };
  }, [slug]);


  const navLinks = PUBLIC_NAV_LINKS;

  const accent = String(config?.accent_color || "#93b4f0").trim() || "#93b4f0";
  const share = state.share;
  const embedUrl = toEmbedUrl(share?.videoUrl || "");
  const canEmbed = !!embedUrl;

  return (
    <div style={{ ...theme.page, fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
      <div className="dpg-share-detail-shell" style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 20px 80px" }}>
        <PublicNav links={navLinks} authed={authState.authed} accent={accent} />

        <a
          href="/dpg-shares"
          style={{
            display: "inline-flex",
            marginBottom: 18,
            color: "#d7ddd8",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← Back to Shares
        </a>

        {state.loading ? (
          <div style={{ color: "#d7ddd8" }}>Loading session…</div>
        ) : state.error ? (
          <div style={{ color: "#ffb8b8" }}>{state.error}</div>
        ) : !share ? (
          <div style={{ color: "#d7ddd8" }}>That session could not be found.</div>
        ) : (
          <>
            <style>{`
              .dpg-share-detail-grid {
                display: grid;
                grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
                gap: 22px;
                align-items: start;
              }
              .dpg-share-detail-card {
                background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 24px;
                padding: 22px;
                box-shadow: 0 18px 42px rgba(0,0,0,0.16);
              }
              .dpg-share-detail-embed {
                width: 100%;
                aspect-ratio: 16 / 9;
                border: 0;
                border-radius: 18px;
                background: rgba(0,0,0,0.24);
                display: block;
              }
              .dpg-share-detail-meta {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 14px;
              }
              .dpg-share-detail-chip {
                display: inline-flex;
                align-items: center;
                padding: 7px 10px;
                border-radius: 999px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.10);
                color: #f3efe8;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: .06em;
                text-transform: uppercase;
              }
              .dpg-share-detail-thumb {
                width: 100%;
                display: block;
                aspect-ratio: 16 / 9;
                object-fit: cover;
                border-radius: 18px;
              }
              .dpg-share-detail-cta {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 14px 18px;
                border-radius: 999px;
                background: ${accent};
                color: #121715;
                text-decoration: none;
                font-weight: 800;
                box-shadow: 0 12px 28px rgba(0,0,0,0.18);
              }
              .dpg-share-related-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 14px;
              }
              .dpg-share-related-card {
                display: grid;
                gap: 8px;
                text-decoration: none;
                color: inherit;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 18px;
                padding: 16px;
              }
              @media (max-width: 920px) {
                .dpg-share-detail-grid { grid-template-columns: 1fr; }
              }
            `}</style>

            <header style={{ display: "grid", gap: 14, marginBottom: 24 }}>
              <div style={{ color: "#d7ddd8", fontSize: 15 }}>
                DPG Shares
              </div>
              <h1
                style={{
                  margin: 0,
                  color: accent,
                  fontSize: "clamp(2.4rem, 5vw, 4.8rem)",
                  lineHeight: 0.96,
                  fontFamily: 'var(--dpg-display-font, "Fancy Shadow", Georgia, serif)',
                  textShadow: "0 1px 2px rgba(0,0,0,0.35)",
                }}
              >
                {share.title}
              </h1>
            </header>

            <section className="dpg-share-detail-grid">
              <div style={{ display: "grid", gap: 18 }}>
                <article className="dpg-share-detail-card">
                  <div className="dpg-share-detail-meta">
                    {(share.tags || []).map((tag) => (
                      <span key={tag} className="dpg-share-detail-chip">{tag}</span>
                    ))}
                  </div>

                  {canEmbed ? (
                    isDirectVideo(embedUrl) ? (
                      <video className="dpg-share-detail-embed" controls preload="metadata" poster={share.thumbnailUrl || ""}>
                        <source src={embedUrl} />
                      </video>
                    ) : (
                      <iframe
                        className="dpg-share-detail-embed"
                        src={embedUrl}
                        title={share.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    )
                  ) : share.thumbnailUrl ? (
                    <img className="dpg-share-detail-thumb" src={share.thumbnailUrl} alt={share.title} />
                  ) : null}

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                    {share.videoUrl ? (
                      <a href={share.videoUrl} target="_blank" rel="noreferrer" className="dpg-share-detail-cta">
                        Watch source
                      </a>
                    ) : null}
                  </div>
                </article>

                <article className="dpg-share-detail-card">
                  <div style={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
                    Session notes
                  </div>
                  <div style={{ color: "#f3efe8", lineHeight: 1.72, fontSize: "1.04rem", whiteSpace: "pre-wrap" }}>
                    {share.description || "No description added yet."}
                  </div>
                </article>
              </div>

              <aside style={{ display: "grid", gap: 18 }}>
                <div className="dpg-share-detail-card">
                  <div style={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
                    Session info
                  </div>
                  <div style={{ display: "grid", gap: 10, color: "#d7ddd8", lineHeight: 1.6 }}>
                    {share.metaText ? (
                      <div>
                        <strong style={{ color: "#f3efe8" }}>Meta:</strong>{" "}
                        <span style={{ color: "#d7ddd8" }}>{share.metaText}</span>
                      </div>
                    ) : null}
                    {share.durationText ? (
                      <div>
                        <strong style={{ color: "#f3efe8" }}>Duration:</strong>{" "}
                        <span style={{ color: "#d7ddd8" }}>{share.durationText}</span>
                      </div>
                    ) : null}
                    {share.publishedAt ? (
                      <div>
                        <strong style={{ color: "#f3efe8" }}>Published:</strong>{" "}
                        <span style={{ color: "#d7ddd8" }}>{new Date(share.publishedAt).toLocaleDateString()}</span>
                      </div>
                    ) : null}
                    {share.slug ? (
                      <div>
                        <strong style={{ color: "#f3efe8" }}>Slug:</strong>{" "}
                        <span style={{ color: "#d7ddd8" }}>{share.slug}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            </section>

            {!relatedState.loading && relatedState.items.length ? (
              <section style={{ marginTop: 26 }}>
                <div style={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
                  More sessions
                </div>
                <div className="dpg-share-related-grid">
                  {relatedState.items.map((item) => (
                    <a key={item.slug} href={`/dpg-shares/${item.slug}`} className="dpg-share-related-card">
                      <div style={{ color: "#93b4f0", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                        {Array.isArray(item.tags) && item.tags.length ? item.tags[0] : "Session"}
                      </div>
                      <div style={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.18 }}>
                        {item.title}
                      </div>
                      <div style={{ color: "#d7ddd8", lineHeight: 1.55, fontSize: "0.95rem" }}>
                        {item.description || "Open session details."}
                      </div>
                      <div style={{ color: accent, fontWeight: 800, fontSize: 14 }}>
                        View session →
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
