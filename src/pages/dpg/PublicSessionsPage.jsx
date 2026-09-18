import React from "react";
import { applyAppVariantToDocument } from "../../lib/appVariant.js";
import { getDpgPublicTheme, useDpgPublicSiteConfig } from "../../lib/dpgPublicSite.js";
import DpgSessionsPage from "./DpgSessionsPage.jsx";

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

function PublicNav({ links = [], authed = false, accent = "#93b4f0" }) {
  const items = Array.isArray(links) ? links : [];
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
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
  );
}

export default function PublicSessionsPage() {
  const { config } = useDpgPublicSiteConfig();
  const theme = getDpgPublicTheme(config);
  const [authState, setAuthState] = React.useState({ checked: false, authed: false });
  const accent = String(config?.accent_color || "#93b4f0").trim() || "#93b4f0";

  React.useEffect(() => {
    try {
      document.documentElement.dataset.app = "dpg";
      document.body.dataset.app = "dpg";
    } catch {}
    applyAppVariantToDocument();
    document.title = "Dual Power Gathering • Sessions";
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

  return (
    <div style={{ ...theme.page, fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 20px 80px" }}>
        <PublicNav links={PUBLIC_NAV_LINKS} authed={authState.authed} accent={accent} />
        <DpgSessionsPage />
      </div>
    </div>
  );
}
