import * as React from "react";
import { useParams } from "react-router-dom";
import DpgPublicHome from "./DpgPublicHome.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

async function authFetch(path, opts = {}) {
  const relative = path.startsWith("/") ? path : `/${path}`;
  const remote = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  const doReq = async (u) => {
    const res = await fetch(u, {
      ...opts,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });
    let j = {};
    try {
      j = await res.json();
    } catch {
      j = {};
    }
    if (!res.ok || j.ok === false) {
      throw new Error(j.error || j.message || `HTTP ${res.status}`);
    }
    return j;
  };

  try {
    return await doReq(relative);
  } catch {
    return await doReq(remote);
  }
}

export default function SiteEditor() {
  const { orgId } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState("");
  const [home, setHome] = React.useState(null);
  const [draft, setDraft] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setSaveMsg("");
    try {
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/public/get`, { method: "GET" });
      const pub = r.public || {};
      const normalized = {
        enabled: true,
        accent_color: String(pub.accent_color || "#385032"),
        hero_eyebrow: String(pub.hero_eyebrow || ""),
        hero_title: String(pub.hero_title || ""),
        hero_body: String(pub.hero_body || ""),
        hero_background_url: String(pub.hero_background_url || ""),
        organizer_title: String(pub.organizer_title || ""),
        organizer_body: String(pub.organizer_body || ""),
        bulletin_title: String(pub.bulletin_title || ""),
        bulletin_intro: String(pub.bulletin_intro || ""),
        nav_links: Array.isArray(pub.nav_links) ? pub.nav_links : [],
        featured_post_slugs: Array.isArray(pub.featured_post_slugs) ? pub.featured_post_slugs : [],
        sticky_cards: Array.isArray(pub.sticky_cards) ? pub.sticky_cards : [],
        progress_items: Array.isArray(pub.progress_items) ? pub.progress_items : [],
      };
      setHome(normalized);
      setDraft(normalized);
    } catch (e) {
      setSaveMsg(e.message || "Failed to load site editor");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const cancelEditing = React.useCallback(() => {
    setDraft(home);
    setSaveMsg("");
  }, [home]);

  const saveDraft = React.useCallback(async () => {
    if (!orgId || !draft) return;
    setSaveBusy(true);
    setSaveMsg("");
    try {
      const payload = {
        enabled: true,
        accent_color: String(draft.accent_color || "#385032").trim(),
        hero_eyebrow: String(draft.hero_eyebrow || "").trim(),
        hero_title: String(draft.hero_title || "").trim(),
        hero_body: String(draft.hero_body || "").trim(),
        hero_background_url: String(draft.hero_background_url || "").trim(),
        organizer_title: String(draft.organizer_title || "").trim(),
        organizer_body: String(draft.organizer_body || "").trim(),
        bulletin_title: String(draft.bulletin_title || "").trim(),
        bulletin_intro: String(draft.bulletin_intro || "").trim(),
        nav_links: Array.isArray(draft.nav_links) ? draft.nav_links.filter((x) => x?.label && x?.url) : [],
        featured_post_slugs: Array.isArray(draft.featured_post_slugs) ? draft.featured_post_slugs.filter(Boolean).slice(0, 4) : [],
        sticky_cards: Array.isArray(draft.sticky_cards) ? draft.sticky_cards.filter((x) => x?.title || x?.text).slice(0, 4) : [],
        progress_items: Array.isArray(draft.progress_items) ? draft.progress_items.filter(Boolean).slice(0, 8) : [],
      };
      const r = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/public/save`, {
        method: "POST",
        body: payload,
      });
      const next = { ...payload, ...(r.public || {}) };
      setHome(next);
      setDraft(next);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 1200);
    } catch (e) {
      setSaveMsg(e.message || "Failed to save");
    } finally {
      setSaveBusy(false);
    }
  }, [orgId, draft]);

  if (loading || !draft) {
    return (
      <div style={{ minHeight: "100vh", background: "#101513", color: "#f3efe8", padding: 24 }}>
        Loading site editor...
      </div>
    );
  }

  return (
    <DpgPublicHome
      editorMode={true}
      liveHome={draft}
      updateDraft={(key, value) => setDraft((prev) => ({ ...(prev || {}), [key]: value }))}
      saveDraft={saveDraft}
      cancelEditing={cancelEditing}
      saveBusy={saveBusy}
      saveMsg={saveMsg}
    />
  );
}
