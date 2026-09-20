import React from 'react';
import { applyAppVariantToDocument } from '../lib/appVariant.js';
import { getDpgPublicTheme, useDpgPublicSiteConfig } from '../lib/dpgPublicSite.js';

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
  { label: "Sessions", url: "/sessions" },
  { label: "RSVP", url: "/rsvp" },
];

const HOME_MOBILE_CSS = `
  @media (max-width: 820px) {
    .dpg-home-nav {
      left: 16px !important;
      right: 16px !important;
      top: 16px !important;
      gap: 12px !important;
      align-items: stretch !important;
    }
    .dpg-home-nav-links {
      width: 100%;
      gap: 12px !important;
      row-gap: 10px !important;
    }
    .dpg-home-nav-cta-wrap {
      width: 100%;
      justify-content: flex-start !important;
    }
    .dpg-home-nav-cta {
      width: 100%;
      justify-content: center;
    }
    .dpg-home-hero-inner {
      padding: 148px 16px 72px !important;
    }
    .dpg-home-feature-card {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
      padding: 14px !important;
    }
    .dpg-home-feature-media {
      min-height: 220px !important;
      order: 1 !important;
    }
    .dpg-home-feature-copy {
      order: 2 !important;
    }
    .dpg-home-lower-shell {
      padding: 26px 16px 72px !important;
    }
    .dpg-home-lower-grid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }
  }
`;

function normalizeHomeConfig(src = {}) {
  return {
    enabled: true,
    accent_color: String(src?.accent_color || "#385032"),
    hero_eyebrow: String(src?.hero_eyebrow || ""),
    hero_title: String(src?.hero_title || ""),
    hero_body: String(src?.hero_body || ""),
    hero_background_url: String(src?.hero_background_url || ""),
    organizer_title: String(src?.organizer_title || ""),
    organizer_body: String(src?.organizer_body || ""),
    bulletin_title: String(src?.bulletin_title || ""),
    bulletin_intro: String(src?.bulletin_intro || ""),
    nav_links: Array.isArray(src?.nav_links) ? src.nav_links : [],
    featured_post_slugs: Array.isArray(src?.featured_post_slugs) ? src.featured_post_slugs : [],
    sticky_cards: Array.isArray(src?.sticky_cards) ? src.sticky_cards : [],
    progress_items: Array.isArray(src?.progress_items) ? src.progress_items : [],
  };
}

