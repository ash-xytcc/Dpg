export const APP_VARIANT_KEY = "bf_app_variant";

function safeUrl() {
  try {
    return new URL(window.location.href);
  } catch {
    return null;
  }
}

export function getAppVariant() {
  if (typeof window === "undefined") return "bondfire";

  try {
    const host = String(window.location.hostname || "").toLowerCase();
    if (host === "dualpowerwest.org" || host === "www.dualpowerwest.org" || host === "dualpowergathering.org" || host === "www.dualpowergathering.org") {
      localStorage.setItem(APP_VARIANT_KEY, "dpg");
      return "dpg";
    }
  } catch {}

  try {
    const url = safeUrl();
    const qp = url?.searchParams?.get("app");
    if (qp === "dpg") {
      localStorage.setItem(APP_VARIANT_KEY, "dpg");
      return "dpg";
    }
    if (qp === "bondfire") {
      localStorage.setItem(APP_VARIANT_KEY, "bondfire");
      return "bondfire";
    }
  } catch {}

  try {
    const saved = localStorage.getItem(APP_VARIANT_KEY);
    if (saved === "dpg" || saved === "bondfire") return saved;
  } catch {}

  return "bondfire";
}

export function isDpgVariant() {
  try {
    const h = window.location.hash || "";
    const p = window.location.pathname || "";

    // support BOTH legacy ?app=dpg AND new real routes
    if (h.includes("/dpg/") || h.includes("/org/dpg/")) return true;
    if (p.includes("/dpg/") || p.includes("/org/dpg/")) return true;

    // legacy support
    const params = new URLSearchParams(window.location.search);
    if (params.get("app") === "dpg") return true;

    return false;
  } catch {
    return false;
  }
}

