import React from "react";

const DEFAULTS = {
  theme_mode: "dark",
  accent_color: "#385032",
  hero_eyebrow: "Dual Power Gathering",
  hero_title: "Build it together before we even arrive.",
  hero_body:
    "This is the new public front door for Dual Power Gathering. Public event info lives here. The private organizer workspace lives at /admin.",
  organizer_title: "Organizer entry",
  organizer_body:
    "Admin is using hash routes for now so the work can move without a full routing rewrite first.",
  bulletin_title: "Bulletin",
  bulletin_intro:
    "Updates, logistics, and public notes from Dual Power Gathering.",
  home_featured_bulletin_enabled: true,
  hero_background_url: "",
  featured_post_slugs: [],
  nav_links: [
    { label: "Home", url: "/" },
    { label: "About", url: "/about" },
    { label: "FAQ", url: "/faq" },
    { label: "Volunteer", url: "/volunteer" },
    { label: "Donate", url: "/donate" },
    { label: "Press", url: "/press" },
        { label: "DPG Shares", url: "/dpg-shares" },
    { label: "RSVP", url: "/rsvp" }
  ],
  sticky_cards: [
    {
      title: "RSVP first",
      text: "Start with simple email capture, then follow up with the fuller form by email.",
      tone: "#f3e28b"
    },
    {
      title: "Sessions",
      text: "Suggest ideas, upvote them, and volunteer to lead without flattening the real at-event whiteboard process.",
      tone: "#c7f2ff"
    },
    {
      title: "Ops center",
      text: "Drive, meetings, needs, inventory, people, and admin coordination all in one place instead of tool sprawl hell.",
      tone: "#dce8d6"
    },
    {
      title: "Accessibility + privacy",
      text: "Built to be usable and secure by default, not treated like an afterthought tacked on later.",
      tone: "#d9e8f8"
    }
  ],
  progress_items: [
    "Dedicated public site at the main domain",
    "Private organizer workspace at /admin",
    "Bondfire-style tools in Dual Power Gathering garb",
    "New attendee and session modules for DPG-specific workflows",
    "Email flow for RSVP confirmation and detailed follow-up form"
  ]
};

export async function fetchDpgPublicSiteConfig() {
  const res = await fetch("/api/orgs/dpg/public/get", {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load public config");
  const pub = data?.public || {};
  return {
    ...DEFAULTS,
    ...pub,
    sticky_cards: Array.isArray(pub?.sticky_cards) && pub.sticky_cards.length
      ? pub.sticky_cards.slice(0, 4).map((x, i) => ({
          title: String(x?.title || DEFAULTS.sticky_cards[i]?.title || "").trim(),
          text: String(x?.text || DEFAULTS.sticky_cards[i]?.text || "").trim(),
          tone: String(x?.tone || DEFAULTS.sticky_cards[i]?.tone || "#f3e28b").trim(),
        }))
      : DEFAULTS.sticky_cards,
    progress_items: Array.isArray(pub?.progress_items) && pub.progress_items.length
      ? pub.progress_items.slice(0, 8).map((x) => String(x || "").trim()).filter(Boolean)
      : DEFAULTS.progress_items,
  };
}

export function useDpgPublicSiteConfig() {
  const [state, setState] = React.useState({ loading: true, config: DEFAULTS, error: "" });

  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const config = await fetchDpgPublicSiteConfig();
        if (!dead) setState({ loading: false, config, error: "" });
      } catch (e) {
        if (!dead) {
          setState({
            loading: false,
            config: DEFAULTS,
            error: String(e?.message || e),
          });
        }
      }
    })();
    return () => { dead = true; };
  }, []);

  return state;
}

export function getDpgPublicTheme(pub = {}) {
  const accent = String(pub?.accent_color || "#385032");
  const dark = true;

  return {
    page: {
      minHeight: "100vh",
      background: dark ? "#121715" : "#f4f2eb",
      color: dark ? "#f3efe8" : "#171717",
    },
    shell: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "28px 20px 64px",
    },
    card: {
      border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(17,17,17,0.12)"}`,
      borderRadius: 18,
      padding: 18,
      background: dark ? "rgba(26,33,30,0.92)" : "rgba(255,255,255,0.88)",
      boxShadow: dark ? "0 10px 30px rgba(0,0,0,0.22)" : "0 10px 30px rgba(0,0,0,0.06)",
    },
    articleCard: {
      border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(17,17,17,0.12)"}`,
      borderRadius: 18,
      padding: 22,
      background: dark ? "rgba(26,33,30,0.94)" : "rgba(255,255,255,0.9)",
      lineHeight: 1.75,
    },
    link: {
      color: dark ? "#f3efe8" : "#171717",
      fontWeight: 800,
      textDecoration: "none",
    },
    button: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      padding: "0 18px",
      borderRadius: 999,
      textDecoration: "none",
      background: accent,
      color: "#fff",
      fontWeight: 800,
    },
  };
}