async function authFetch(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  const res = await fetch(path, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

function EditChip({ onClick, children, subtle = false, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active
          ? "1px solid rgba(255,255,255,0.28)"
          : "1px solid rgba(255,255,255,0.12)",
        background: active
          ? "rgba(147,180,240,0.18)"
          : subtle
            ? "rgba(255,255,255,0.05)"
            : "rgba(147,180,240,0.14)",
        color: "#f3efe8",
        borderRadius: 999,
        padding: "6px 11px",
        fontSize: 11,
        fontWeight: 800,
        cursor: "pointer",
        lineHeight: 1.1,
        letterSpacing: ".02em",
        boxShadow: active ? "0 8px 20px rgba(0,0,0,0.18)" : "none",
        transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {children}
    </button>
  );
}

function EditableRegion({
  enabled = false,
  active = false,
  onEdit,
  children,
  hint = "Click to edit",
  dark = true,
  displayStyle = {},
}) {
  const [hovered, setHovered] = React.useState(false);

  if (!enabled) {
    return <div style={displayStyle}>{children}</div>;
  }

  const borderColor = dark
    ? active
      ? "rgba(147,180,240,0.55)"
      : hovered
        ? "rgba(255,255,255,0.22)"
        : "transparent"
    : active
      ? "rgba(56,80,50,0.45)"
      : hovered
        ? "rgba(0,0,0,0.14)"
        : "transparent";

  const hintBg = dark ? "rgba(7,10,9,0.82)" : "rgba(255,255,255,0.86)";
  const hintColor = dark ? "#d7ddd8" : "#1a1f1c";

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        cursor: "text",
        borderRadius: 12,
        outline: `1px dashed ${borderColor}`,
        outlineOffset: 4,
        transition: "outline-color 140ms ease, background 140ms ease",
        ...displayStyle,
      }}
    >
      {children}
      {(hovered || active) ? (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -2,
            pointerEvents: "none",
            padding: "3px 8px",
            borderRadius: 999,
            background: hintBg,
            color: hintColor,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            border: dark
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
            whiteSpace: "nowrap",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function InlineTextEditor({
  value,
  onChange,
  style = {},
  placeholder = "",
  multiline = false,
  dark = true,
  onBlur,
  onKeyDown,
}) {
  const baseStyle = {
    width: "100%",
    background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    color: dark ? "#f3efe8" : "#171717",
    border: dark ? "1px dashed rgba(255,255,255,0.28)" : "1px dashed rgba(0,0,0,0.18)",
    padding: 10,
    font: "inherit",
    borderRadius: 12,
    ...style,
  };

  if (multiline) {
    return (
      <textarea
        autoFocus
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ ...baseStyle, minHeight: 72, resize: "vertical" }}
      />
    );
  }

  return (
    <input
      autoFocus
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      style={baseStyle}
    />
  );
}

function InlineStringListEditor({
  title,
  items,
  onChange,
  limit = 6,
  itemPlaceholder = "Item",
  light = true,
}) {
  const safe = Array.isArray(items) ? items.slice(0, limit) : [];
  while (safe.length < limit) safe.push("");

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 14,
        borderRadius: 18,
        background: light ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        border: light ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {title ? (
        <div
          style={{
            color: light ? "#8fa1ab" : "#555",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: ".08em",
          }}
        >
          {title}
        </div>
      ) : null}
      {safe.map((item, index) => (
        <input
          key={`${title || "item"}-${index}`}
          value={item || ""}
          onChange={(e) => {
            const next = safe
              .map((x, i) => (i === index ? e.target.value : x))
              .map((x) => String(x || "").trimEnd());
            onChange(next.filter((x) => x.trim()));
          }}
          placeholder={`${itemPlaceholder} ${index + 1}`}
          style={{
            width: "100%",
            background: light ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            color: light ? "#f3efe8" : "#171717",
            border: light ? "1px dashed rgba(255,255,255,0.24)" : "1px dashed rgba(0,0,0,0.18)",
            padding: 10,
            borderRadius: 12,
          }}
        />
      ))}
    </div>
  );
}