export function applyAppVariantToDocument() {
  try {
    const dpg = isDpgVariant();

    document.documentElement.dataset.app = dpg ? "dpg" : "bondfire";
    document.body.dataset.app = dpg ? "dpg" : "bondfire";

    const fontIds = ["dpg-font-formulario", "dpg-font-fancy-shadow"];
    fontIds.forEach((id) => {
      const existing = document.getElementById(id);
      if (existing && !dpg) existing.remove();
    });

    if (dpg) {
      const fontLinks = [
        { id: "dpg-font-formulario", href: "/fonts/Formulario-1312.ttf" },
        { id: "dpg-font-fancy-shadow", href: "/fonts/FancyShadow.ttf" },
      ];

      for (const f of fontLinks) {
        if (!document.getElementById(f.id)) {
          const link = document.createElement("link");
          link.id = f.id;
          link.rel = "preload";
          link.as = "font";
          link.type = "font/ttf";
          link.href = f.href;
          link.crossOrigin = "anonymous";
          document.head.appendChild(link);
        }
      }
    }

    const styleId = "dpg-global-theme";
    let styleEl = document.getElementById(styleId);

    if (!dpg) {
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      @font-face {
        font-family: "Fancy Shadow";
        src: url("/fonts/FancyShadow.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "Formulario 1312";
        src: url("/fonts/Formulario-1312.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }

      :root[data-app="dpg"],
      body[data-app="dpg"] {
        --dpg-bg: #121715;
        --dpg-surface: #1a211e;
        --dpg-surface-2: #202825;
        --dpg-text: #f3efe8;
        --dpg-muted: #b8c1cc;
        --dpg-line: rgba(255,255,255,0.14);
        --dpg-primary: #264636;
        --dpg-accent: #c7e6d2;
        --dpg-accent-deep: #5f94dd;
        --dpg-font: "Formulario 1312", Inter, system-ui, "Segoe UI", Arial, sans-serif;
        --dpg-display-font: "Fancy Shadow", Georgia, serif;
      }

      html[data-app="dpg"],
      body[data-app="dpg"] {
        background: var(--dpg-bg) !important;
        color: var(--dpg-text) !important;
        font-family: var(--dpg-font) !important;
      }

      body[data-app="dpg"],
      body[data-app="dpg"] *,
      body[data-app="dpg"] *:not(svg):not(path):not(code):not(pre) {
        font-family: var(--dpg-font) !important;
      }

      body[data-app="dpg"] #root,
      body[data-app="dpg"] .app,
      body[data-app="dpg"] .app-shell,
      body[data-app="dpg"] .page,
      body[data-app="dpg"] .main,
      body[data-app="dpg"] main {
        background: var(--dpg-bg) !important;
        color: var(--dpg-text) !important;
      }

      body[data-app="dpg"] header,
      body[data-app="dpg"] nav,
      body[data-app="dpg"] .topbar,
      body[data-app="dpg"] .app-header,
      body[data-app="dpg"] .bf-appHeader {
        background: #173126 !important;
        color: #f3efe8 !important;
        border-color: var(--dpg-line) !important;
      }

      body[data-app="dpg"] button,
      body[data-app="dpg"] .btn,
      body[data-app="dpg"] a[role="button"] {
        border-radius: 14px !important;
      }

      
      body[data-app="dpg"] button:not(.danger):not(.destructive),
      body[data-app="dpg"] .btn:not(.danger):not(.destructive),
      body[data-app="dpg"] .tab,
      body[data-app="dpg"] .nav-pill,
      body[data-app="dpg"] .chip,
      body[data-app="dpg"] .bf-appnav-link,
      body[data-app="dpg"] .bf-logout,
      body[data-app="dpg"] .bf-hamburger {
        background: #315341 !important;
        color: #f4f7f5 !important;
        border: 1px solid rgba(255,255,255,0.18) !important;
        box-shadow: none !important;
        text-shadow: 0 1px 1px rgba(0,0,0,0.92) !important;
      }

      /* hover state */
      body[data-app="dpg"] button:hover,
      body[data-app="dpg"] .btn:hover,
      body[data-app="dpg"] .tab:hover,
      body[data-app="dpg"] .nav-pill:hover,
      body[data-app="dpg"] .bf-appnav-link:hover,
      body[data-app="dpg"] .bf-logout:hover,
      body[data-app="dpg"] .bf-hamburger:hover {
        background: #3a624d !important;
        color: #ffffff !important;
        text-shadow: 0 1px 1px rgba(0,0,0,0.96) !important;
      }

      /* active / selected (blue) */
      body[data-app="dpg"] .active,
      body[data-app="dpg"] .is-active,
      body[data-app="dpg"] [aria-current="page"],
      body[data-app="dpg"] .selected {
        background: #78a8ea !important;
        color: #ffffff !important;
        border-color: rgba(255,255,255,0.35) !important;
        text-shadow: 0 1px 1px rgba(0,0,0,0.98), 0 0 2px rgba(255,255,255,0.14) !important;
      }

      /* primary buttons (blue ones like Sign in) */
      body[data-app="dpg"] .btn-red {
        background: var(--dpg-accent-deep) !important;
        color: #1a2230 !important;
        border: 1px solid var(--dpg-accent) !important;
        text-shadow: 0 2px 0 rgba(0,0,0,0.88), 0 0 4px rgba(255,255,255,0.22);
      }

      body[data-app="dpg"] .bf-appnav-link,
      body[data-app="dpg"] .bf-logout {
        padding: 8px 10px !important;
        font-size: 12px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
      }

      body[data-app="dpg"] .bf-hamburger {
        padding: 8px 9px !important;
      }

      body[data-app="dpg"] .bf-brand {
        font-size: 0.96rem !important;
        min-width: 0 !important;
      }

      body[data-app="dpg"] .bf-brand,
      body[data-app="dpg"] .bf-brand span,
      body[data-app="dpg"] .bf-brand-org,
      body[data-app="dpg"] .bf-org-name {
        color: #f3efe8 !important;
        text-shadow: 0 2px 0 rgba(0,0,0,0.88), 0 0 4px rgba(255,255,255,0.22);
      }

      body[data-app="dpg"] .bf-appnav-link.is-active,
      body[data-app="dpg"] .bf-appnav-link[aria-current="page"],
      body[data-app="dpg"] .active,
      body[data-app="dpg"] .is-active,
      body[data-app="dpg"] [aria-current="page"],
      body[data-app="dpg"] .selected {
        text-shadow: 0 2px 0 rgba(0,0,0,0.88), 0 0 4px rgba(255,255,255,0.22);
      }


      body[data-app="dpg"] .bf-appnav-link,
      body[data-app="dpg"] .bf-logout {
        color: #f4f7f5 !important;
        text-shadow: 0 1px 1px rgba(0,0,0,0.92) !important;
      }

      body[data-app="dpg"] .bf-appnav-link.is-active,
      body[data-app="dpg"] .bf-appnav-link[aria-current="page"] {
        color: #ffffff !important;
        text-shadow: 0 1px 1px rgba(0,0,0,0.98), 0 0 2px rgba(255,255,255,0.14) !important;
      }

      body[data-app="dpg"] .card button[title],
      body[data-app="dpg"] .card .btn,
      body[data-app="dpg"] .card .btn i,
      body[data-app="dpg"] .card button[title] i,
      body[data-app="dpg"] .card button[title] span {
        color: #f4f7f5 !important;
        text-shadow: 0 1px 1px rgba(0,0,0,0.92) !important;
      }

      body[data-app="dpg"] .bf-brand,
      body[data-app="dpg"] .bf-brand span {
        color: #f4f7f5 !important;
        text-shadow: 0 1px 1px rgba(0,0,0,0.92) !important;
      }

      body[data-app="dpg"] h1,
      body[data-app="dpg"] h2.section-title,
      body[data-app="dpg"] .section-title {
        text-shadow: 0 2px 0 rgba(0,0,0,0.88), 0 0 4px rgba(255,255,255,0.22);
      }

      body[data-app="dpg"] button:hover,
      body[data-app="dpg"] .btn:hover,
      body[data-app="dpg"] .tab:hover,
      body[data-app="dpg"] .nav-pill:hover,
      body[data-app="dpg"] .bf-appnav-link:hover,
      body[data-app="dpg"] .bf-logout:hover,
      body[data-app="dpg"] .bf-hamburger:hover {
        background: #3a624d !important;
      }

      body[data-app="dpg"] .active,
      body[data-app="dpg"] .is-active,
      body[data-app="dpg"] [aria-current="page"],
      body[data-app="dpg"] .selected {
        background: var(--dpg-accent-deep) !important;
        color: #ffffff !important;
        border-color: var(--dpg-accent) !important;
      }

      body[data-app="dpg"] input,
      body[data-app="dpg"] textarea,
      body[data-app="dpg"] select,
      body[data-app="dpg"] .input,
      body[data-app="dpg"] .textarea,
      body[data-app="dpg"] .search,
      body[data-app="dpg"] .searchbar {
        background: #202825 !important;
        color: var(--dpg-text) !important;
        border: 1px solid var(--dpg-line) !important;
      }

      body[data-app="dpg"] input::placeholder,
      body[data-app="dpg"] textarea::placeholder {
        color: var(--dpg-muted) !important;
      }

      body[data-app="dpg"] .card,
      body[data-app="dpg"] .panel,
      body[data-app="dpg"] .tile,
      body[data-app="dpg"] .section,
      body[data-app="dpg"] .modal,
      body[data-app="dpg"] .sheet,
      body[data-app="dpg"] .kpi,
      body[data-app="dpg"] .bf-rowcard,
      body[data-app="dpg"] .bf-stat-card,
      body[data-app="dpg"] .bfDashCard,
      body[data-app="dpg"] .bfDashPanel,
      body[data-app="dpg"] .bfDashMeetingsPanel,
      body[data-app="dpg"] .bfDashNeedsPanel,
      body[data-app="dpg"] .bfDashMobileRowCard {
        background: var(--dpg-surface) !important;
        color: var(--dpg-text) !important;
        border: 1px solid var(--dpg-line) !important;
      }

      body[data-app="dpg"] .helper,
      body[data-app="dpg"] small,
      body[data-app="dpg"] .muted,
      body[data-app="dpg"] .text-muted,
      body[data-app="dpg"] [class*="muted"] {
        color: var(--dpg-muted) !important;
      }

      body[data-app="dpg"] [class*="drive"],
      body[data-app="dpg"] [class*="Drive"],
      body[data-app="dpg"] [class*="editor"],
      body[data-app="dpg"] [class*="Editor"],
      body[data-app="dpg"] [class*="preview"],
      body[data-app="dpg"] [class*="Preview"] {
        color: var(--dpg-text) !important;
      }

      body[data-app="dpg"] .ql-toolbar,
      body[data-app="dpg"] .ql-container,
      body[data-app="dpg"] .cm-editor,
      body[data-app="dpg"] .cm-scroller,
      body[data-app="dpg"] .cm-content,
      body[data-app="dpg"] .ProseMirror,
      body[data-app="dpg"] .tiptap,
      body[data-app="dpg"] .markdown-body,
      body[data-app="dpg"] [contenteditable="true"] {
        background: var(--dpg-surface-2) !important;
        color: var(--dpg-text) !important;
        border-color: var(--dpg-line) !important;
        filter: none !important;
      }

      body[data-app="dpg"] .ql-toolbar,
      body[data-app="dpg"] .editor-toolbar,
      body[data-app="dpg"] .toolbar,
      body[data-app="dpg"] .sidebar,
      body[data-app="dpg"] .leftbar,
      body[data-app="dpg"] .explorer {
        background: var(--dpg-surface) !important;
        color: var(--dpg-text) !important;
        border-color: var(--dpg-line) !important;
      }

      body[data-app="dpg"] h1,
      body[data-app="dpg"] h2,
      body[data-app="dpg"] h3,
      body[data-app="dpg"] h4,
      body[data-app="dpg"] h5,
      body[data-app="dpg"] h6,
      body[data-app="dpg"] .bf-auth-shell h1,
      body[data-app="dpg"] .dpg-display-font {
        color: #f3efe8 !important;
        font-family: var(--dpg-display-font) !important;
        letter-spacing: .01em !important;
      }

      /* global readable text fix */
      body[data-app="dpg"] button,
      body[data-app="dpg"] .btn,
      body[data-app="dpg"] .bf-appnav-link {
        text-shadow: 0 2px 0 rgba(0,0,0,0.88), 0 0 4px rgba(255,255,255,0.22);
      }

`;

    try {
      const killDarkModeToggle = () => {
        const nodes = Array.from(document.querySelectorAll("button, a, div"));
        for (const node of nodes) {
          const text = String(node.textContent || "").trim().toLowerCase();
          if (text === "dark mode" || text === "encrypt existing") {
            node.style.display = "none";
            node.setAttribute("aria-hidden", "true");
          }
        }
      };
      killDarkModeToggle();
      window.setTimeout(killDarkModeToggle, 50);
      window.setTimeout(killDarkModeToggle, 250);
      window.setTimeout(killDarkModeToggle, 1000);
    } catch {}
  } catch {}
}

export function getAppBrand() {
  const dpg = isDpgVariant();
  return dpg
    ? {
        name: "Dual Power Gathering",
        shortName: "DPW",
        publicSiteTitle: "Dual Power Gathering",
        homeHref: "/admin/#/orgs",
        adminLabel: "Dual Power Gathering admin",
        adminSignInHref: "/?app=dpg#/signin",
        footerLabel: "Powered by Bondfire",
        logoSrc: "/branding/dpg-logo.png",
        logoAlt: "Dual Power Gathering",
        colors: {
          green: "#385032",
          blue: "#5f94dd",
          blueDark: "#4f7fc0",
          mist: "#dbe6f5",
          paper: "#f4f2eb",
        },
      }
    : {
        name: "Bondfire",
        shortName: "Bondfire",
        publicSiteTitle: "Bondfire",
        homeHref: "/orgs",
        adminLabel: "Bondfire admin",
        adminSignInHref: "/#/signin",
        footerLabel: "",
        logoSrc: "/logo-bondfire.png",
        logoAlt: "Bondfire logo",
        colors: {
          green: "#b3261e",
          blue: "#b3261e",
          blueDark: "#8b1f18",
          mist: "#f5f5f5",
          paper: "#111111",
        },
      };
}

export function getBranding() {
  return getAppBrand();
}

export function getAdminBasePath() {
  return "";
}

      