function InlineField({
  editing = false,
  editorMode = false,
  value = "",
  onChange,
  onStartEdit,
  onStopEdit,
  multiline = false,
  display,
  placeholder = "",
  dark = true,
  style = {},
  displayStyle = {},
  hint = "Click to edit",
}) {
  if (!editing) {
    return (
      <EditableRegion
        enabled={editorMode}
        active={false}
        onEdit={onStartEdit}
        dark={dark}
        hint={hint}
        displayStyle={displayStyle}
      >
        {display ?? value ?? ""}
      </EditableRegion>
    );
  }

  const handleKeyDown = (e) => {
    if (!multiline && e.key === "Enter") {
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  };

  return (
    <EditableRegion
      enabled={editorMode}
      active={true}
      onEdit={onStartEdit}
      dark={dark}
      hint={hint}
      displayStyle={displayStyle}
    >
      <InlineTextEditor
        value={value}
        onChange={onChange}
        onBlur={onStopEdit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        multiline={multiline}
        dark={dark}
        style={style}
      />
    </EditableRegion>
  );
}

function Sticky({ title, text, rotate = '-1deg', tone = '#fff7a8', dark = false, children = null }) {
  return (
    <div
      style={{
        background: tone,
        color: '#171717',
        borderRadius: 16,
        padding: 18,
        minHeight: 170,
        boxShadow: dark ? '0 18px 34px rgba(0,0,0,0.20)' : '0 12px 24px rgba(0,0,0,0.10)',
        transform: `rotate(${rotate})`,
        border: '1px solid rgba(0,0,0,0.08)',
        position: "relative",
      }}
    >
      {children}
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          marginBottom: 10,
          color: '#171717',
          textShadow: 'none',
          fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: '#171717',
          textShadow: 'none',
          fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function NavBar({ links = [], editorMode = false, onOpenNavEditor, authed = false, accent = "#385032" }) {
  const items = Array.isArray(links) ? links : [];

  return (
    <nav
      className="dpg-home-nav"
      style={{
        position: 'absolute',
        top: 22,
        left: 28,
        right: 28,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <div className="dpg-home-nav-links" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        {items.map((item, idx) => (
          <a
            key={`${item?.label || 'nav'}-${idx}`}
            href={editorMode ? "#" : (item?.url || '/')}
            onClick={editorMode ? (e) => e.preventDefault() : undefined}
            style={{
              color: '#ffffff',
              textDecoration: 'none',
              fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
              fontWeight: 700,
              fontSize: 15,
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              opacity: 0.96,
            }}
          >
            {item?.label || ''}
          </a>
        ))}
        {editorMode ? <EditChip onClick={onOpenNavEditor} subtle>Edit nav</EditChip> : null}
      </div>

      <div className="dpg-home-nav-cta-wrap" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <button
          className="dpg-home-nav-cta"
          type="button"
          onClick={() => {
            window.location.href = authed ? "/?app=dpg#/dpg/app/overview" : DPG_BRAND.adminSignInHref;
          }}
          style={{
            border: 0,
            borderRadius: 999,
            padding: '12px 18px',
            background: accent,
            color: '#121715',
            cursor: 'pointer',
            fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
            fontWeight: 800,
            boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
          }}
        >
          {authed ? "Organizer area" : "Organizer sign in"}
        </button>
      </div>
    </nav>
  );
}

function NavEditPopover({ links, onChange, visible, onClose }) {
  if (!visible) return null;
  const safe = Array.isArray(links) ? links.slice(0, 8) : [];
  while (safe.length < 8) safe.push({ label: "", url: "" });

  return (
    <div
      style={{
        position: "absolute",
        top: 84,
        left: 28,
        zIndex: 4,
        width: "min(720px, calc(100% - 56px))",
        display: "grid",
        gap: 8,
        padding: 14,
        background: "rgba(8,12,10,0.90)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(8px)",
        borderRadius: 18,
        boxShadow: "0 20px 48px rgba(0,0,0,0.26)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ color: "#d7ddd8", fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em" }}>
          Top navigation
        </div>
        <EditChip onClick={onClose} subtle>Done</EditChip>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {safe.map((item, idx) => (
          <React.Fragment key={`nav-${idx}`}>
            <input
              value={item.label || ""}
              onChange={(e) => {
                const next = safe.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x));
                onChange(next.filter((x) => x.label && x.url));
              }}
              placeholder={`Label ${idx + 1}`}
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "1px dashed rgba(255,255,255,0.25)",
                padding: 10,
                borderRadius: 12,
              }}
            />
            <input
              value={item.url || ""}
              onChange={(e) => {
                const next = safe.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x));
                onChange(next.filter((x) => x.label && x.url));
              }}
              placeholder={`/${idx === 0 ? "" : "route"}`}
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "1px dashed rgba(255,255,255,0.25)",
                padding: 10,
                borderRadius: 12,
              }}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function FeaturedCard({ post, reverse = false }) {
  const href = `/bulletin/${encodeURIComponent(post.slug)}`;

  return (
    <a
      className="dpg-home-feature-card"
      href={href}
      style={{
        display: 'grid',
        gridTemplateColumns: reverse ? '1.35fr .9fr' : '.9fr 1.35fr',
        gap: 26,
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 24,
        padding: 18,
      }}
    >
      <div className="dpg-home-feature-copy" style={{ order: reverse ? 2 : 1 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(2rem, 4vw, 3.3rem)',
            lineHeight: 0.98,
            color: '#f3efe8',
            fontFamily: 'Inter, system-ui, Arial, sans-serif',
            fontWeight: 900,
            letterSpacing: "-0.02em",
          }}
        >
          {post.title}
        </h2>
        {post.excerpt ? (
          <p
            style={{
              margin: '16px 0 10px',
              color: '#d7ddd8',
              lineHeight: 1.6,
              fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
              fontSize: 16,
            }}
          >
            {post.excerpt}
          </p>
        ) : null}
        <div
          style={{
            color: '#8fa1ab',
            fontSize: 13,
            fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
          }}
        >
          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
        </div>
      </div>

      <div
        className="dpg-home-feature-media"
        style={{
          order: reverse ? 1 : 2,
          minHeight: 280,
          borderRadius: 20,
          overflow: 'hidden',
          background: '#1a211e',
        }}
      >
        {post.feature_image || post.featureImage ? (
          <img
            src={post.feature_image || post.featureImage}
            alt={post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', minHeight: 280, background: '#1a211e' }} />
        )}
      </div>
    </a>
  );
}

function SectionHint({ children }) {
  return (
    <div
      style={{
        marginBottom: 12,
        color: "#8fa1ab",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: ".08em",
      }}
    >
      {children}
    </div>
  );
}

export default function DpgPublicHome() {
  const { config } = useDpgPublicSiteConfig();
  const [authState, setAuthState] = React.useState({ checked: false, authed: false });
  const [editorMode, setEditorMode] = React.useState(false);
  const [activeField, setActiveField] = React.useState("");
  const [navEditorOpen, setNavEditorOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const [savedOverride, setSavedOverride] = React.useState(null);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState("");
  const [postsState, setPostsState] = React.useState({ loading: true, posts: [], error: "" });
  const [newsletterForm, setNewsletterForm] = React.useState({
    name: "",
    email: "",
    website: "",
    _formStartedAt: Date.now(),
  });
  const [newsletterBusy, setNewsletterBusy] = React.useState(false);
  const [newsletterMsg, setNewsletterMsg] = React.useState("");
  const heroFileInputRef = React.useRef(null);

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

  const baseConfig = savedOverride || config || {};
  const liveConfig = editorMode ? (draft || normalizeHomeConfig(baseConfig)) : baseConfig;
  const theme = getDpgPublicTheme(liveConfig);

  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch("/api/public/posts?org=dpg", { headers: { Accept: "application/json" } });
        const data = await res.json().catch(() => ({}));
        if (dead) return;
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load posts");
        const posts = (Array.isArray(data.posts) ? data.posts : []).map((post) => ({
          ...post,
          publishedAt: post?.publishedAt || post?.published_at || "",
          featureImage: post?.featureImage || post?.feature_image || "",
          feature_image: post?.feature_image || post?.featureImage || "",
        }));
        setPostsState({ loading: false, posts, error: "" });
      } catch (e) {
        if (dead) return;
        setPostsState({ loading: false, posts: [], error: String(e?.message || e) });
      }
    })();
    return () => { dead = true; };
  }, []);

  const beginEditing = () => {
    setDraft(normalizeHomeConfig(baseConfig));
    setEditorMode(true);
    setActiveField("");
    setNavEditorOpen(false);
    setSaveMsg("");
  };

  const cancelEditing = () => {
    setDraft(normalizeHomeConfig(baseConfig));
    setEditorMode(false);
    setActiveField("");
    setNavEditorOpen(false);
    setSaveMsg("");
  };

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...(prev || normalizeHomeConfig(baseConfig)), [key]: value }));
  };

  const onChooseHeroImage = () => {
    heroFileInputRef.current?.click();
  };

  const onHeroFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateDraft("hero_background_url", String(reader.result || ""));
      setActiveField("");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveDraft = async () => {
    const src = normalizeHomeConfig(draft || baseConfig);
    setSaveBusy(true);
    setSaveMsg("");
    try {
      const payload = {
        enabled: true,
        accent_color: String(src.accent_color || "#385032").trim(),
        hero_eyebrow: String(src.hero_eyebrow || "").trim(),
        hero_title: String(src.hero_title || "").trim(),
        hero_body: String(src.hero_body || "").trim(),
        hero_background_url: String(src.hero_background_url || "").trim(),
        organizer_title: String(src.organizer_title || "").trim(),
        organizer_body: String(src.organizer_body || "").trim(),
        bulletin_title: String(src.bulletin_title || "").trim(),
        bulletin_intro: String(src.bulletin_intro || "").trim(),
        nav_links: Array.isArray(src.nav_links) ? src.nav_links.filter((x) => x?.label && x?.url) : [],
        featured_post_slugs: Array.isArray(src.featured_post_slugs) ? src.featured_post_slugs.filter(Boolean).slice(0, 4) : [],
        sticky_cards: Array.isArray(src.sticky_cards) ? src.sticky_cards.filter((x) => x?.title || x?.text).slice(0, 4) : [],
        progress_items: Array.isArray(src.progress_items) ? src.progress_items.filter(Boolean).slice(0, 8) : [],
      };
      const r = await authFetch(`/api/orgs/dpg/public/save`, {
        method: "POST",
        body: payload,
      });
      const next = normalizeHomeConfig({ ...payload, ...(r.public || {}) });
      setSavedOverride(next);
      setDraft(next);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 1200);
    } catch (e) {
      setSaveMsg(e.message || "Failed to save");
    } finally {
      setSaveBusy(false);
    }
  };

  const stickyCards = Array.isArray(liveConfig?.sticky_cards) ? liveConfig.sticky_cards.slice(0, 4) : [];
  const progressItems = Array.isArray(liveConfig?.progress_items) ? liveConfig.progress_items : [];
  const navLinks = PUBLIC_NAV_LINKS;

  const heroBackground = String(liveConfig?.hero_background_url || '').trim();

  const selectedSlugs = Array.isArray(liveConfig?.featured_post_slugs)
    ? liveConfig.featured_post_slugs.map((s) => String(s || '').trim()).filter(Boolean)
    : [];

  const featuredPosts = selectedSlugs.length
    ? selectedSlugs
        .map((slug) => postsState.posts.find((p) => String(p?.slug || '') === slug))
        .filter(Boolean)
    : postsState.posts.slice(0, 4);

  const eyebrowText =
    String(liveConfig?.hero_title || liveConfig?.hero_eyebrow || 'Build it together before we even arrive.').trim()
    || 'Build it together before we even arrive.';

  const heroSubheading =
    String(liveConfig?.hero_body || '').trim()
    || 'A gathering for learning, sharing, building, and reflection';

  const accent = String(liveConfig?.accent_color || "#385032").trim() || "#385032";

  const setStickyField = (index, key, value) => {
    const next = [...stickyCards];
    while (next.length < 4) next.push({ title: "", text: "", tone: "#f3e28b" });
    next[index] = { ...(next[index] || {}), [key]: value };
    updateDraft("sticky_cards", next.filter((x) => x.title || x.text));
  };

  const setProgressField = (index, value) => {
    const next = [...progressItems];
    while (next.length < 8) next.push("");
    next[index] = value;
    updateDraft("progress_items", next.filter((x) => String(x || "").trim()));
  };

  const submitNewsletterSignup = async (e) => {
    e?.preventDefault();
    const email = String(newsletterForm.email || "").trim();
    const name = String(newsletterForm.name || "").trim();

    if (!email) {
      setNewsletterMsg("Enter an email address.");
      return;
    }

    setNewsletterBusy(true);
    setNewsletterMsg("");
    try {
      const res = await fetch("/api/public/newsletter-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orgId: "dpg",
          email,
          name,
          website: newsletterForm.website,
          _formStartedAt: newsletterForm._formStartedAt,
          source: "public_home",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      setNewsletterForm({
        name: "",
        email: "",
        website: "",
        _formStartedAt: Date.now(),
      });
      setNewsletterMsg(
        data?.alreadyExists && !data?.pendingConfirmation
          ? "You are already subscribed."
          : data?.confirmationSent
            ? "Check your email and confirm the signup before you are added to the newsletter."
            : "We saved the request, but could not send the confirmation email. Try again later."
      );
    } catch (err) {
      setNewsletterMsg(String(err?.message || err || "Signup failed"));
    } finally {
      setNewsletterBusy(false);
    }
  };

  return (
    <div style={{ ...theme.page, fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
      <style>{HOME_MOBILE_CSS}</style>
      {authState.authed ? (
        <button
          type="button"
          onClick={() => (editorMode ? cancelEditing() : beginEditing())}
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 50,
            border: 0,
            borderRadius: 999,
            padding: "12px 18px",
            background: editorMode ? "#f4f2eb" : accent,
            color: editorMode ? "#121715" : "#f3efe8",
            cursor: "pointer",
            fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
            fontWeight: 800,
            boxShadow: "0 14px 32px rgba(0,0,0,0.28)",
            backdropFilter: "blur(6px)",
          }}
        >
          {editorMode ? "Exit editor" : "Edit site"}
        </button>
      ) : null}

      {editorMode ? (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "10px 18px",
            background: "rgba(10,14,12,0.88)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <strong style={{ color: "#f3efe8", fontSize: 14 }}>Live editor</strong>
            <span style={{ color: "#8fa1ab", fontSize: 12 }}>
              Click real content to edit. Save only when you want to publish.
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#d7ddd8", fontSize: 13 }}>
              <span>Accent</span>
              <input
                type="color"
                value={accent}
                onChange={(e) => updateDraft("accent_color", e.target.value)}
                style={{ background: "transparent" }}
              />
            </label>
            {saveMsg ? (
              <span style={{ color: saveMsg.includes("Saved") ? "#9fd3ab" : "#ffb8b8", fontSize: 13 }}>
                {saveMsg}
              </span>
            ) : null}
            <button type="button" className="btn" onClick={cancelEditing} disabled={saveBusy}>
              Cancel
            </button>
            <button type="button" className="btn-red" onClick={saveDraft} disabled={saveBusy}>
              {saveBusy ? "Saving…" : "Save and publish"}
            </button>
          </div>
        </div>
      ) : null}

      <section
        style={{
          position: 'relative',
          minHeight: 720,
          background: heroBackground
            ? `linear-gradient(rgba(10,14,12,0.34), rgba(10,14,12,0.42)), url("${heroBackground}") center/cover no-repeat`
            : '#121715',
        }}
      >
        <NavBar
          links={navLinks}
          editorMode={editorMode}
          onOpenNavEditor={() => setNavEditorOpen((v) => !v)}
          authed={authState.authed}
          accent={accent}
        />
        <NavEditPopover
          links={navLinks}
          onChange={(next) => updateDraft("nav_links", next)}
          visible={editorMode && navEditorOpen}
          onClose={() => setNavEditorOpen(false)}
        />

        <div
          className="dpg-home-hero-inner"
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: 1240,
            margin: '0 auto',
            padding: navEditorOpen ? '260px 28px 110px' : '180px 28px 110px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 26,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <img
              src={DPG_BRAND.logoSrc}
              alt={DPG_BRAND.logoAlt}
              style={{ width: 86, height: 86, objectFit: 'contain' }}
            />
            <h1
              style={{
                margin: 0,
                color: accent,
                fontSize: 'clamp(2.4rem, 5.5vw, 5.8rem)',
                lineHeight: 1,
                fontFamily: 'var(--dpg-display-font, "Fancy Shadow", Georgia, serif)',
                textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                WebkitTextStroke: '0.35px rgba(255,255,255,0.28)',
              }}
            >
              {DPG_BRAND.name}
            </h1>
            <img
              src={DPG_BRAND.logoSrc}
              alt=""
              aria-hidden="true"
              style={{ width: 86, height: 86, objectFit: 'contain' }}
            />
          </div>

          <div style={{ marginTop: 24, maxWidth: 820, marginInline: "auto" }}>
            <InlineField
              editorMode={editorMode}
              editing={editorMode && activeField === "hero_body"}
              value={heroSubheading}
              onChange={(v) => updateDraft("hero_body", v)}
              onStartEdit={() => editorMode && setActiveField("hero_body")}
              onStopEdit={() => setActiveField("")}
              multiline
              placeholder="Hero subheading"
              hint="Edit subheading"
              style={{
                maxWidth: 820,
                margin: "0 auto",
                textAlign: "center",
                fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
                lineHeight: 1.2,
                fontFamily: 'Inter, system-ui, Arial, sans-serif',
                fontWeight: 500,
              }}
              displayStyle={{
                color: '#ffffff',
                fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
                lineHeight: 1.2,
                fontFamily: 'Inter, system-ui, Arial, sans-serif',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                borderRadius: 14,
              }}
            />
          </div>

          <div style={{ marginTop: 18, maxWidth: 760, marginInline: "auto" }}>
            <InlineField
              editorMode={editorMode}
              editing={editorMode && activeField === "hero_title"}
              value={eyebrowText}
              onChange={(v) => updateDraft("hero_title", v)}
              onStartEdit={() => editorMode && setActiveField("hero_title")}
              onStopEdit={() => setActiveField("")}
              placeholder="Eyebrow text"
              hint="Edit strapline"
              style={{
                maxWidth: 760,
                margin: "0 auto",
                textAlign: "center",
                fontSize: 16,
              }}
              displayStyle={{
                color: '#f3efe8',
                fontSize: 16,
                fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                borderRadius: 14,
              }}
            />
          </div>

          {editorMode && activeField === "hero_bg" ? (
            <div style={{ marginTop: 16, maxWidth: 760, marginInline: "auto" }}>
              <InlineTextEditor
                value={heroBackground}
                onChange={(v) => updateDraft("hero_background_url", v)}
                placeholder="Paste image URL here, or use Choose image"
              />
            </div>
          ) : null}

          {editorMode ? (
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <EditChip
                onClick={() => setActiveField(activeField === "hero_bg" ? "" : "hero_bg")}
                subtle
                active={activeField === "hero_bg"}
              >
                {activeField === "hero_bg" ? "Hide image field" : "Edit hero image"}
              </EditChip>
              <EditChip onClick={onChooseHeroImage} subtle>
                Choose image
              </EditChip>
              {heroBackground ? (
                <EditChip onClick={() => updateDraft("hero_background_url", "")} subtle>
                  Clear image
                </EditChip>
              ) : null}
              <input
                ref={heroFileInputRef}
                type="file"
                accept="image/*"
                onChange={onHeroFileChange}
                style={{ display: "none" }}
              />
            </div>
          ) : null}
        </div>
      </section>

      <div className='dpg-home-lower-shell' style={{ maxWidth: 1240, margin: '0 auto', padding: '34px 28px 80px' }}>
        <section style={{ display: 'grid', gap: 24, marginBottom: 42 }}>
          {postsState.loading ? <div style={{ color: '#d7ddd8' }}>Loading featured posts…</div> : null}
          {postsState.error ? <div style={{ color: 'crimson' }}>{postsState.error}</div> : null}
          {featuredPosts.map((post, idx) => (
            <FeaturedCard key={post.slug || idx} post={post} reverse={idx % 2 === 1} />
          ))}
        </section>

        {editorMode ? (
          <section style={{ marginBottom: 28 }}>
            <SectionHint>Featured post control</SectionHint>
            <EditChip
              onClick={() => setActiveField(activeField === "featured" ? "" : "featured")}
              subtle
              active={activeField === "featured"}
            >
              {activeField === "featured" ? "Hide featured slugs" : "Edit featured posts"}
            </EditChip>
          </section>
        ) : null}

        {editorMode && activeField === "featured" ? (
          <section style={{ marginBottom: 28 }}>
            <InlineStringListEditor
              title="Featured post slugs"
              items={selectedSlugs}
              onChange={(items) => updateDraft("featured_post_slugs", items)}
              limit={4}
              itemPlaceholder="featured-post-slug"
            />
          </section>
        ) : null}

        {stickyCards.length ? (
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 18,
              marginBottom: 30,
            }}
          >
            {stickyCards.map((card, idx) => {
              const titleKey = `sticky_${idx}_title`;
              const textKey = `sticky_${idx}_text`;
              return (
                <Sticky
                  key={`${card?.title || 'card'}-${idx}`}
                  title={
                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === titleKey}
                      value={card?.title || ''}
                      onChange={(v) => setStickyField(idx, "title", v)}
                      onStartEdit={() => editorMode && setActiveField(titleKey)}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Sticky title"
                      dark={false}
                      hint="Edit title"
                      displayStyle={{
                        color: '#171717',
                        fontSize: 15,
                        fontWeight: 800,
                        fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
                        borderRadius: 10,
                      }}
                    />
                  }
                  text={
                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === textKey}
                      value={card?.text || ''}
                      onChange={(v) => setStickyField(idx, "text", v)}
                      onStartEdit={() => editorMode && setActiveField(textKey)}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Sticky text"
                      multiline
                      dark={false}
                      hint="Edit note"
                      displayStyle={{
                        color: '#171717',
                        fontSize: 14,
                        lineHeight: 1.5,
                        fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
                        borderRadius: 10,
                      }}
                    />
                  }
                  tone={card?.tone || '#f3e28b'}
                  rotate={['-2deg', '1.5deg', '-1deg', '2deg'][idx] || '-1deg'}
                  dark={true}
                >
                  {editorMode ? (
                    <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, opacity: 0.86 }}>
                      <EditChip onClick={() => setActiveField(titleKey)} subtle active={activeField === titleKey}>Title</EditChip>
                      <EditChip onClick={() => setActiveField(textKey)} subtle active={activeField === textKey}>Body</EditChip>
                    </div>
                  ) : null}
                </Sticky>
              );
            })}
          </section>
        ) : null}

        <section
          className='dpg-home-lower-grid'
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 20,
            alignItems: 'start',
          }}
        >

          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ gridColumn: "1 / -1",  ...theme.card, color: '#f3efe8', borderRadius: 22, padding: 24 }}>
              <div
                style={{
                  marginBottom: 12,
                  color: "#8fa1ab",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Stay connected
              </div>

              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 10,
                  color: accent,
                  fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
                  fontWeight: 800,
                  fontSize: 24,
                }}
              >
                Newsletter signup
              </h3>

              <p
                style={{
                  marginTop: 0,
                  marginBottom: 14,
                  lineHeight: 1.6,
                  color: "#f3efe8",
                }}
              >
                Get updates about the gathering, announcements, and important logistics.
                This is separate from RSVP. Signing up here does not register you for the event.
              </p>

              <form onSubmit={submitNewsletterSignup} style={{ display: "grid", gap: 10 }}>
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-10000px",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                  }}
                >
                  <label>
                    Website
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={newsletterForm.website}
                      onChange={(e) => setNewsletterForm((prev) => ({ ...prev, website: e.target.value }))}
                    />
                  </label>
                </div>
                <input
                  value={newsletterForm.name}
                  onChange={(e) => setNewsletterForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Name (optional)"
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.08)",
                    color: "#f3efe8",
                    border: "1px solid rgba(255,255,255,0.16)",
                    padding: 12,
                    borderRadius: 12,
                    font: "inherit",
                  }}
                />
                <input
                  value={newsletterForm.email}
                  onChange={(e) => setNewsletterForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address"
                  type="email"
                  autoComplete="email"
                  required
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.08)",
                    color: "#f3efe8",
                    border: "1px solid rgba(255,255,255,0.16)",
                    padding: 12,
                    borderRadius: 12,
                    font: "inherit",
                  }}
                />
                <div style={{ color: "#b8c1cc", fontSize: 12, lineHeight: 1.5 }}>
                  By joining, you are asking Dual Power West to email you gathering updates and announcements. Every newsletter includes an unsubscribe link.
                </div>
                <button
                  type="submit"
                  disabled={newsletterBusy}
                  style={{
                    border: 0,
                    borderRadius: 999,
                    padding: "12px 16px",
                    background: accent,
                    color: "#121715",
                    fontWeight: 800,
                    cursor: newsletterBusy ? "default" : "pointer",
                    fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)',
                  }}
                >
                  {newsletterBusy ? "Signing up…" : "Join newsletter"}
                </button>
              </form>

              {newsletterMsg ? (
                <div
                  style={{
                    marginTop: 12,
                    color: newsletterMsg.toLowerCase().includes("fail") || newsletterMsg.toLowerCase().includes("invalid")
                      ? "#ffb8b8"
                      : "#9fd3ab",
                    fontSize: 14,
                  }}
                >
                  {newsletterMsg}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
