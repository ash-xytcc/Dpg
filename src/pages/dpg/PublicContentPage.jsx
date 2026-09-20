import React from "react";
import { applyAppVariantToDocument } from "../../lib/appVariant.js";
import { getDpgPublicTheme, useDpgPublicSiteConfig } from "../../lib/dpgPublicSite.js";
import { getDpgPublicPage } from "../../lib/dpgPublicPages.js";

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

const PUBLIC_PAGE_MOBILE_CSS = `
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
    .dpg-public-page-shell {
      padding: 24px 16px 72px !important;
    }
  }
`;

function authFetch(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  return fetch(path, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }
    return data;
  });
}

function PublicNav({ links = [], authed = false, accent = "#93b4f0" }) {
  const items = Array.isArray(links) ? links : [];

  return (
    <>
      <style>{PUBLIC_PAGE_MOBILE_CSS}</style>
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

  if (!enabled) return <div style={displayStyle}>{children}</div>;

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

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        cursor: enabled ? "text" : "default",
        borderRadius: 12,
        outline: `1px dashed ${borderColor}`,
        outlineOffset: 4,
        transition: "outline-color 140ms ease",
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
            background: dark ? "rgba(7,10,9,0.82)" : "rgba(255,255,255,0.86)",
            color: dark ? "#d7ddd8" : "#1a1f1c",
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
  onBlur,
  onKeyDown,
  style = {},
  placeholder = "",
  multiline = false,
  dark = true,
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
        style={{ ...baseStyle, minHeight: 88, resize: "vertical" }}
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

function InlineField({
  editorMode = false,
  editing = false,
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
    if (!multiline && e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") e.currentTarget.blur();
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

function PageHero({
  accent,
  editorMode,
  activeField,
  setActiveField,
  prefix,
  content,
  setContent,
}) {
  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 22,
        alignItems: "center",
        marginBottom: 28,
      }}
    >
      <img
        src={DPG_BRAND.logoSrc}
        alt={DPG_BRAND.logoAlt}
        style={{
          width: 84,
          height: 84,
          objectFit: "contain",
          filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.22))",
        }}
      />
      <div>
        <InlineField
          editorMode={editorMode}
          editing={editorMode && activeField === `${prefix}_eyebrow`}
          value={content.eyebrow}
          onChange={(v) => setContent({ ...content, eyebrow: v })}
          onStartEdit={() => setActiveField(`${prefix}_eyebrow`)}
          onStopEdit={() => setActiveField("")}
          placeholder="Eyebrow"
          hint="Edit eyebrow"
          display={content.eyebrow}
          displayStyle={{
            color: "#d7ddd8",
            marginBottom: 10,
            fontSize: 15,
            borderRadius: 10,
          }}
        />
        <InlineField
          editorMode={editorMode}
          editing={editorMode && activeField === `${prefix}_title`}
          value={content.title}
          onChange={(v) => setContent({ ...content, title: v })}
          onStartEdit={() => setActiveField(`${prefix}_title`)}
          onStopEdit={() => setActiveField("")}
          placeholder="Title"
          hint="Edit title"
          display={content.title}
          displayStyle={{
            margin: 0,
            color: accent,
            fontSize: "clamp(2.6rem, 6vw, 5.4rem)",
            lineHeight: 0.95,
            fontFamily: 'var(--dpg-display-font, "Fancy Shadow", Georgia, serif)',
            textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            borderRadius: 14,
          }}
          style={{
            fontSize: "clamp(2.6rem, 6vw, 5.4rem)",
            lineHeight: 0.95,
            fontFamily: 'var(--dpg-display-font, "Fancy Shadow", Georgia, serif)',
          }}
        />
        <div style={{ marginTop: 14 }}>
          <InlineField
            editorMode={editorMode}
            editing={editorMode && activeField === `${prefix}_intro`}
            value={content.intro}
            onChange={(v) => setContent({ ...content, intro: v })}
            onStartEdit={() => setActiveField(`${prefix}_intro`)}
            onStopEdit={() => setActiveField("")}
            placeholder="Intro"
            hint="Edit intro"
            display={content.intro}
            displayStyle={{
              color: "#f3efe8",
              fontSize: "1.12rem",
              lineHeight: 1.55,
              maxWidth: 860,
              borderRadius: 12,
            }}
          />
        </div>
      </div>
    </header>
  );
}



function normalizeAboutContent(src = {}) {
  return {
    eyebrow: String(src?.eyebrow || "Dual Power Gathering"),
    title: String(src?.title || "About"),
    hero_summary: String(src?.hero_summary || "a gathering for learning, sharing, building, and reflection"),
    sections: Array.isArray(src?.sections) && src.sections.length
      ? src.sections.slice(0, 3).map((x, i) => ({
          kicker: String(x?.kicker || ["What this is", "What we value", "How it works"][i] || ""),
          heading: String(x?.heading || ""),
          body: String(x?.body || ""),
        }))
      : [
          {
            kicker: "What this is",
            heading: "a gathering, not a performance",
            body: "Dual Power Gathering is a gathering for learning, sharing, building, and reflection across anti authoritarian and anti capitalist movements.",
          },
          {
            kicker: "What we value",
            heading: "trust, courage, and practical capacity",
            body: "We are building a space for trust, skill sharing, solidarity, and collective exploration. The point is not polished conference culture. The point is relationships, courage, and practical capacity.",
          },
          {
            kicker: "How it works",
            heading: "public front door, private organizer tools",
            body: "This public site is the front door. Organizer tools, internal logistics, and planning live behind sign in.",
          },
        ],
    quote_kicker: String(src?.quote_kicker || "Why this exists"),
    quote_text: String(src?.quote_text || "this is not a conference. it is a practice."),
    meta_rows: Array.isArray(src?.meta_rows) && src.meta_rows.length
      ? src.meta_rows.slice(0, 3).map((x, i) => ({
          label: String(x?.label || ["Structure", "Purpose", "Orientation"][i] || ""),
          value: String(x?.value || ""),
        }))
      : [
          {
            label: "Structure",
            value: "participant shaped, organizer supported, movement rooted",
          },
          {
            label: "Purpose",
            value: "build stronger relationships, sharper skills, and more durable forms of collective power",
          },
          {
            label: "Orientation",
            value: "anti authoritarian, anti capitalist, practical, collaborative",
          },
        ],
    sticky_title: String(src?.sticky_title || "come build something with us"),
    sticky_body: String(src?.sticky_body || "the goal is not polish. the goal is that people leave more connected, more capable, and more ready to act together."),
  };
}

function normalizeFaqContent(src = {}, page = {}) {
  const defaults = [
    {
      q: "What is Dual Power?",
      a: "Dual power is the project of building self determination, mutual aid, solidarity, and direct democracy in our communities by creating spaces that empower us all and from which new emancipatory institutions can emerge.",
    },
    {
      q: "Who is organizing Dual Power Gathering?",
      a: "Dual Power Gathering is an autonomous event being organized by a developing network of tenants, workers, and activists participating in Symbiosis Federation, Autonomous Tenants Union Network, the Industrial Workers of the World, and independent dual power projects across the country. We are not affiliated with any political party.",
    },
    {
      q: "Why do we think this is important?",
      a: "We come together from across the spectrum of anti authoritarian and anti capitalist tendencies, traditions, and organizations. We want a space where people can build trusting relationships, construct bridges, share ideas, and strengthen each other.",
    },
    {
      q: "What kind of event is this?",
      a: "The gathering uses an unconference structure. That means participants help create the agenda, shape sessions, and bring their own ideas, skills, and questions into the space.",
    },
    {
      q: "Will it be child friendly?",
      a: "Several core organizers have children and they will be part of the event. Child friendly planning is part of the event culture, not an afterthought.",
    },
    {
      q: "What happens after the gathering?",
      a: "We are not imposing a predetermined outcome. What comes next will be defined locally, and the networks built through the gathering will help inform, grow, and articulate the movements that emerge from it.",
    },
  ];

  return {
    eyebrow: String(src?.eyebrow || page?.eyebrow || "Questions people keep asking because apparently reading minds is still not a feature."),
    title: String(src?.title || page?.title || "FAQ"),
    intro: String(src?.intro || "Answers, context, and basic orientation without making people dig through a wall of text."),
    side_title: String(src?.side_title || "Quick read"),
    side_body: String(src?.side_body || "Start here if you want the shape of the thing before you decide whether to show up, volunteer, or send this to somebody else."),
    items: Array.isArray(src?.items) && src.items.length
      ? src.items.slice(0, 10).map((x) => ({
          q: String(x?.q || "").trim(),
          a: String(x?.a || "").trim(),
        })).filter((x) => x.q || x.a)
      : defaults,
  };
}

function normalizeVolunteerContent(src = {}, page = {}) {
  return {
    eyebrow: String(src?.eyebrow || page?.eyebrow || "This only works if people actually help, tragic but true."),
    title: String(src?.title || page?.title || "Volunteer"),
    intro: String(src?.intro || "We need help before, during, and around the gathering. Not in the abstract. In the real world where someone has to actually do things."),
    lead_title: String(src?.lead_title || "We need your help"),
    lead_body: String(src?.lead_body || "We need all kinds of help in advance of and during the Western Dual Power Gathering to pull these events off."),
    list_title: String(src?.list_title || "Current areas of need"),
    needs: Array.isArray(src?.needs) && src.needs.length
      ? src.needs.slice(0, 12).map((x) => {
          if (x && typeof x === "object") {
            return {
              label: String(x?.label || x?.title || "").trim(),
              link: String(x?.link || x?.url || "").trim(),
            };
          }
          return {
            label: String(x || "").trim(),
            link: "",
          };
        }).filter((x) => x.label)
      : [
          { label: "Food and kitchen support", link: "" },
          { label: "Transportation", link: "" },
          { label: "Childcare", link: "" },
          { label: "Outreach and getting the word out", link: "" },
          { label: "Camping gear sharing and sourcing", link: "" },
          { label: "Fundraising", link: "" },
          { label: "Facilitation", link: "" },
          { label: "Organizing and logistics", link: "" },
          { label: "Communications", link: "" },
          { label: "Training, workshops, and session support", link: "" },
        ],
    support_title: String(src?.support_title || "When help is needed"),
    support_body: String(src?.support_body || "We are looking for people who want to help during the event as well as people who want to help plan and organize beforehand."),
    contact_title: String(src?.contact_title || "Get involved"),
    contact_body: String(src?.contact_body || "If you want to get involved, email dualpowergathering@proton.me."),
    contact_discord_text: String(src?.contact_discord_text || "or join us on Discord"),
    contact_discord_label: String(src?.contact_discord_label || "Join Discord"),
    contact_discord_url: String(src?.contact_discord_url || ""),
    side_title: String(src?.side_title || "Good volunteer energy"),
    side_body: String(src?.side_body || "People who can follow through, coordinate with others, notice what is missing, and help without turning every practical task into a personal manifesto."),
    sticky_title: String(src?.sticky_title || "show up ready"),
    sticky_body: String(src?.sticky_body || "clarity, communication, and follow through are more useful than hype."),
  };
}

function normalizeDonateContent(src = {}, page = {}) {
  return {
    eyebrow: String(src?.eyebrow || page?.eyebrow || "Money is fake and yet unfortunately still useful."),
    title: String(src?.title || page?.title || "Donate"),
    intro: String(src?.intro || "The gathering is free to attend, but making it real still costs actual money in the cursed material world."),
    lead_title: String(src?.lead_title || "Help cover the real costs"),
    lead_body: String(src?.lead_body || "Dual Power Gathering is free for anyone to attend, but holding the gathering still costs money. Campsites, food, equipment, accessibility support, and travel all add up."),
    support_title: String(src?.support_title || "What donations support"),
    support_items: Array.isArray(src?.support_items) && src.support_items.length
      ? src.support_items.slice(0, 8).map((x) => String(x || "").trim()).filter(Boolean)
      : [
          "Campsites and shared infrastructure",
          "Food and kitchen costs",
          "Accessibility support",
          "Travel help for organizers and participants",
          "Equipment and event logistics",
          "Supplies that make the gathering actually function",
        ],
    impact_title: String(src?.impact_title || "Why it matters"),
    impact_body: String(src?.impact_body || "Donations help make the event more accessible, more materially stable, and less dependent on the personal sacrifice of whoever is already carrying too much."),
    cta_title: String(src?.cta_title || "Give what you can"),
    cta_body: String(src?.cta_body || "If you or someone you know would like to support the gathering, donations make the event more accessible and materially sustainable."),
    cta_url: String(src?.cta_url || "https://hcb.hackclub.com/donations/start/dual-power-gathering"),
    cta_label: String(src?.cta_label || "Donate to Dual Power Gathering"),
    receipt_title: String(src?.receipt_title || "Receipts and questions"),
    receipt_body: String(src?.receipt_body || "If you need a receipt or have questions, email dualpowergathering@proton.me."),
    side_title: String(src?.side_title || "Keep it usable"),
    side_body: String(src?.side_body || "The point is not luxury. The point is making the gathering materially possible without pricing people out or burning organizers down."),
    sticky_title: String(src?.sticky_title || "small amounts matter"),
    sticky_body: String(src?.sticky_body || "A lot of real support looks like many people giving what they can, not one mythical donor descending from the heavens."),
  };
}

function AboutPageLayout({ accent, editorMode = false, activeField = "", setActiveField = () => {}, content, setContent = () => {} }) {
  const updateSection = (index, key, value) => {
    const next = [...content.sections];
    next[index] = { ...(next[index] || {}), [key]: value };
    setContent({ ...content, sections: next });
  };

  const updateMeta = (index, key, value) => {
    const next = [...content.meta_rows];
    next[index] = { ...(next[index] || {}), [key]: value };
    setContent({ ...content, meta_rows: next });
  };

  return (
    <>
      <style>{`
        .dpg-about-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
          gap: 22px;
          align-items: start;
        }
        .dpg-about-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 24px 24px 22px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.16);
        }
        .dpg-about-side {
          display: grid;
          gap: 18px;
        }
        .dpg-about-quote {
          position: relative;
          overflow: hidden;
        }
        .dpg-about-quote::before {
          content: "";
          position: absolute;
          left: 18px;
          top: 22px;
          bottom: 22px;
          width: 3px;
          border-radius: 999px;
          background: ${accent};
          opacity: 0.9;
        }
        .dpg-about-sticky {
          background: #f3e28b;
          color: #171717;
          border-radius: 16px;
          padding: 18px;
          transform: rotate(1.2deg);
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 18px 36px rgba(0,0,0,0.16);
        }
        @media (max-width: 880px) {
          .dpg-about-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <PageHero
        accent={accent}
        editorMode={editorMode}
        activeField={activeField}
        setActiveField={setActiveField}
        prefix="about"
        content={content}
        setContent={setContent}
      />

      <section className="dpg-about-grid">
        <div style={{ display: "grid", gap: 18 }}>
          {content.sections.map((section, idx) => (
            <article key={`section-${idx}`} className="dpg-about-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === `section_${idx}_kicker`}
                value={section.kicker}
                onChange={(v) => updateSection(idx, "kicker", v)}
                onStartEdit={() => setActiveField(`section_${idx}_kicker`)}
                onStopEdit={() => setActiveField("")}
                placeholder="Section kicker"
                hint="Edit kicker"
                display={section.kicker}
                displayStyle={{ marginBottom: 10, color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === `section_${idx}_heading`}
                value={section.heading}
                onChange={(v) => updateSection(idx, "heading", v)}
                onStartEdit={() => setActiveField(`section_${idx}_heading`)}
                onStopEdit={() => setActiveField("")}
                placeholder="Section heading"
                hint="Edit heading"
                display={section.heading}
                displayStyle={{ margin: "0 0 12px", color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontSize: "1.05rem", lineHeight: 1.1, fontWeight: 800, letterSpacing: "0.02em", borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === `section_${idx}_body`}
                value={section.body}
                onChange={(v) => updateSection(idx, "body", v)}
                onStartEdit={() => setActiveField(`section_${idx}_body`)}
                onStopEdit={() => setActiveField("")}
                placeholder="Section body"
                multiline
                hint="Edit body"
                display={section.body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.72, fontSize: "1.06rem", borderRadius: 10 }}
              />
            </article>
          ))}
        </div>

        <aside className="dpg-about-side">
          <div className="dpg-about-card dpg-about-quote">
            <InlineField
              editorMode={editorMode}
              editing={editorMode && activeField === "quote_kicker"}
              value={content.quote_kicker}
              onChange={(v) => setContent({ ...content, quote_kicker: v })}
              onStartEdit={() => setActiveField("quote_kicker")}
              onStopEdit={() => setActiveField("")}
              placeholder="Quote kicker"
              hint="Edit kicker"
              display={content.quote_kicker}
              displayStyle={{ marginBottom: 10, color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 10 }}
            />
            <InlineField
              editorMode={editorMode}
              editing={editorMode && activeField === "quote_text"}
              value={content.quote_text}
              onChange={(v) => setContent({ ...content, quote_text: v })}
              onStartEdit={() => setActiveField("quote_text")}
              onStopEdit={() => setActiveField("")}
              placeholder="Quote text"
              multiline
              hint="Edit quote"
              display={content.quote_text}
              displayStyle={{ paddingLeft: 28, color: "#f3efe8", fontSize: "1.14rem", lineHeight: 1.58, borderRadius: 10 }}
            />
          </div>

          <div className="dpg-about-card" style={{ display: "grid", gap: 14 }}>
            {content.meta_rows.map((row, idx) => (
              <div key={`meta-${idx}`} style={{ display: "grid", gap: 4 }}>
                <InlineField
                  editorMode={editorMode}
                  editing={editorMode && activeField === `meta_${idx}_label`}
                  value={row.label}
                  onChange={(v) => updateMeta(idx, "label", v)}
                  onStartEdit={() => setActiveField(`meta_${idx}_label`)}
                  onStopEdit={() => setActiveField("")}
                  placeholder="Meta label"
                  hint="Edit label"
                  display={row.label}
                  displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 10 }}
                />
                <InlineField
                  editorMode={editorMode}
                  editing={editorMode && activeField === `meta_${idx}_value`}
                  value={row.value}
                  onChange={(v) => updateMeta(idx, "value", v)}
                  onStartEdit={() => setActiveField(`meta_${idx}_value`)}
                  onStopEdit={() => setActiveField("")}
                  placeholder="Meta value"
                  multiline
                  hint="Edit value"
                  display={row.value}
                  displayStyle={{ color: "#f3efe8", lineHeight: 1.58, borderRadius: 10 }}
                />
              </div>
            ))}
          </div>

          <div className="dpg-about-sticky">
            <InlineField
              editorMode={editorMode}
              editing={editorMode && activeField === "sticky_title"}
              value={content.sticky_title}
              onChange={(v) => setContent({ ...content, sticky_title: v })}
              onStartEdit={() => setActiveField("sticky_title")}
              onStopEdit={() => setActiveField("")}
              placeholder="Sticky title"
              hint="Edit title"
              dark={false}
              display={content.sticky_title}
              displayStyle={{ margin: "0 0 8px", color: "#171717", fontFamily: "Inter, system-ui, Arial, sans-serif", fontSize: "1rem", lineHeight: 1.1, fontWeight: 800, borderRadius: 10 }}
            />
            <InlineField
              editorMode={editorMode}
              editing={editorMode && activeField === "sticky_body"}
              value={content.sticky_body}
              onChange={(v) => setContent({ ...content, sticky_body: v })}
              onStartEdit={() => setActiveField("sticky_body")}
              onStopEdit={() => setActiveField("")}
              placeholder="Sticky body"
              multiline
              hint="Edit note"
              dark={false}
              display={content.sticky_body}
              displayStyle={{ color: "#171717", lineHeight: 1.56, fontSize: "0.98rem", borderRadius: 10 }}
            />
          </div>
        </aside>
      </section>
    </>
  );
}

function FaqPageLayout({ accent, editorMode = false, activeField = "", setActiveField = () => {}, content, setContent = () => {} }) {
  const [openIdx, setOpenIdx] = React.useState(0);

  const updateItem = (index, key, value) => {
    const next = [...content.items];
    next[index] = { ...(next[index] || {}), [key]: value };
    setContent({
      ...content,
      items: next.filter((x) => String(x?.q || "").trim() || String(x?.a || "").trim()),
    });
  };

  return (
    <>
      <style>{`
        .dpg-faq-shell { display: grid; gap: 24px; }
        .dpg-faq-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
          gap: 22px;
          align-items: start;
        }
        .dpg-faq-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.16);
        }
        .dpg-faq-item {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          overflow: hidden;
          background: rgba(255,255,255,0.02);
        }
        .dpg-faq-item + .dpg-faq-item { margin-top: 12px; }
        .dpg-faq-trigger {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          align-items: center;
          padding: 18px 18px 16px;
          background: transparent;
          border: 0;
          color: #f3efe8;
          text-align: left;
          cursor: pointer;
        }
        .dpg-faq-answer {
          padding: 0 18px 18px;
          color: #f3efe8;
          line-height: 1.72;
          font-size: 1.02rem;
        }
        .dpg-faq-side-note {
          background: #dce8d6;
          color: #171717;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 18px 36px rgba(0,0,0,0.16);
          border: 1px solid rgba(0,0,0,0.08);
        }
        @media (max-width: 920px) {
          .dpg-faq-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dpg-faq-shell">
        <PageHero
          accent={accent}
          editorMode={editorMode}
          activeField={activeField}
          setActiveField={setActiveField}
          prefix="faq"
          content={content}
          setContent={setContent}
        />

        <section className="dpg-faq-grid">
          <div className="dpg-faq-card">
            <div style={{ marginBottom: 16, color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
              Common questions
            </div>

            {content.items.map((item, idx) => {
              const open = openIdx === idx;
              return (
                <div className="dpg-faq-item" key={`faq-item-${idx}`}>
                  <button
                    type="button"
                    className="dpg-faq-trigger"
                    onClick={() => setOpenIdx(open ? -1 : idx)}
                  >
                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === `faq_q_${idx}`}
                      value={item.q}
                      onChange={(v) => updateItem(idx, "q", v)}
                      onStartEdit={() => setActiveField(`faq_q_${idx}`)}
                      onStopEdit={() => setActiveField("")}
                      placeholder={`Question ${idx + 1}`}
                      hint="Edit question"
                      display={item.q}
                      displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1.08rem", lineHeight: 1.25, borderRadius: 10 }}
                    />
                    <div style={{ color: accent, fontSize: 22, lineHeight: 1, transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 140ms ease" }}>
                      +
                    </div>
                  </button>

                  {open ? (
                    <div className="dpg-faq-answer">
                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `faq_a_${idx}`}
                        value={item.a}
                        onChange={(v) => updateItem(idx, "a", v)}
                        onStartEdit={() => setActiveField(`faq_a_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Answer ${idx + 1}`}
                        multiline
                        hint="Edit answer"
                        display={item.a}
                        displayStyle={{ color: "#f3efe8", lineHeight: 1.72, fontSize: "1.02rem", borderRadius: 10 }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

            {editorMode && content.items.length < 10 ? (
              <div style={{ marginTop: 14 }}>
                <EditChip
                  onClick={() => setContent({ ...content, items: [...content.items, { q: "New question", a: "New answer" }] })}
                  subtle
                >
                  Add question
                </EditChip>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div className="dpg-faq-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "faq_side_title"}
                value={content.side_title}
                onChange={(v) => setContent({ ...content, side_title: v })}
                onStartEdit={() => setActiveField("faq_side_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side title"
                hint="Edit label"
                display={content.side_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "faq_side_body"}
                value={content.side_body}
                onChange={(v) => setContent({ ...content, side_body: v })}
                onStartEdit={() => setActiveField("faq_side_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side body"
                multiline
                hint="Edit note"
                display={content.side_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </div>

            <div className="dpg-faq-side-note">
              <div style={{ color: "#171717", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
                Shortcut
              </div>
              <div style={{ color: "#171717", lineHeight: 1.58 }}>
                <a href="/rsvp" style={{ color: "#171717", textDecoration: "underline", fontWeight: 800 }}>RSVP</a> if you know you are coming. <a href="/volunteer" style={{ color: "#171717", textDecoration: "underline", fontWeight: 800 }}>Volunteer</a> if you want to help shape the thing. Send the FAQ to the person who is asking you six separate questions in a row.
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function VolunteerPageLayout({ accent, editorMode = false, activeField = "", setActiveField = () => {}, content, setContent = () => {} }) {
  const updateNeed = (index, key, value) => {
    const next = [...content.needs];
    while (next.length < 12) next.push({ label: "", link: "" });
    const current = next[index] && typeof next[index] === "object"
      ? next[index]
      : { label: String(next[index] || ""), link: "" };
    next[index] = { ...current, [key]: value };
    setContent({
      ...content,
      needs: next.filter((x) => String(x?.label || "").trim()),
    });
  };

  return (
    <>
      <style>{`
        .dpg-vol-shell { display: grid; gap: 24px; }
        .dpg-vol-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
          gap: 22px;
          align-items: start;
        }
        .dpg-vol-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.16);
        }
        .dpg-vol-needs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .dpg-vol-pill {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 14px 14px;
          color: #f3efe8;
          min-height: 62px;
          display: flex;
          align-items: center;
        }
        .dpg-vol-side {
          display: grid;
          gap: 18px;
        }
        .dpg-vol-sticky {
          background: #f3e28b;
          color: #171717;
          border-radius: 16px;
          padding: 18px;
          transform: rotate(1deg);
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 18px 36px rgba(0,0,0,0.16);
        }
        .dpg-vol-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-radius: 999px;
          background: ${accent};
          color: #121715;
          text-decoration: none;
          font-weight: 800;
        }
        .dpg-vol-discord {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-radius: 999px;
          background: #5865f2;
          color: #ffffff;
          text-decoration: none;
          font-weight: 800;
          box-shadow: 0 12px 28px rgba(88,101,242,0.28);
        }
        @media (max-width: 920px) {
          .dpg-vol-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dpg-vol-shell">
        <PageHero
          accent={accent}
          editorMode={editorMode}
          activeField={activeField}
          setActiveField={setActiveField}
          prefix="vol"
          content={content}
          setContent={setContent}
        />

        <section className="dpg-vol-grid">
          <div style={{ display: "grid", gap: 18 }}>
            <article className="dpg-vol-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_lead_title"}
                value={content.lead_title}
                onChange={(v) => setContent({ ...content, lead_title: v })}
                onStartEdit={() => setActiveField("vol_lead_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Lead title"
                hint="Edit title"
                display={content.lead_title}
                displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1.05, marginBottom: 14, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_lead_body"}
                value={content.lead_body}
                onChange={(v) => setContent({ ...content, lead_body: v })}
                onStartEdit={() => setActiveField("vol_lead_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Lead body"
                multiline
                hint="Edit intro block"
                display={content.lead_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, fontSize: "1.06rem", borderRadius: 10 }}
              />
            </article>

            <article className="dpg-vol-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_list_title"}
                value={content.list_title}
                onChange={(v) => setContent({ ...content, list_title: v })}
                onStartEdit={() => setActiveField("vol_list_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="List title"
                hint="Edit section label"
                display={content.list_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />

              <div className="dpg-vol-needs">
                {Array.from({ length: Math.max(content.needs.length, editorMode ? 10 : content.needs.length) }).map((_, idx) => {
                  const item = content.needs[idx] && typeof content.needs[idx] === "object"
                    ? content.needs[idx]
                    : { label: String(content.needs[idx] || ""), link: "" };
                  return (
                    <div className="dpg-vol-pill" key={`need-${idx}`} style={{ justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <InlineField
                          editorMode={editorMode}
                          editing={editorMode && activeField === `vol_need_${idx}`}
                          value={item.label}
                          onChange={(v) => updateNeed(idx, "label", v)}
                          onStartEdit={() => setActiveField(`vol_need_${idx}`)}
                          onStopEdit={() => setActiveField("")}
                          placeholder={`Need ${idx + 1}`}
                          hint="Edit need"
                          display={item.label || (editorMode ? "Empty need slot" : "")}
                          displayStyle={{ color: "#f3efe8", lineHeight: 1.45, width: "100%", borderRadius: 10 }}
                        />
                        {editorMode ? (
                          <div style={{ marginTop: 8 }}>
                            <InlineField
                              editorMode={editorMode}
                              editing={editorMode && activeField === `vol_need_link_${idx}`}
                              value={item.link || ""}
                              onChange={(v) => updateNeed(idx, "link", v)}
                              onStartEdit={() => setActiveField(`vol_need_link_${idx}`)}
                              onStopEdit={() => setActiveField("")}
                              placeholder="Discord invite URL"
                              hint="Edit Discord link"
                              display={item.link || "Set Discord invite URL"}
                              displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                            />
                          </div>
                        ) : null}
                      </div>

                    </div>
                  );
                })}
              </div>
            </article>

            <article className="dpg-vol-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_support_title"}
                value={content.support_title}
                onChange={(v) => setContent({ ...content, support_title: v })}
                onStartEdit={() => setActiveField("vol_support_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Support title"
                hint="Edit title"
                display={content.support_title}
                displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1.2rem", lineHeight: 1.1, marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_support_body"}
                value={content.support_body}
                onChange={(v) => setContent({ ...content, support_body: v })}
                onStartEdit={() => setActiveField("vol_support_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Support body"
                multiline
                hint="Edit body"
                display={content.support_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </article>
          </div>

          <aside className="dpg-vol-side">
            <div className="dpg-vol-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_contact_title"}
                value={content.contact_title}
                onChange={(v) => setContent({ ...content, contact_title: v })}
                onStartEdit={() => setActiveField("vol_contact_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Contact title"
                hint="Edit title"
                display={content.contact_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_contact_body"}
                value={content.contact_body}
                onChange={(v) => setContent({ ...content, contact_body: v })}
                onStartEdit={() => setActiveField("vol_contact_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Contact body"
                multiline
                hint="Edit contact"
                display={content.contact_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, marginBottom: 16, borderRadius: 10 }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <a
  href="mailto:dualpowergathering@proton.me"
  className="dpg-vol-cta"
>
  Email organizers
</a>

                <InlineField
                  editorMode={editorMode}
                  editing={editorMode && activeField === "vol_contact_discord_text"}
                  value={content.contact_discord_text}
                  onChange={(v) => setContent({ ...content, contact_discord_text: v })}
                  onStartEdit={() => setActiveField("vol_contact_discord_text")}
                  onStopEdit={() => setActiveField("")}
                  placeholder="Discord helper text"
                  hint="Edit Discord helper text"
                  display={content.contact_discord_text}
                  displayStyle={{ color: "#d7ddd8", fontSize: 14, borderRadius: 10 }}
                />

                {editorMode ? (
                  <div style={{ display: "grid", gap: 10, width: "100%" }}>
                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === "vol_contact_discord_label"}
                      value={content.contact_discord_label}
                      onChange={(v) => setContent({ ...content, contact_discord_label: v })}
                      onStartEdit={() => setActiveField("vol_contact_discord_label")}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Discord button label"
                      hint="Edit Discord button label"
                      display={content.contact_discord_label || "Set Discord button label"}
                      displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                    />
                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === "vol_contact_discord_url"}
                      value={content.contact_discord_url}
                      onChange={(v) => setContent({ ...content, contact_discord_url: v })}
                      onStartEdit={() => setActiveField("vol_contact_discord_url")}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Discord invite URL"
                      hint="Edit Discord invite link"
                      display={content.contact_discord_url || "Set Discord invite URL"}
                      displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                    />
                  </div>
                ) : content.contact_discord_url ? (
                  <a
                    href={content.contact_discord_url}
                    target="_blank"
                    rel="noreferrer"
                    className="dpg-vol-discord"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.317 4.369A19.791 19.791 0 0015.885 3c-.19.34-.4.8-.547 1.16a18.27 18.27 0 00-6.676 0A11.6 11.6 0 008.115 3a19.736 19.736 0 00-4.438 1.372C.533 9.046-.32 13.58.099 18.057a19.9 19.9 0 005.993 3.04c.484-.66.913-1.356 1.285-2.08-.707-.266-1.38-.596-2.012-.986.168-.123.333-.25.493-.381a13.94 13.94 0 0012.152 0c.161.131.326.258.494.381-.633.39-1.307.72-2.015.987.373.723.803 1.419 1.288 2.079a19.86 19.86 0 005.994-3.04c.5-5.177-.838-9.66-3.457-13.688zM8.02 14.844c-1.182 0-2.153-1.085-2.153-2.419 0-1.334.951-2.419 2.153-2.419 1.213 0 2.164 1.095 2.153 2.419 0 1.334-.94 2.419-2.153 2.419zm7.96 0c-1.182 0-2.153-1.085-2.153-2.419 0-1.334.951-2.419 2.153-2.419 1.213 0 2.164 1.095 2.153 2.419 0 1.334-.94 2.419-2.153 2.419z"/>
                    </svg>
                    {content.contact_discord_label || "Join Discord"}
                  </a>
                ) : null}
              </div>
            </div>

            <div className="dpg-vol-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_side_title"}
                value={content.side_title}
                onChange={(v) => setContent({ ...content, side_title: v })}
                onStartEdit={() => setActiveField("vol_side_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side title"
                hint="Edit label"
                display={content.side_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_side_body"}
                value={content.side_body}
                onChange={(v) => setContent({ ...content, side_body: v })}
                onStartEdit={() => setActiveField("vol_side_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side body"
                multiline
                hint="Edit note"
                display={content.side_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </div>

            <div className="dpg-vol-sticky">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_sticky_title"}
                value={content.sticky_title}
                onChange={(v) => setContent({ ...content, sticky_title: v })}
                onStartEdit={() => setActiveField("vol_sticky_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky title"
                hint="Edit title"
                dark={false}
                display={content.sticky_title}
                displayStyle={{ color: "#171717", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1rem", lineHeight: 1.1, marginBottom: 8, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "vol_sticky_body"}
                value={content.sticky_body}
                onChange={(v) => setContent({ ...content, sticky_body: v })}
                onStartEdit={() => setActiveField("vol_sticky_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky body"
                multiline
                hint="Edit note"
                dark={false}
                display={content.sticky_body}
                displayStyle={{ color: "#171717", lineHeight: 1.56, fontSize: "0.98rem", borderRadius: 10 }}
              />
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}

function DonatePageLayout({ accent, editorMode = false, activeField = "", setActiveField = () => {}, content, setContent = () => {} }) {
  const [hcbState, setHcbState] = React.useState({ loading: true, balanceCents: null, transactions: [], error: "" });

  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const res = await fetch("/api/public/hcb-summary", {
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (dead) return;
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        setHcbState({
          loading: false,
          balanceCents: data?.balanceCents == null ? null : (Number.isFinite(Number(data.balanceCents)) ? Number(data.balanceCents) : null),
          transactions: Array.isArray(data?.transactions) ? data.transactions : [],
          error: "",
        });
      } catch (e) {
        if (dead) return;
        setHcbState({
          loading: false,
          balanceCents: null,
          transactions: [],
          error: String(e?.message || e),
        });
      }
    })();
    return () => { dead = true; };
  }, []);

  const fmtMoney = (cents) => {
    if (cents == null || cents === "") return "Unavailable";
    const n = Number(cents);
    if (!Number.isFinite(n)) return "Unavailable";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n / 100);
  };

  const fmtTxnMoney = (tx) => {
    if (Number.isFinite(Number(tx?.amountCents))) {
      return fmtMoney(Number(tx.amountCents));
    }
    return String(tx?.amountText || "—");
  };

  const updateSupportItem = (index, value) => {
    const next = [...content.support_items];
    while (next.length < 8) next.push("");
    next[index] = value;
    setContent({ ...content, support_items: next.filter((x) => String(x || "").trim()) });
  };

  return (
    <>
      <style>{`
        .dpg-donate-shell { display: grid; gap: 24px; }
        .dpg-donate-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
          gap: 22px;
          align-items: start;
        }
        .dpg-donate-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.16);
        }
        .dpg-donate-support {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .dpg-donate-pill {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 14px;
          color: #f3efe8;
          min-height: 62px;
          display: flex;
          align-items: center;
        }
        .dpg-donate-side {
          display: grid;
          gap: 18px;
        }
        .dpg-donate-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 15px 18px;
          border-radius: 999px;
          background: ${accent};
          color: #121715;
          text-decoration: none;
          font-weight: 800;
          box-shadow: 0 12px 28px rgba(0,0,0,0.18);
        }
        .dpg-donate-inline-cta {
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
        .dpg-donate-hcb-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
        }
        .dpg-donate-hcb-value {
          color: #f3efe8;
          font-family: Inter, system-ui, Arial, sans-serif;
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 900;
          line-height: 1;
          margin: 8px 0 10px;
        }
        .dpg-donate-hcb-list {
          display: grid;
          gap: 12px;
          margin-top: 8px;
        }
        .dpg-donate-hcb-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: start;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .dpg-donate-hcb-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }
        @media (max-width: 920px) {
          .dpg-donate-grid { grid-template-columns: 1fr; }
          .dpg-donate-hcb-grid { grid-template-columns: 1fr; }
        }
        .dpg-donate-sticky {
          background: #f3e28b;
          color: #171717;
          border-radius: 16px;
          padding: 18px;
          transform: rotate(1deg);
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 18px 36px rgba(0,0,0,0.16);
        }
        @media (max-width: 920px) {
          .dpg-donate-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dpg-donate-shell">
        <PageHero
          accent={accent}
          editorMode={editorMode}
          activeField={activeField}
          setActiveField={setActiveField}
          prefix="donate"
          content={content}
          setContent={setContent}
        />

        <section className="dpg-donate-hcb-grid">
          <article className="dpg-donate-card">
            <div style={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
              Live HCB balance
            </div>
            <div className="dpg-donate-hcb-value">
              {hcbState.loading ? "Loading…" : fmtMoney(hcbState.balanceCents)}
            </div>
            <div style={{ color: "#d7ddd8", lineHeight: 1.6 }}>
              Public transparency data from HCB for Dual Power Gathering.
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <a
                  href="https://hcb.hackclub.com/dual-power-gathering"
                  target="_blank"
                  rel="noreferrer"
                  className="dpg-donate-inline-cta"
                  style={{ justifySelf: "start" }}
                >
                  Open full HCB page
                </a>

                <div style={{ color: "#d7ddd8", lineHeight: 1.6, maxWidth: "44ch" }}>
                  If you or someone you know would like to support the gathering, donations make the event more accessible and materially sustainable.
                </div>

                <a
                  href="https://hcb.hackclub.com/dual-power-gathering"
                  target="_blank"
                  rel="noreferrer"
                  className="dpg-donate-cta"
                  style={{ width: "auto", justifySelf: "start", minWidth: 280 }}
                >
                  Donate to Dual Power Gathering
                </a>
              </div>
            </div>
          </article>

          <article className="dpg-donate-card">
            <div style={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
              Recent transactions
            </div>

            {hcbState.loading ? (
              <div style={{ color: "#d7ddd8" }}>Loading transactions…</div>
            ) : hcbState.error ? (
              <div style={{ color: "#ffb8b8" }}>{hcbState.error}</div>
            ) : hcbState.transactions.length ? (
              <div className="dpg-donate-hcb-list">
                {hcbState.transactions.slice(0, 6).map((tx, idx) => (
                  <div className="dpg-donate-hcb-row" key={tx.id || idx}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#f3efe8", fontWeight: 800, wordBreak: "break-word" }}>
                        {tx.memo || "Transaction"}
                      </div>
                      <div style={{ color: "#8fa1ab", fontSize: 13, marginTop: 4 }}>
                        {tx.date ? new Date(tx.date).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <div style={{
                      color: Number(tx?.amountCents) < 0 ? "#ff8f8f" : "#8fe0ad",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}>
                      {fmtTxnMoney(tx)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#d7ddd8" }}>No transactions available.</div>
            )}
          </article>
        </section>

        <section className="dpg-donate-grid">
          <div style={{ display: "grid", gap: 18 }}>
            <article className="dpg-donate-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_lead_title"}
                value={content.lead_title}
                onChange={(v) => setContent({ ...content, lead_title: v })}
                onStartEdit={() => setActiveField("donate_lead_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Lead title"
                hint="Edit title"
                display={content.lead_title}
                displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1.05, marginBottom: 14, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_lead_body"}
                value={content.lead_body}
                onChange={(v) => setContent({ ...content, lead_body: v })}
                onStartEdit={() => setActiveField("donate_lead_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Lead body"
                multiline
                hint="Edit intro block"
                display={content.lead_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, fontSize: "1.06rem", borderRadius: 10 }}
              />
            </article>

            <article className="dpg-donate-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_support_title"}
                value={content.support_title}
                onChange={(v) => setContent({ ...content, support_title: v })}
                onStartEdit={() => setActiveField("donate_support_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Support title"
                hint="Edit section label"
                display={content.support_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />

              <div className="dpg-donate-support">
                {Array.from({ length: Math.max(content.support_items.length, editorMode ? 6 : content.support_items.length) }).map((_, idx) => {
                  const value = content.support_items[idx] || "";
                  return (
                    <div className="dpg-donate-pill" key={`support-${idx}`}>
                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `donate_support_${idx}`}
                        value={value}
                        onChange={(v) => updateSupportItem(idx, v)}
                        onStartEdit={() => setActiveField(`donate_support_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Support item ${idx + 1}`}
                        hint="Edit item"
                        display={value || (editorMode ? "Empty support slot" : "")}
                        displayStyle={{ color: "#f3efe8", lineHeight: 1.45, width: "100%", borderRadius: 10 }}
                      />
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="dpg-donate-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_impact_title"}
                value={content.impact_title}
                onChange={(v) => setContent({ ...content, impact_title: v })}
                onStartEdit={() => setActiveField("donate_impact_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Impact title"
                hint="Edit title"
                display={content.impact_title}
                displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1.2rem", lineHeight: 1.1, marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_impact_body"}
                value={content.impact_body}
                onChange={(v) => setContent({ ...content, impact_body: v })}
                onStartEdit={() => setActiveField("donate_impact_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Impact body"
                multiline
                hint="Edit body"
                display={content.impact_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </article>
          </div>

          <aside className="dpg-donate-side">
            <div className="dpg-donate-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_receipt_title"}
                value={content.receipt_title}
                onChange={(v) => setContent({ ...content, receipt_title: v })}
                onStartEdit={() => setActiveField("donate_receipt_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Receipt title"
                hint="Edit label"
                display={content.receipt_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_receipt_body"}
                value={content.receipt_body}
                onChange={(v) => setContent({ ...content, receipt_body: v })}
                onStartEdit={() => setActiveField("donate_receipt_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Receipt body"
                multiline
                hint="Edit note"
                display={content.receipt_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
              {!editorMode ? (
                <div style={{ marginTop: 14 }}>
                  <a
                    href="mailto:dualpowergathering@proton.me"
                    className="dpg-donate-inline-cta"
                  >
                    Email organizers
                  </a>
                </div>
              ) : null}
            </div>

            <div className="dpg-donate-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_side_title"}
                value={content.side_title}
                onChange={(v) => setContent({ ...content, side_title: v })}
                onStartEdit={() => setActiveField("donate_side_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side title"
                hint="Edit label"
                display={content.side_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_side_body"}
                value={content.side_body}
                onChange={(v) => setContent({ ...content, side_body: v })}
                onStartEdit={() => setActiveField("donate_side_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side body"
                multiline
                hint="Edit note"
                display={content.side_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </div>

            <div className="dpg-donate-sticky">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_sticky_title"}
                value={content.sticky_title}
                onChange={(v) => setContent({ ...content, sticky_title: v })}
                onStartEdit={() => setActiveField("donate_sticky_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky title"
                hint="Edit title"
                dark={false}
                display={content.sticky_title}
                displayStyle={{ color: "#171717", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1rem", lineHeight: 1.1, marginBottom: 8, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "donate_sticky_body"}
                value={content.sticky_body}
                onChange={(v) => setContent({ ...content, sticky_body: v })}
                onStartEdit={() => setActiveField("donate_sticky_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky body"
                multiline
                hint="Edit note"
                dark={false}
                display={content.sticky_body}
                displayStyle={{ color: "#171717", lineHeight: 1.56, fontSize: "0.98rem", borderRadius: 10 }}
              />
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}


function normalizeRsvpContent(src = {}, page = {}) {
  return {
    eyebrow: String(src?.eyebrow || page?.eyebrow || "Planning is easier when humans tell us they are coming."),
    title: String(src?.title || page?.title || "RSVP"),
    intro: String(src?.intro || "Let organizers know you are interested, coming, or still figuring it out so planning is based on reality instead of divination."),
    lead_title: String(src?.lead_title || "Tell us you are coming"),
    lead_body: String(src?.lead_body || "Attendance is free. RSVPing helps organizers plan for food, space, accessibility, camping, and follow up communication."),
    steps_title: String(src?.steps_title || "How this works"),
    steps: Array.isArray(src?.steps) && src.steps.length
      ? src.steps.slice(0, 6).map((x) => String(x || "").trim()).filter(Boolean)
      : [
          "Send a simple RSVP first so organizers know you are interested.",
          "Expect a follow up with more detailed logistics questions.",
          "Share access needs, camping needs, and other planning info early when you can.",
          "If your plans change, update organizers so planning stays usable.",
        ],
    primary_title: String(src?.primary_title || "RSVP now"),
    primary_body: String(src?.primary_body || "Use the main RSVP link to get yourself on the list and trigger follow up communication."),
    primary_label: String(src?.primary_label || "Email RSVP"),
    primary_url: String(src?.primary_url || "mailto:dualpowergathering@proton.me?subject=DPG%20RSVP"),
    secondary_title: String(src?.secondary_title || "Need details first"),
    secondary_body: String(src?.secondary_body || "If you are not ready to commit yet, read the FAQ, bulletin, and public updates first, then RSVP when you have what you need."),
    secondary_label: String(src?.secondary_label || "Read the FAQ"),
    secondary_url: String(src?.secondary_url || "/faq"),
    side_title: String(src?.side_title || "What helps organizers most"),
    side_body: String(src?.side_body || "A clear headcount is good. Early notice about accessibility, camping, travel, or childcare needs is even better."),
    sticky_title: String(src?.sticky_title || "plans change"),
    sticky_body: String(src?.sticky_body || "That is normal. Just update organizers when they do so the plan is not built on ghost attendance."),
  };
}


function normalizeSharesContent(src = {}, page = {}) {
  const defaultVideos = [
    {
      tag: "Featured session",
      title: "Building durable mutual aid infrastructure",
      description: "A long form session on logistics, continuity, and making projects survive beyond the event that birthed them.",
      duration: "48 min",
      meta: "DPG West 2026",
      thumb: "",
      href: "#",
    },
    {
      tag: "Interview",
      title: "Kitchen as infrastructure",
      description: "Movement kitchens as logistics hubs, relationship engines, and one of the few things nobody forgets to show up for.",
      duration: "23 min",
      meta: "Field interview",
      thumb: "",
      href: "#",
    },
    {
      tag: "Workshop",
      title: "Security culture for ordinary humans",
      description: "Practical habits, not theater. The boring stuff that actually keeps projects usable and people safer.",
      duration: "36 min",
      meta: "Recorded training",
      thumb: "",
      href: "#",
    },
    {
      tag: "Roundtable",
      title: "What we learned after the gathering",
      description: "Organizers and participants reflect on what worked, what broke, and what should exist next time on purpose.",
      duration: "57 min",
      meta: "Post event debrief",
      thumb: "",
      href: "#",
    },
    {
      tag: "Skill share",
      title: "Conflict, accountability, and repair",
      description: "A recorded conversation on how projects stay coherent when humans, inevitably, continue being humans.",
      duration: "31 min",
      meta: "Community session",
      thumb: "",
      href: "#",
    },
    {
      tag: "Archive",
      title: "Field notes from the edges",
      description: "Fragments, clips, and small recordings that still matter even when they are not polished enough for platform cosplay.",
      duration: "12 min",
      meta: "Clips and fragments",
      thumb: "",
      href: "#",
    },
  ];

  const normalizeVideo = (item = {}, fallback = {}) => ({
    tag: String(item?.tag || fallback?.tag || "").trim(),
    title: String(item?.title || fallback?.title || "").trim(),
    description: String(item?.description || fallback?.description || "").trim(),
    duration: String(item?.duration || fallback?.duration || "").trim(),
    meta: String(item?.meta || fallback?.meta || "").trim(),
    thumb: String(item?.thumb || item?.thumbnail || fallback?.thumb || "").trim(),
    href: String(item?.href || item?.url || fallback?.href || "").trim(),
  });

  const rawVideos = Array.isArray(src?.videos) && src.videos.length
    ? src.videos.slice(0, 12).map((item, idx) => normalizeVideo(item, defaultVideos[idx] || {}))
    : defaultVideos.map((item) => ({ ...item }));

  const videos = rawVideos.filter((item) =>
    item.title || item.description || item.tag || item.duration || item.meta || item.thumb || item.href
  );

  const featuredSource =
    src?.featured && typeof src.featured === "object"
      ? src.featured
      : videos[0] || defaultVideos[0];

  const featured = normalizeVideo(featuredSource, defaultVideos[0]);

  return {
    eyebrow: String(src?.eyebrow || page?.eyebrow || "A session archive, media commons, and public memory bank for DPG."),
    title: String(src?.title || page?.title || "DPG Shares"),
    intro: String(src?.intro || "A native video and media platform for session recordings, interviews, skill shares, and movement memory."),
    featured_label: String(src?.featured_label || "Featured session"),
    featured_title: String(src?.featured_title || "Featured session"),
    featured_body: String(src?.featured_body || "Featured recordings, interviews, and session media from Dual Power Gathering live here in a public archive built to stay usable over time."),
    featured: featured,
    grid_title: String(src?.grid_title || "Featured sessions"),
    grid_body: String(src?.grid_body || "Browse published sessions, interviews, and recordings from the archive."),
    videos,
    lead_title: String(src?.lead_title || "Build the archive, not just the moment"),
    lead_body: String(src?.lead_body || "DPG Shares is meant to become the place where session recordings, interviews, roundtables, trainings, and movement media can live natively instead of being scattered across other platforms."),
    vision_title: String(src?.vision_title || "What this platform should do"),
    vision_items: Array.isArray(src?.vision_items) && src.vision_items.length
      ? src.vision_items.slice(0, 8).map((x) => String(x || "").trim()).filter(Boolean)
      : [
          "Upload and host videos natively inside the DPG site",
          "Organize sessions into collections, tracks, and event years",
          "Support captions, descriptions, tags, and speaker metadata",
          "Make sessions searchable instead of burying them in a feed",
          "Highlight featured recordings on the public front end",
          "Preserve movement media without outsourcing the archive",
        ],
    build_title: String(src?.build_title || "Build phases"),
    build_items: Array.isArray(src?.build_items) && src.build_items.length
      ? src.build_items.slice(0, 6).map((x) => String(x || "").trim()).filter(Boolean)
      : [
          "Phase 1: public product page and platform framing",
          "Phase 2: uploader, database records, and hosted video storage",
          "Phase 3: collections, tags, thumbnails, and featured sessions",
          "Phase 4: permissions, moderation, and contributor workflows",
        ],
    cta_title: String(src?.cta_title || "What belongs here"),
    cta_body: String(src?.cta_body || "Session recordings, interviews, roundtables, workshop clips, organizer explainers, and media that would otherwise disappear into algorithmic landfill."),
    side_title: String(src?.side_title || "Why make this at all"),
    side_body: String(src?.side_body || "Movement media should be findable, maintainable, and rooted in the archive itself instead of scattered across outside platforms."),
    sticky_title: String(src?.sticky_title || "own the archive"),
    sticky_body: String(src?.sticky_body || "If the gathering matters, its record should stay organized, searchable, and ours."),
  };
}

function normalizeBulletinPost(post = {}) {
  return {
    ...post,
    slug: String(post?.slug || "").trim(),
    title: String(post?.title || "").trim(),
    excerpt: String(post?.excerpt || post?.summary || "").trim(),
    publishedAt: post?.publishedAt || post?.published_at || post?.createdAt || post?.created_at || "",
    featureImage: post?.featureImage || post?.feature_image || "",
  };
}

function extractBulletinPosts(data) {
  const raw =
    (Array.isArray(data?.posts) && data.posts) ||
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.results) && data.results) ||
    (Array.isArray(data) && data) ||
    [];

  return raw
    .map(normalizeBulletinPost)
    .filter((post) => post.slug && post.title);
}

async function fetchBulletinPostsForPress() {
  const attempts = [
    "/api/public/posts?org=dpg",
    "/api/public/posts?org=dpg&limit=6",
    "/api/public/bulletin?org=dpg",
    "/api/public/bulletin?org=dpg&limit=6",
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json().catch(() => ({}));
      const posts = extractBulletinPosts(data);
      if (res.ok && data?.ok !== false && posts.length) return posts.slice(0, 6);
      if (res.ok && data?.ok !== false && Array.isArray(posts)) return posts.slice(0, 6);
    } catch {}
  }

  return [];
}

function BulletinFeedCard({ post }) {
  const dateText = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "Public note";
  return (
    <a
      href={`/bulletin/${post.slug}`}
      style={{
        display: "grid",
        gap: 10,
        textDecoration: "none",
        color: "inherit",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        padding: 16,
      }}
    >
      {post.featureImage ? (
        <img
          src={post.featureImage}
          alt={post.title}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "cover",
            display: "block",
            borderRadius: 14,
          }}
        />
      ) : null}

      <div style={{ color: "#93b4f0", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
        {dateText}
      </div>

      <div
        style={{
          color: "#f3efe8",
          fontFamily: 'var(--dpg-display-font, "Fancy Shadow", Georgia, serif)',
          fontSize: "1.5rem",
          lineHeight: 0.98,
        }}
      >
        {post.title}
      </div>

      {post.excerpt ? (
        <div style={{ color: "#f3efe8", lineHeight: 1.6, fontSize: "0.98rem" }}>
          {post.excerpt}
        </div>
      ) : null}

      <div style={{ color: "#d7ddd8", fontWeight: 800, fontSize: 14 }}>
        Read update →
      </div>
    </a>
  );
}


function normalizePressContent(src = {}, page = {}) {
  return {
    eyebrow: String(src?.eyebrow || page?.eyebrow || "Media, roundtables, and traces left behind."),
    title: String(src?.title || page?.title || "Press"),
    intro: String(src?.intro || "Listen, watch, read, and track public material connected to Dual Power Gathering in one place."),
    featured_title: String(src?.featured_title || "Featured media"),
    updates_title: String(src?.updates_title || "From us"),
    updates_body: String(src?.updates_body || "Public notes, logistics, statements, and updates published directly by DPG."),
    side_title: String(src?.side_title || "What this section is for"),
    side_body: String(src?.side_body || "A place to collect both outside coverage and DPG’s own published material so people do not have to guess which tab contains the signal."),
    sticky_title: String(src?.sticky_title || "archive the signal"),
    sticky_body: String(src?.sticky_body || "media matters most when people can actually find it again later."),
    items: Array.isArray(src?.items) && src.items.length
      ? src.items.slice(0, 6).map((x, i) => ({
          type: String(x?.type || (i < 2 ? "embed" : "link")).trim() || "link",
          title: String(x?.title || "").trim(),
          url: String(x?.url || "").trim(),
          embedUrl: String(x?.embedUrl || x?.embed_url || x?.url || "").trim(),
          description: String(x?.description || "").trim(),
        })).filter((x) => x.title || x.url || x.embedUrl)
      : [
          {
            type: "embed",
            title: "Episode 8: Dual Power Gathering West Roundtable",
            url: "https://kolektiva.media/w/2im6KJj8NRBPbZwTxxAuwr",
            embedUrl: "https://kolektiva.media/videos/embed/2im6KJj8NRBPbZwTxxAuwr",
            description: "Round table discussion with participants and organizers reflecting on the gathering, what worked, what changed, and what should grow next.",
          },
          {
            type: "embed",
            title: "Molotov Now! interview",
            url: "https://kolektiva.media/w/bfGVFNr6yViDQD2nN8eHez",
            embedUrl: "https://kolektiva.media/videos/embed/bfGVFNr6yViDQD2nN8eHez",
            description: "Interview coverage connected to DPG West.",
          },
          {
            type: "embed",
            title: "This Is America #189",
            url: "https://itsgoingdown.org/this-is-america-189/",
            embedUrl: "https://media.blubrry.com/itsgoingdown/ia800507.us.archive.org/19/items/tia-189/TIA189.mp3",
            description: "Episode covering the Midwest Dual Power Gathering alongside organizing in Eugene and analysis of the Trump indictment. The DPG segment features two organizers discussing the gathering ahead of the Chicago event.",
          },
        ],
  };
}


function PressPageLayout({ accent, editorMode = false, activeField = "", setActiveField = () => {}, content, setContent = () => {} }) {
  const [bulletinState, setBulletinState] = React.useState({ loading: true, posts: [], error: "" });

  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const posts = await fetchBulletinPostsForPress();
        if (dead) return;
        setBulletinState({ loading: false, posts, error: "" });
      } catch (e) {
        if (dead) return;
        setBulletinState({ loading: false, posts: [], error: String(e?.message || e) });
      }
    })();
    return () => { dead = true; };
  }, []);

  const updateItem = (index, key, value) => {
    const next = [...content.items];
    next[index] = { ...(next[index] || {}), [key]: value };
    setContent({
      ...content,
      items: next.filter((x) => String(x?.title || "").trim() || String(x?.url || "").trim() || String(x?.embedUrl || "").trim()),
    });
  };

  return (
    <>
      <style>{`
        .dpg-press-shell { display: grid; gap: 24px; }
        .dpg-press-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
          gap: 22px;
          align-items: start;
        }
        .dpg-press-main {
          display: grid;
          gap: 18px;
        }
        .dpg-press-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.16);
        }
        .dpg-press-embed {
          width: 100%;
          aspect-ratio: 16 / 9;
          border: 0;
          border-radius: 18px;
          background: rgba(0,0,0,0.22);
          margin-top: 14px;
        }
        .dpg-press-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 14px;
        }
        .dpg-press-linkbtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 16px;
          border-radius: 999px;
          text-decoration: none;
          background: ${accent};
          color: #121715;
          font-weight: 800;
        }
        .dpg-press-ghostbtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 16px;
          border-radius: 999px;
          text-decoration: none;
          background: rgba(255,255,255,0.06);
          color: #f3efe8;
          border: 1px solid rgba(255,255,255,0.10);
          font-weight: 800;
        }
        .dpg-press-side {
          display: grid;
          gap: 18px;
        }
        .dpg-press-sticky {
          background: #f3e28b;
          color: #171717;
          border-radius: 16px;
          padding: 18px;
          transform: rotate(1deg);
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 18px 36px rgba(0,0,0,0.16);
        }
        @media (max-width: 920px) {
          .dpg-press-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dpg-press-shell">
        <PageHero
          accent={accent}
          editorMode={editorMode}
          activeField={activeField}
          setActiveField={setActiveField}
          prefix="press"
          content={content}
          setContent={setContent}
        />

        <section className="dpg-press-grid">
          <div className="dpg-press-main">
            <div className="dpg-press-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "press_featured_title"}
                value={content.featured_title}
                onChange={(v) => setContent({ ...content, featured_title: v })}
                onStartEdit={() => setActiveField("press_featured_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Featured title"
                hint="Edit section label"
                display={content.featured_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, borderRadius: 10 }}
              />

              <div style={{ display: "grid", gap: 18 }}>
                {content.items.map((item, idx) => (
                  <article
                    key={`press-${idx}`}
                    style={{
                      display: "grid",
                      gap: 10,
                      paddingBottom: idx < content.items.length - 1 ? 18 : 0,
                      borderBottom: idx < content.items.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {editorMode ? (
                        <EditChip
                          onClick={() => updateItem(idx, "type", item.type === "embed" ? "link" : "embed")}
                          subtle
                          active={item.type === "embed"}
                        >
                          {item.type === "embed" ? "Embedded" : "Link only"}
                        </EditChip>
                      ) : null}
                    </div>

                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === `press_title_${idx}`}
                      value={item.title}
                      onChange={(v) => updateItem(idx, "title", v)}
                      onStartEdit={() => setActiveField(`press_title_${idx}`)}
                      onStopEdit={() => setActiveField("")}
                      placeholder={`Media title ${idx + 1}`}
                      hint="Edit title"
                      display={item.title}
                      displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1.25rem", lineHeight: 1.15, borderRadius: 10 }}
                    />

                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === `press_desc_${idx}`}
                      value={item.description}
                      onChange={(v) => updateItem(idx, "description", v)}
                      onStartEdit={() => setActiveField(`press_desc_${idx}`)}
                      onStopEdit={() => setActiveField("")}
                      placeholder={`Description ${idx + 1}`}
                      multiline
                      hint="Edit description"
                      display={item.description}
                      displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
                    />

                    {editorMode ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <InlineField
                          editorMode={editorMode}
                          editing={editorMode && activeField === `press_url_${idx}`}
                          value={item.url}
                          onChange={(v) => updateItem(idx, "url", v)}
                          onStartEdit={() => setActiveField(`press_url_${idx}`)}
                          onStopEdit={() => setActiveField("")}
                          placeholder="Public URL"
                          hint="Edit URL"
                          display={item.url || "Set public URL"}
                          displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                        />
                        <InlineField
                          editorMode={editorMode}
                          editing={editorMode && activeField === `press_embed_${idx}`}
                          value={item.embedUrl}
                          onChange={(v) => updateItem(idx, "embedUrl", v)}
                          onStartEdit={() => setActiveField(`press_embed_${idx}`)}
                          onStopEdit={() => setActiveField("")}
                          placeholder="Embed URL"
                          hint="Edit embed"
                          display={item.embedUrl || "Set embed URL"}
                          displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                        />
                      </div>
                    ) : null}

                    {item.type === "embed" && item.embedUrl ? (
                      item.embedUrl.toLowerCase().endsWith(".mp3") ? (
                        <div style={{
                          marginTop: 14,
                          padding: 14,
                          borderRadius: 18,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}>
                          <audio
                            controls
                            preload="none"
                            style={{ width: "100%" }}
                            src={item.embedUrl}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      ) : (
                        <iframe
                          className="dpg-press-embed"
                          src={item.embedUrl}
                          title={item.title || `Embedded media ${idx + 1}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      )
                    ) : null}

                    <div className="dpg-press-actions">
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="dpg-press-linkbtn">
                          Open source
                        </a>
                      ) : null}
                      {item.embedUrl && item.type !== "embed" ? (
                        <a href={item.embedUrl} target="_blank" rel="noreferrer" className="dpg-press-ghostbtn">
                          Open embed
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              {editorMode && content.items.length < 6 ? (
                <div style={{ marginTop: 18 }}>
                  <EditChip
                    onClick={() =>
                      setContent({
                        ...content,
                        items: [
                          ...content.items,
                          { type: "link", title: "New media item", url: "", embedUrl: "", description: "" },
                        ],
                      })
                    }
                    subtle
                  >
                    Add media item
                  </EditChip>
                </div>
              ) : null}
            </div>

          </div>

          <aside className="dpg-press-side">
            <div className="dpg-press-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "press_side_title"}
                value={content.side_title}
                onChange={(v) => setContent({ ...content, side_title: v })}
                onStartEdit={() => setActiveField("press_side_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side title"
                hint="Edit label"
                display={content.side_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "press_side_body"}
                value={content.side_body}
                onChange={(v) => setContent({ ...content, side_body: v })}
                onStartEdit={() => setActiveField("press_side_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side body"
                multiline
                hint="Edit note"
                display={content.side_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </div>

            <div className="dpg-press-card" id="updates">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "press_updates_title"}
                value={content.updates_title}
                onChange={(v) => setContent({ ...content, updates_title: v })}
                onStartEdit={() => setActiveField("press_updates_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Updates title"
                hint="Edit section label"
                display={content.updates_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />

              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "press_updates_body"}
                value={content.updates_body}
                onChange={(v) => setContent({ ...content, updates_body: v })}
                onStartEdit={() => setActiveField("press_updates_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Updates body"
                multiline
                hint="Edit intro"
                display={content.updates_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, marginBottom: 16, borderRadius: 10 }}
              />

              {bulletinState.loading ? (
                <div style={{ color: "#d7ddd8" }}>Loading updates…</div>
              ) : null}

              {!bulletinState.loading && !bulletinState.posts.length ? (
                <div style={{ color: bulletinState.error ? "#ffb8b8" : "#d7ddd8" }}>
                  {bulletinState.error || "No public updates yet."}
                </div>
              ) : null}

              {bulletinState.posts.length ? (
                <div style={{ display: "grid", gap: 14 }}>
                  {bulletinState.posts.map((post) => (
                    <BulletinFeedCard key={post.slug} post={post} />
                  ))}
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}

function RsvpPageLayout({
  accent,
  editorMode = false,
  activeField = "",
  setActiveField = () => {},
  content,
  setContent = () => {},
  rsvpForm,
  setRsvpForm = () => {},
  rsvpBusy = false,
  rsvpMsg = "",
  submitPublicRsvp = () => {},
}) {
  const updateStep = (index, value) => {
    const next = [...content.steps];
    while (next.length < 6) next.push("");
    next[index] = value;
    setContent({ ...content, steps: next.filter((x) => String(x || "").trim()) });
  };

  return (
    <>
      <style>{`
        .dpg-rsvp-shell { display: grid; gap: 24px; }
        .dpg-rsvp-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
          gap: 22px;
          align-items: start;
        }
        .dpg-rsvp-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.16);
        }
        .dpg-rsvp-steps {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }
        .dpg-rsvp-step {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: start;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 14px 16px;
        }
        .dpg-rsvp-num {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${accent};
          color: #121715;
          font-weight: 900;
          font-size: 13px;
          margin-top: 2px;
        }
        .dpg-rsvp-side {
          display: grid;
          gap: 18px;
        }
        .dpg-rsvp-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 15px 18px;
          border-radius: 999px;
          background: ${accent};
          color: #121715;
          text-decoration: none;
          font-weight: 800;
          box-shadow: 0 12px 28px rgba(0,0,0,0.18);
        }
        .dpg-rsvp-ghost {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 14px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          color: #f3efe8;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.10);
          font-weight: 800;
        }
        .dpg-rsvp-sticky {
          background: #f3e28b;
          color: #171717;
          border-radius: 16px;
          padding: 18px;
          transform: rotate(1deg);
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 18px 36px rgba(0,0,0,0.16);
        }
        @media (max-width: 920px) {
          .dpg-rsvp-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dpg-rsvp-shell">
        <PageHero
          accent={accent}
          editorMode={editorMode}
          activeField={activeField}
          setActiveField={setActiveField}
          prefix="rsvp"
          content={content}
          setContent={setContent}
        />

        <section className="dpg-rsvp-grid">
          <div style={{ display: "grid", gap: 18 }}>
            <article className="dpg-rsvp-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_lead_title"}
                value={content.lead_title}
                onChange={(v) => setContent({ ...content, lead_title: v })}
                onStartEdit={() => setActiveField("rsvp_lead_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Lead title"
                hint="Edit title"
                display={content.lead_title}
                displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "2rem", lineHeight: 1.05, marginBottom: 14, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_lead_body"}
                value={content.lead_body}
                onChange={(v) => setContent({ ...content, lead_body: v })}
                onStartEdit={() => setActiveField("rsvp_lead_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Lead body"
                multiline
                hint="Edit intro block"
                display={content.lead_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, fontSize: "1.06rem", borderRadius: 10 }}
              />
            </article>

            <article className="dpg-rsvp-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_steps_title"}
                value={content.steps_title}
                onChange={(v) => setContent({ ...content, steps_title: v })}
                onStartEdit={() => setActiveField("rsvp_steps_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Steps title"
                hint="Edit section label"
                display={content.steps_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />

              <div className="dpg-rsvp-steps">
                {Array.from({ length: Math.max(content.steps.length, editorMode ? 4 : content.steps.length) }).map((_, idx) => {
                  const value = content.steps[idx] || "";
                  return (
                    <div className="dpg-rsvp-step" key={`step-${idx}`}>
                      <div className="dpg-rsvp-num">{idx + 1}</div>
                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `rsvp_step_${idx}`}
                        value={value}
                        onChange={(v) => updateStep(idx, v)}
                        onStartEdit={() => setActiveField(`rsvp_step_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Step ${idx + 1}`}
                        hint="Edit step"
                        display={value || (editorMode ? "Empty step slot" : "")}
                        displayStyle={{ color: "#f3efe8", lineHeight: 1.55, borderRadius: 10 }}
                      />
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <aside className="dpg-rsvp-side">
            <div className="dpg-rsvp-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_primary_title"}
                value={content.primary_title}
                onChange={(v) => setContent({ ...content, primary_title: v })}
                onStartEdit={() => setActiveField("rsvp_primary_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Primary title"
                hint="Edit title"
                display={content.primary_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_primary_body"}
                value={content.primary_body}
                onChange={(v) => setContent({ ...content, primary_body: v })}
                onStartEdit={() => setActiveField("rsvp_primary_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Primary body"
                multiline
                hint="Edit body"
                display={content.primary_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, marginBottom: 16, borderRadius: 10 }}
              />

              <div style={{ display: "grid", gap: 10 }}>
                <InlineField
                  editorMode={editorMode}
                  editing={editorMode && activeField === "rsvp_primary_label"}
                  value={content.primary_label}
                  onChange={(v) => setContent({ ...content, primary_label: v })}
                  onStartEdit={() => setActiveField("rsvp_primary_label")}
                  onStopEdit={() => setActiveField("")}
                  placeholder="Primary label"
                  hint="Edit button label"
                  display={content.primary_label}
                  displayStyle={{ color: "#f3efe8", fontWeight: 800, borderRadius: 10 }}
                />

                {editorMode ? (
                  <InlineField
                    editorMode={editorMode}
                    editing={editorMode && activeField === "rsvp_primary_url"}
                    value={content.primary_url}
                    onChange={(v) => setContent({ ...content, primary_url: v })}
                    onStartEdit={() => setActiveField("rsvp_primary_url")}
                    onStopEdit={() => setActiveField("")}
                    placeholder="Primary URL"
                    hint="Edit link"
                    display={content.primary_url || "Set primary URL"}
                    displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                  />
                ) : null}

                {!editorMode ? (
                  <form onSubmit={submitPublicRsvp} style={{ display: "grid", gap: 10 }}>
                    <input
                      value={rsvpForm.name}
                      onChange={(e) => setRsvpForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Your name"
                      autoComplete="name"
                      required
                      maxLength={160}
                      style={{ width: "100%", background: "rgba(255,255,255,0.08)", color: "#f3efe8", border: "1px solid rgba(255,255,255,0.16)", padding: 12, borderRadius: 12, font: "inherit" }}
                    />
                    <input
                      value={rsvpForm.email}
                      onChange={(e) => setRsvpForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Email address"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={320}
                      style={{ width: "100%", background: "rgba(255,255,255,0.08)", color: "#f3efe8", border: "1px solid rgba(255,255,255,0.16)", padding: 12, borderRadius: 12, font: "inherit" }}
                    />
                    <textarea
                      value={rsvpForm.accessNotes}
                      onChange={(e) => setRsvpForm((prev) => ({ ...prev, accessNotes: e.target.value }))}
                      placeholder="Access notes or accommodation needs"
                      maxLength={2000}
                      style={{ width: "100%", minHeight: 84, resize: "vertical", background: "rgba(255,255,255,0.08)", color: "#f3efe8", border: "1px solid rgba(255,255,255,0.16)", padding: 12, borderRadius: 12, font: "inherit" }}
                    />
                    <textarea
                      value={rsvpForm.notes}
                      onChange={(e) => setRsvpForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Anything organizers should know"
                      maxLength={4000}
                      style={{ width: "100%", minHeight: 84, resize: "vertical", background: "rgba(255,255,255,0.08)", color: "#f3efe8", border: "1px solid rgba(255,255,255,0.16)", padding: 12, borderRadius: 12, font: "inherit" }}
                    />
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#f3efe8", fontWeight: 700 }}>
                      <input type="checkbox" checked={!!rsvpForm.volunteer} onChange={(e) => setRsvpForm((prev) => ({ ...prev, volunteer: e.target.checked }))} />
                      I want to volunteer
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#f3efe8", fontWeight: 700 }}>
                      <input type="checkbox" checked={!!rsvpForm.sessionLead} onChange={(e) => setRsvpForm((prev) => ({ ...prev, sessionLead: e.target.checked }))} />
                      I may want to lead a session
                    </label>
                    <div style={{ color: "#aeb9b2", fontSize: 12, lineHeight: 1.5 }}>
                      RSVP details are visible only to DPG organizers in the private workspace.
                    </div>
                    <button type="submit" disabled={rsvpBusy} className="dpg-rsvp-cta" style={{ border: 0 }}>
                      {rsvpBusy ? "Sending…" : content.primary_label}
                    </button>
                    {rsvpMsg ? (
                      <div style={{ color: rsvpMsg.toLowerCase().includes("fail") || rsvpMsg.toLowerCase().includes("required") || rsvpMsg.toLowerCase().includes("invalid") ? "#ffb8b8" : "#9fd3ab", fontSize: 14 }}>
                        {rsvpMsg}
                      </div>
                    ) : null}
                  </form>
                ) : (
                  <a href={content.primary_url} className="dpg-rsvp-cta">
                    {content.primary_label}
                  </a>
                )}
              </div>
            </div>

            <div className="dpg-rsvp-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_secondary_title"}
                value={content.secondary_title}
                onChange={(v) => setContent({ ...content, secondary_title: v })}
                onStartEdit={() => setActiveField("rsvp_secondary_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Secondary title"
                hint="Edit title"
                display={content.secondary_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_secondary_body"}
                value={content.secondary_body}
                onChange={(v) => setContent({ ...content, secondary_body: v })}
                onStartEdit={() => setActiveField("rsvp_secondary_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Secondary body"
                multiline
                hint="Edit body"
                display={content.secondary_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, marginBottom: 16, borderRadius: 10 }}
              />

              <div style={{ display: "grid", gap: 10 }}>
                <InlineField
                  editorMode={editorMode}
                  editing={editorMode && activeField === "rsvp_secondary_label"}
                  value={content.secondary_label}
                  onChange={(v) => setContent({ ...content, secondary_label: v })}
                  onStartEdit={() => setActiveField("rsvp_secondary_label")}
                  onStopEdit={() => setActiveField("")}
                  placeholder="Secondary label"
                  hint="Edit button label"
                  display={content.secondary_label}
                  displayStyle={{ color: "#f3efe8", fontWeight: 800, borderRadius: 10 }}
                />

                {editorMode ? (
                  <InlineField
                    editorMode={editorMode}
                    editing={editorMode && activeField === "rsvp_secondary_url"}
                    value={content.secondary_url}
                    onChange={(v) => setContent({ ...content, secondary_url: v })}
                    onStartEdit={() => setActiveField("rsvp_secondary_url")}
                    onStopEdit={() => setActiveField("")}
                    placeholder="Secondary URL"
                    hint="Edit link"
                    display={content.secondary_url || "Set secondary URL"}
                    displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                  />
                ) : null}

                <a href={content.secondary_url} className="dpg-rsvp-ghost">
                  {content.secondary_label}
                </a>
              </div>
            </div>

            <div className="dpg-rsvp-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_side_title"}
                value={content.side_title}
                onChange={(v) => setContent({ ...content, side_title: v })}
                onStartEdit={() => setActiveField("rsvp_side_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side title"
                hint="Edit label"
                display={content.side_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_side_body"}
                value={content.side_body}
                onChange={(v) => setContent({ ...content, side_body: v })}
                onStartEdit={() => setActiveField("rsvp_side_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side body"
                multiline
                hint="Edit note"
                display={content.side_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </div>

            <div className="dpg-rsvp-sticky">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_sticky_title"}
                value={content.sticky_title}
                onChange={(v) => setContent({ ...content, sticky_title: v })}
                onStartEdit={() => setActiveField("rsvp_sticky_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky title"
                hint="Edit title"
                dark={false}
                display={content.sticky_title}
                displayStyle={{ color: "#171717", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1rem", lineHeight: 1.1, marginBottom: 8, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "rsvp_sticky_body"}
                value={content.sticky_body}
                onChange={(v) => setContent({ ...content, sticky_body: v })}
                onStartEdit={() => setActiveField("rsvp_sticky_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky body"
                multiline
                hint="Edit note"
                dark={false}
                display={content.sticky_body}
                displayStyle={{ color: "#171717", lineHeight: 1.56, fontSize: "0.98rem", borderRadius: 10 }}
              />
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}


function SharesPageLayout({ accent, editorMode = false, activeField = "", setActiveField = () => {}, content, setContent = () => {}, authed = false, sharesLoading = false, sharesError = "", sharesAdminState = { loading: false, items: [], error: "" }, editingShareId = "", shareDraft = null, setShareDraft = () => {}, shareCreateBusy = false, shareCreateMsg = "", onPublishShare = null, onBeginEditShare = null, onUnpublishShare = null, onResetShareEditor = null, liveVideos = [], liveFeatured = null, hasLiveShares = false }) {
  const updateFeatured = (key, value) => {
    setContent({
      ...content,
      featured: {
        ...(content.featured || {}),
        [key]: value,
      },
    });
  };

  const updateVideo = (index, key, value) => {
    const next = [...(content.videos || [])];
    while (next.length <= index) {
      next.push({
        tag: "",
        title: "",
        description: "",
        duration: "",
        meta: "",
        thumb: "",
        href: "",
      });
    }
    next[index] = {
      ...(next[index] || {}),
      [key]: value,
    };
    setContent({
      ...content,
      videos: next.filter((item) =>
        String(item?.title || "").trim() ||
        String(item?.description || "").trim() ||
        String(item?.tag || "").trim() ||
        String(item?.duration || "").trim() ||
        String(item?.meta || "").trim() ||
        String(item?.thumb || "").trim() ||
        String(item?.href || "").trim()
      ),
    });
  };

  const addVideo = () => {
    setContent({
      ...content,
      videos: [
        ...(content.videos || []),
        {
          tag: "New session",
          title: "Untitled session",
          description: "",
          duration: "",
          meta: "",
          thumb: "",
          href: "#",
        },
      ],
    });
  };

  const removeVideo = (index) => {
    setContent({
      ...content,
      videos: (content.videos || []).filter((_, i) => i !== index),
    });
  };

  const fallbackFeatured = content.featured || {};
  const fallbackVideos = Array.isArray(content.videos) ? content.videos : [];
  const featured = !editorMode && hasLiveShares ? (liveFeatured || {}) : fallbackFeatured;
  const videos = !editorMode && hasLiveShares
    ? (Array.isArray(liveVideos) ? liveVideos : [])
    : fallbackVideos;

  const visibleCards = Math.max(fallbackVideos.length, editorMode ? 6 : fallbackVideos.length);
  const showComposer = authed && !editorMode && shareDraft;
  const [shareQuery, setShareQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState("All");

  const sourceVideos = videos.map((video, idx) => ({ ...video, __idx: idx }));
  const editorVideos = Array.from({ length: visibleCards }).map((_, idx) => ({ ...(fallbackVideos[idx] || {}), __idx: idx }));
  const availableTags = ["All", ...Array.from(new Set(sourceVideos.map((video) => String(video?.tag || "").trim()).filter(Boolean)))];
  const normalizedQuery = String(shareQuery || "").trim().toLowerCase();

  const filteredVideos = sourceVideos.filter((video) => {
    const tagPass = activeTag === "All" || String(video?.tag || "").trim() === activeTag;
    const haystack = [
      video?.title || "",
      video?.description || "",
      video?.meta || "",
      video?.tag || "",
      video?.duration || "",
    ].join(" ").toLowerCase();
    const queryPass = !normalizedQuery || haystack.includes(normalizedQuery);
    return tagPass && queryPass;
  });

  const gridVideos = editorMode ? editorVideos : filteredVideos;

  return (
    <>
      <style>{`
        .dpg-shares-shell { display: grid; gap: 24px; }
        .dpg-shares-topgrid {
          display: grid;
          grid-template-columns: minmax(0, 1.18fr) minmax(280px, 0.82fr);
          gap: 22px;
          align-items: start;
        }
        .dpg-shares-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.16);
        }
        .dpg-shares-main { display: grid; gap: 18px; }
        .dpg-shares-side { display: grid; gap: 18px; }
        .dpg-shares-wide-stack { display: grid; gap: 18px; }
        .dpg-shares-feature {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
          gap: 20px;
          align-items: stretch;
        }
        .dpg-shares-feature-media {
          position: relative;
          min-height: 320px;
          border-radius: 22px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.38)),
            radial-gradient(circle at 20% 20%, rgba(147,180,240,0.28), transparent 35%),
            radial-gradient(circle at 82% 18%, rgba(243,226,139,0.16), transparent 26%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)),
            rgba(7,10,9,0.92);
          border: 1px solid rgba(255,255,255,0.08);
          display: block;
          text-decoration: none;
          color: inherit;
        }
        .dpg-shares-feature-media.has-thumb {
          background-size: cover;
          background-position: center;
        }
        .dpg-shares-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(7,10,9,0.04) 0%, rgba(7,10,9,0.18) 38%, rgba(7,10,9,0.78) 100%);
        }
        .dpg-shares-feature-topline {
          position: absolute;
          top: 16px;
          left: 16px;
          right: 16px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          z-index: 1;
        }
        .dpg-shares-chip {
          display: inline-flex;
          align-items: center;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(7,10,9,0.72);
          border: 1px solid rgba(255,255,255,0.14);
          color: #f3efe8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .dpg-shares-duration {
          display: inline-flex;
          align-items: center;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(7,10,9,0.72);
          border: 1px solid rgba(255,255,255,0.12);
          color: #d7ddd8;
          font-size: 12px;
          font-weight: 700;
        }
        .dpg-shares-feature-bottom {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 18px;
          z-index: 1;
          display: grid;
          gap: 10px;
        }
        .dpg-shares-feature-title {
          color: #f3efe8;
          font-family: Inter, system-ui, Arial, sans-serif;
          font-size: clamp(1.6rem, 3vw, 2.5rem);
          font-weight: 900;
          line-height: 1.02;
          max-width: 14ch;
        }
        .dpg-shares-feature-desc {
          color: #d7ddd8;
          font-size: 0.98rem;
          line-height: 1.58;
          max-width: 56ch;
        }
        .dpg-shares-feature-meta {
          color: #f3efe8;
          font-weight: 800;
          font-size: 0.92rem;
        }
        .dpg-shares-play {
          width: 82px;
          height: 82px;
          border-radius: 999px;
          background: rgba(147,180,240,0.96);
          color: #121715;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          font-weight: 900;
          box-shadow: 0 18px 40px rgba(0,0,0,0.25);
        }
        .dpg-shares-feature-copy {
          display: grid;
          gap: 12px;
          align-content: start;
        }
        .dpg-shares-grid-header {
          display: grid;
          gap: 8px;
          margin-bottom: 16px;
        }
        .dpg-shares-videos {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          align-items: start;
        }
        .dpg-shares-video-card {
          display: grid;
          gap: 12px;
          align-content: start;
        }
        .dpg-shares-thumb {
          position: relative;
          display: block;
          aspect-ratio: 16 / 9;
          border-radius: 18px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.38)),
            radial-gradient(circle at 18% 20%, rgba(147,180,240,0.28), transparent 32%),
            radial-gradient(circle at 82% 18%, rgba(243,226,139,0.16), transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)),
            rgba(7,10,9,0.86);
          border: 1px solid rgba(255,255,255,0.08);
          text-decoration: none;
        }
        .dpg-shares-thumb.has-thumb {
          background-size: cover;
          background-position: center;
        }
        .dpg-shares-thumb::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(7,10,9,0.02), rgba(7,10,9,0.14) 45%, rgba(7,10,9,0.72));
        }
        .dpg-shares-thumb-play {
          position: absolute;
          left: 14px;
          bottom: 14px;
          z-index: 1;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${accent};
          color: #121715;
          font-size: 18px;
          font-weight: 900;
          box-shadow: 0 12px 28px rgba(0,0,0,0.25);
        }
        .dpg-shares-thumb-duration {
          position: absolute;
          right: 12px;
          bottom: 12px;
          z-index: 1;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(7,10,9,0.78);
          color: #f3efe8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .04em;
        }
        .dpg-shares-thumb-tag {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 1;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(7,10,9,0.78);
          border: 1px solid rgba(255,255,255,0.10);
          color: #d7ddd8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .07em;
          text-transform: uppercase;
        }
        .dpg-shares-sticky {
          background: #f3e28b;
          color: #171717;
          border-radius: 16px;
          padding: 18px;
          transform: rotate(1deg);
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 18px 36px rgba(0,0,0,0.16);
        }
        @media (max-width: 920px) {
          .dpg-shares-topgrid { grid-template-columns: 1fr; }
          .dpg-shares-feature { grid-template-columns: 1fr; }
          .dpg-shares-feature-media { min-height: 280px; }
          .dpg-shares-videos { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dpg-shares-shell">
        <PageHero
          accent={accent}
          editorMode={editorMode}
          activeField={activeField}
          setActiveField={setActiveField}
          prefix="shares"
          content={content}
          setContent={setContent}
        />

        <section className="dpg-shares-topgrid">
          <div className="dpg-shares-main">
            <article className="dpg-shares-card">
              <div className="dpg-shares-feature">
                <a
                  href={featured.href || "#"}
                  className={`dpg-shares-feature-media${featured.thumb ? " has-thumb" : ""}`}
                  style={featured.thumb ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.44)), url("${featured.thumb}")` } : undefined}
                >
                  <div className="dpg-shares-scrim" />
                  <div className="dpg-shares-feature-topline">
                    <span className="dpg-shares-chip">{featured.tag || "Featured"}</span>
                    <span className="dpg-shares-duration">{featured.duration || "Session"}</span>
                  </div>
                  <div className="dpg-shares-feature-bottom">
                    <div className="dpg-shares-play">▶</div>
                    <div className="dpg-shares-feature-title">{featured.title || "Featured session"}</div>
                    <div className="dpg-shares-feature-desc">{featured.description || "A highlighted recording lives here."}</div>
                    <div className="dpg-shares-feature-meta">{featured.meta || "DPG Shares preview"}</div>
                    {featured.href ? (
                      <div style={{ color: "#f3efe8", fontWeight: 800, fontSize: "0.96rem" }}>
                        Open session →
                      </div>
                    ) : null}
                  </div>
                </a>

                <div className="dpg-shares-feature-copy">
                  <InlineField
                    editorMode={editorMode}
                    editing={editorMode && activeField === "shares_featured_label"}
                    value={content.featured_label}
                    onChange={(v) => setContent({ ...content, featured_label: v })}
                    onStartEdit={() => setActiveField("shares_featured_label")}
                    onStopEdit={() => setActiveField("")}
                    placeholder="Featured label"
                    hint="Edit section label"
                    display={content.featured_label}
                    displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", borderRadius: 10 }}
                  />

                  <InlineField
                    editorMode={editorMode}
                    editing={editorMode && activeField === "shares_featured_title"}
                    value={content.featured_title}
                    onChange={(v) => setContent({ ...content, featured_title: v })}
                    onStartEdit={() => setActiveField("shares_featured_title")}
                    onStopEdit={() => setActiveField("")}
                    placeholder="Featured title"
                    hint="Edit title"
                    display={content.featured_title}
                    displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 900, fontSize: "1.9rem", lineHeight: 1.04, borderRadius: 10 }}
                  />

                  <InlineField
                    editorMode={editorMode}
                    editing={editorMode && activeField === "shares_featured_body"}
                    value={content.featured_body}
                    onChange={(v) => setContent({ ...content, featured_body: v })}
                    onStartEdit={() => setActiveField("shares_featured_body")}
                    onStopEdit={() => setActiveField("")}
                    placeholder="Featured body"
                    multiline
                    hint="Edit intro"
                    display={content.featured_body}
                    displayStyle={{ color: "#d7ddd8", lineHeight: 1.66, borderRadius: 10 }}
                  />

                  <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === "shares_featured_tag"}
                      value={featured.tag || ""}
                      onChange={(v) => updateFeatured("tag", v)}
                      onStartEdit={() => setActiveField("shares_featured_tag")}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Featured tag"
                      hint="Edit tag"
                      display={featured.tag || (editorMode ? "Featured tag" : "")}
                      displayStyle={{ color: "#f3efe8", fontWeight: 800, borderRadius: 10 }}
                    />

                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === "shares_featured_media_title"}
                      value={featured.title || ""}
                      onChange={(v) => updateFeatured("title", v)}
                      onStartEdit={() => setActiveField("shares_featured_media_title")}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Featured media title"
                      hint="Edit card title"
                      display={featured.title || (editorMode ? "Featured media title" : "")}
                      displayStyle={{ color: "#f3efe8", fontWeight: 800, borderRadius: 10 }}
                    />

                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === "shares_featured_desc"}
                      value={featured.description || ""}
                      onChange={(v) => updateFeatured("description", v)}
                      onStartEdit={() => setActiveField("shares_featured_desc")}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Featured description"
                      multiline
                      hint="Edit card body"
                      display={featured.description || (editorMode ? "Featured description" : "")}
                      displayStyle={{ color: "#d7ddd8", lineHeight: 1.58, borderRadius: 10 }}
                    />

                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === "shares_featured_meta"}
                      value={featured.meta || ""}
                      onChange={(v) => updateFeatured("meta", v)}
                      onStartEdit={() => setActiveField("shares_featured_meta")}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Featured meta"
                      hint="Edit metadata"
                      display={featured.meta || (editorMode ? "Featured metadata" : "")}
                      displayStyle={{ color: "#93b4f0", fontSize: 13, fontWeight: 800, borderRadius: 10 }}
                    />

                    <InlineField
                      editorMode={editorMode}
                      editing={editorMode && activeField === "shares_featured_duration"}
                      value={featured.duration || ""}
                      onChange={(v) => updateFeatured("duration", v)}
                      onStartEdit={() => setActiveField("shares_featured_duration")}
                      onStopEdit={() => setActiveField("")}
                      placeholder="Featured duration"
                      hint="Edit duration"
                      display={featured.duration || (editorMode ? "Featured duration" : "")}
                      displayStyle={{ color: "#d7ddd8", fontSize: 13, borderRadius: 10 }}
                    />

                    {editorMode ? (
                      <>
                        <InlineField
                          editorMode={editorMode}
                          editing={editorMode && activeField === "shares_featured_thumb"}
                          value={featured.thumb || ""}
                          onChange={(v) => updateFeatured("thumb", v)}
                          onStartEdit={() => setActiveField("shares_featured_thumb")}
                          onStopEdit={() => setActiveField("")}
                          placeholder="Featured thumbnail URL"
                          hint="Edit thumbnail"
                          display={featured.thumb || "Set featured thumbnail URL"}
                          displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                        />
                        <InlineField
                          editorMode={editorMode}
                          editing={editorMode && activeField === "shares_featured_href"}
                          value={featured.href || ""}
                          onChange={(v) => updateFeatured("href", v)}
                          onStartEdit={() => setActiveField("shares_featured_href")}
                          onStopEdit={() => setActiveField("")}
                          placeholder="Featured link URL"
                          hint="Edit link"
                          display={featured.href || "Set featured link URL"}
                          displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          </div>

          <aside className="dpg-shares-side">
            <div className="dpg-shares-card">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "shares_side_title"}
                value={content.side_title}
                onChange={(v) => setContent({ ...content, side_title: v })}
                onStartEdit={() => setActiveField("shares_side_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side title"
                hint="Edit label"
                display={content.side_title}
                displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "shares_side_body"}
                value={content.side_body}
                onChange={(v) => setContent({ ...content, side_body: v })}
                onStartEdit={() => setActiveField("shares_side_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Side body"
                multiline
                hint="Edit note"
                display={content.side_body}
                displayStyle={{ color: "#f3efe8", lineHeight: 1.68, borderRadius: 10 }}
              />
            </div>

            <div className="dpg-shares-sticky">
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "shares_sticky_title"}
                value={content.sticky_title}
                onChange={(v) => setContent({ ...content, sticky_title: v })}
                onStartEdit={() => setActiveField("shares_sticky_title")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky title"
                hint="Edit title"
                dark={false}
                display={content.sticky_title}
                displayStyle={{ color: "#171717", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1rem", lineHeight: 1.1, marginBottom: 8, borderRadius: 10 }}
              />
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "shares_sticky_body"}
                value={content.sticky_body}
                onChange={(v) => setContent({ ...content, sticky_body: v })}
                onStartEdit={() => setActiveField("shares_sticky_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Sticky body"
                multiline
                hint="Edit note"
                dark={false}
                display={content.sticky_body}
                displayStyle={{ color: "#171717", lineHeight: 1.56, fontSize: "0.98rem", borderRadius: 10 }}
              />
            </div>
          </aside>
        </section>

        <section className="dpg-shares-wide-stack">

          <article className="dpg-shares-card">
            <InlineField
              editorMode={editorMode}
              editing={editorMode && activeField === "shares_grid_title"}
              value={content.grid_title}
              onChange={(v) => setContent({ ...content, grid_title: v })}
              onStartEdit={() => setActiveField("shares_grid_title")}
              onStopEdit={() => setActiveField("")}
              placeholder="Grid title"
              hint="Edit section label"
              display={content.grid_title}
              displayStyle={{ color: accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", borderRadius: 10 }}
            />

            <div className="dpg-shares-grid-header">
              {sharesLoading ? (
                <div style={{ color: "#d7ddd8" }}>Loading live sessions…</div>
              ) : null}
              {!sharesLoading && sharesError ? (
                <div style={{ color: "#ffb8b8" }}>{sharesError}</div>
              ) : null}
              <InlineField
                editorMode={editorMode}
                editing={editorMode && activeField === "shares_grid_body"}
                value={content.grid_body}
                onChange={(v) => setContent({ ...content, grid_body: v })}
                onStartEdit={() => setActiveField("shares_grid_body")}
                onStopEdit={() => setActiveField("")}
                placeholder="Grid intro"
                multiline
                hint="Edit intro"
                display={content.grid_body}
                displayStyle={{ color: "#d7ddd8", lineHeight: 1.66, maxWidth: 760, borderRadius: 10 }}
              />

              {!editorMode && hasLiveShares ? (
                <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      value={shareQuery}
                      onChange={(e) => setShareQuery(e.target.value)}
                      placeholder="Search sessions"
                      style={{
                        minWidth: 240,
                        flex: "1 1 280px",
                        background: "rgba(255,255,255,0.08)",
                        color: "#f3efe8",
                        border: "1px solid rgba(255,255,255,0.12)",
                        padding: 10,
                        font: "inherit",
                        borderRadius: 12,
                      }}
                    />
                    <div style={{ color: "#8fa1ab", fontSize: 13 }}>
                      {filteredVideos.length} session{filteredVideos.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {availableTags.map((tag) => (
                      <EditChip
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        subtle
                        active={activeTag === tag}
                      >
                        {tag}
                      </EditChip>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {!editorMode && !sharesLoading && !sharesError && !gridVideos.length ? (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 18,
                  padding: 18,
                  color: "#d7ddd8",
                  background: "rgba(255,255,255,0.03)",
                  marginBottom: 14,
                }}
              >
                {hasLiveShares
                  ? "No sessions match the current search or tag filter."
                  : "No published sessions yet. This archive is ready for real entries as soon as organizers publish them."}
              </div>
            ) : null}

            <div className="dpg-shares-videos">
              {gridVideos.map((video, gridIdx) => {
                const idx = Number.isInteger(video?.__idx) ? video.__idx : gridIdx;
                const hasContent =
                  String(video?.title || "").trim() ||
                  String(video?.description || "").trim() ||
                  String(video?.tag || "").trim() ||
                  String(video?.duration || "").trim() ||
                  String(video?.meta || "").trim() ||
                  String(video?.thumb || "").trim() ||
                  String(video?.href || "").trim();

                if (!hasContent && !editorMode) return null;

                return (
                  <div className="dpg-shares-video-card" key={`share-video-${idx}`}>
                    <a
                      href={video.href || "#"}
                      className={`dpg-shares-thumb${video.thumb ? " has-thumb" : ""}`}
                      style={video.thumb ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.42)), url("${video.thumb}")` } : undefined}
                    >
                      <span className="dpg-shares-thumb-tag">{video.tag || "Session"}</span>
                      <span className="dpg-shares-thumb-play">▶</span>
                      <span className="dpg-shares-thumb-duration">{video.duration || "Preview"}</span>
                    </a>

                    <div style={{ display: "grid", gap: 8 }}>
                      {!editorMode && video.href ? (
                        <a
                          href={video.href}
                          style={{
                            color: accent,
                            textDecoration: "none",
                            fontWeight: 800,
                            fontSize: 14,
                          }}
                        >
                          View session →
                        </a>
                      ) : null}
                      {editorMode ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <EditChip onClick={() => removeVideo(idx)} subtle>
                            Remove card
                          </EditChip>
                        </div>
                      ) : null}

                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `shares_video_tag_${idx}`}
                        value={video.tag || ""}
                        onChange={(v) => updateVideo(idx, "tag", v)}
                        onStartEdit={() => setActiveField(`shares_video_tag_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Tag ${idx + 1}`}
                        hint="Edit tag"
                        display={video.tag || (editorMode ? "Session tag" : "")}
                        displayStyle={{ color: "#93b4f0", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", borderRadius: 10 }}
                      />

                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `shares_video_title_${idx}`}
                        value={video.title || ""}
                        onChange={(v) => updateVideo(idx, "title", v)}
                        onStartEdit={() => setActiveField(`shares_video_title_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Video title ${idx + 1}`}
                        hint="Edit title"
                        display={video.title || (editorMode ? "Untitled session" : "")}
                        displayStyle={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 800, fontSize: "1.08rem", lineHeight: 1.18, borderRadius: 10 }}
                      />

                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `shares_video_meta_${idx}`}
                        value={video.meta || ""}
                        onChange={(v) => updateVideo(idx, "meta", v)}
                        onStartEdit={() => setActiveField(`shares_video_meta_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Metadata ${idx + 1}`}
                        hint="Edit metadata"
                        display={video.meta || (editorMode ? "Session metadata" : "")}
                        displayStyle={{ color: "#93b4f0", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", borderRadius: 10 }}
                      />

                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `shares_video_desc_${idx}`}
                        value={video.description || ""}
                        onChange={(v) => updateVideo(idx, "description", v)}
                        onStartEdit={() => setActiveField(`shares_video_desc_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Description ${idx + 1}`}
                        multiline
                        hint="Edit description"
                        display={video.description || (editorMode ? "Session description" : "")}
                        displayStyle={{ color: "#d7ddd8", lineHeight: 1.58, fontSize: "0.95rem", borderRadius: 10 }}
                      />

                      <InlineField
                        editorMode={editorMode}
                        editing={editorMode && activeField === `shares_video_duration_${idx}`}
                        value={video.duration || ""}
                        onChange={(v) => updateVideo(idx, "duration", v)}
                        onStartEdit={() => setActiveField(`shares_video_duration_${idx}`)}
                        onStopEdit={() => setActiveField("")}
                        placeholder={`Duration ${idx + 1}`}
                        hint="Edit duration"
                        display={video.duration || (editorMode ? "Duration" : "")}
                        displayStyle={{ color: "#d7ddd8", fontSize: 13, borderRadius: 10 }}
                      />

                      {editorMode ? (
                        <>
                          <InlineField
                            editorMode={editorMode}
                            editing={editorMode && activeField === `shares_video_thumb_${idx}`}
                            value={video.thumb || ""}
                            onChange={(v) => updateVideo(idx, "thumb", v)}
                            onStartEdit={() => setActiveField(`shares_video_thumb_${idx}`)}
                            onStopEdit={() => setActiveField("")}
                            placeholder={`Thumbnail URL ${idx + 1}`}
                            hint="Edit thumbnail"
                            display={video.thumb || "Set thumbnail URL"}
                            displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                          />

                          <InlineField
                            editorMode={editorMode}
                            editing={editorMode && activeField === `shares_video_href_${idx}`}
                            value={video.href || ""}
                            onChange={(v) => updateVideo(idx, "href", v)}
                            onStartEdit={() => setActiveField(`shares_video_href_${idx}`)}
                            onStopEdit={() => setActiveField("")}
                            placeholder={`Link URL ${idx + 1}`}
                            hint="Edit link"
                            display={video.href || "Set link URL"}
                            displayStyle={{ color: "#8fa1ab", fontSize: 13, lineHeight: 1.4, borderRadius: 10 }}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {editorMode && fallbackVideos.length < 12 ? (
              <div style={{ marginTop: 18 }}>
                <EditChip onClick={addVideo} subtle>
                  Add video card
                </EditChip>
              </div>
            ) : null}
          </article>
        </section>
      </div>
    </>
  );
}


function GenericPublicPage({ page, accent }) {
  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28, flexWrap: "wrap" }}>
        <img src={DPG_BRAND.logoSrc} alt={DPG_BRAND.logoAlt} style={{ width: 72, height: 72, objectFit: "contain" }} />
        <div>
          {page.eyebrow ? (
            <div style={{ color: "#d7ddd8", marginBottom: 8, fontSize: 15 }}>
              {page.eyebrow}
            </div>
          ) : null}
          <h1
            style={{
              margin: 0,
              color: accent,
              fontSize: "clamp(2.1rem, 4.5vw, 4.8rem)",
              lineHeight: 1,
              fontFamily: 'var(--dpg-display-font, "Fancy Shadow", Georgia, serif)',
              textShadow: "0 1px 2px rgba(0,0,0,0.35)",
            }}
          >
            {page.title}
          </h1>
        </div>
      </header>

      {page.featureImage ? (
        <div style={{ marginBottom: 28 }}>
          <img
            src={page.featureImage}
            alt={page.title}
            style={{ width: "100%", maxHeight: 460, objectFit: "cover", display: "block", borderRadius: 22 }}
          />
        </div>
      ) : null}

      <style>{`
        .dpg-public-content,
        .dpg-public-content p,
        .dpg-public-content li,
        .dpg-public-content blockquote,
        .dpg-public-content strong,
        .dpg-public-content em,
        .dpg-public-content span,
        .dpg-public-content a {
          color: #f3efe8;
        }

        .dpg-public-content h1,
        .dpg-public-content h2,
        .dpg-public-content h3,
        .dpg-public-content h4,
        .dpg-public-content h5,
        .dpg-public-content h6 {
          color: #f3efe8;
          font-family: Inter, system-ui, Arial, sans-serif;
          font-weight: 800;
          line-height: 1.15;
          margin-top: 1.25em;
        }

        .dpg-public-content a {
          color: ${accent};
          text-decoration: underline;
        }

        .dpg-public-content ul,
        .dpg-public-content ol {
          padding-left: 1.4em;
        }

        .dpg-public-content blockquote {
          border-left: 3px solid rgba(255,255,255,0.2);
          padding-left: 1em;
          margin-left: 0;
        }
      `}</style>

      <article
        className="dpg-public-content"
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 24,
          padding: 22,
          background: "rgba(26,33,30,0.94)",
          color: "#f3efe8",
          lineHeight: 1.7,
        }}
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </>
  );
}

export default function PublicContentPage({ slug: slugProp = "" }) {
  const { config } = useDpgPublicSiteConfig();
  const [authState, setAuthState] = React.useState({ checked: false, authed: false });
  const [editorMode, setEditorMode] = React.useState(false);
  const [activeField, setActiveField] = React.useState("");
  const [draftPages, setDraftPages] = React.useState({});
  const [savedPagesOverride, setSavedPagesOverride] = React.useState(null);
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState("");
  const [sharesState, setSharesState] = React.useState({ loading: false, items: [], featured: null, error: "" });
  const [sharesAdminState, setSharesAdminState] = React.useState({ loading: false, items: [], error: "" });
  const [editingShareId, setEditingShareId] = React.useState("");
  const [shareCreateBusy, setShareCreateBusy] = React.useState(false);
  const [shareCreateMsg, setShareCreateMsg] = React.useState("");
  const [rsvpForm, setRsvpForm] = React.useState({
    name: "",
    email: "",
    accessNotes: "",
    notes: "",
    volunteer: false,
    sessionLead: false,
  });
  const [rsvpBusy, setRsvpBusy] = React.useState(false);
  const [rsvpMsg, setRsvpMsg] = React.useState("");
  const [shareDraft, setShareDraft] = React.useState({
    title: "",
    description: "",
    videoUrl: "",
    thumbnailUrl: "",
    tags: "",
    durationText: "",
    metaText: "",
    featured: false,
  });
  const theme = getDpgPublicTheme(config);

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



React.useEffect(() => {
  const currentSlug = slugProp
    ? String(slugProp).trim().toLowerCase()
    : String(window.location.pathname || "/")
        .split("/")
        .filter(Boolean)[0] || "";

  if (currentSlug !== "dpg-shares") return;

  let dead = false;
  setSharesState((prev) => ({ ...prev, loading: true, error: "" }));

  (async () => {
    try {
      const res = await fetch("/api/public/shares?org=dpg&limit=12", {
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (dead) return;
      if (!res.ok || data?.ok === false) {
        setSharesState({ loading: false, items: [], featured: null, error: data?.error || `HTTP ${res.status}` });
        return;
      }
      setSharesState({
        loading: false,
        items: Array.isArray(data?.items) ? data.items : [],
        featured: data?.featured || null,
        error: "",
      });
    } catch (e) {
      if (dead) return;
      setSharesState({ loading: false, items: [], featured: null, error: String(e?.message || e) });
    }
  })();

  return () => { dead = true; };
}, [slugProp]);

  React.useEffect(() => {
    const currentSlug = slugProp
      ? String(slugProp).trim().toLowerCase()
      : String(window.location.pathname || "/")
          .split("/")
          .filter(Boolean)[0] || "";

    if (currentSlug !== "dpg-shares" || !authState.authed) return;

    let dead = false;
    setSharesAdminState({ loading: true, items: [], error: "" });

    (async () => {
      try {
        const data = await authFetch("/api/orgs/dpg/shares", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (dead) return;
        setSharesAdminState({
          loading: false,
          items: Array.isArray(data?.shares) ? data.shares : [],
          error: "",
        });
      } catch (e) {
        if (dead) return;
        setSharesAdminState({
          loading: false,
          items: [],
          error: String(e?.message || e),
        });
      }
    })();

    return () => { dead = true; };
  }, [slugProp, authState.authed]);

  const slug = React.useMemo(() => {
    if (slugProp) return slugProp;
    const path = String(window.location.pathname || "/")
      .split("/")
      .filter(Boolean);
    return String(path[0] || "").trim().toLowerCase();
  }, [slugProp]);

  const basePage = getDpgPublicPage(slug);

  React.useEffect(() => {
    const pageName = slug
      ? slug
          .split("-")
          .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : "")
          .join(" ")
      : "";
    document.title = pageName && pageName !== "Home"
      ? `Dual Power Gathering • ${pageName}`
      : "Dual Power Gathering";
  }, [slug]);

  const navLinks = PUBLIC_NAV_LINKS;

  const accent = String(config?.accent_color || "#93b4f0").trim() || "#93b4f0";
  const contentPages = savedPagesOverride || config?.content_pages || {};
  const restoredBaseSlugs = new Set(["about", "faq", "volunteer", "donate"]);
  const currentPageOverride = restoredBaseSlugs.has(slug) ? {} : (contentPages?.[slug] || {});
  const page = basePage ? { ...basePage, ...currentPageOverride } : null;

  const aboutContent = normalizeAboutContent({
    ...(contentPages?.about || {}),
    ...(draftPages?.about || {}),
  });

  const faqContent = normalizeFaqContent({
    ...(contentPages?.faq || {}),
    ...(draftPages?.faq || {}),
  }, page);

  const volunteerContent = normalizeVolunteerContent({
    ...(contentPages?.volunteer || {}),
    ...(draftPages?.volunteer || {}),
  }, page);

  const donateContent = normalizeDonateContent({
    ...(contentPages?.donate || {}),
    ...(draftPages?.donate || {}),
  }, page);

  const pressContent = normalizePressContent({
    ...(contentPages?.press || {}),
    ...(draftPages?.press || {}),
  }, page);

  const sharesContent = normalizeSharesContent({
    ...(contentPages?.["dpg-shares"] || {}),
    ...(draftPages?.["dpg-shares"] || {}),
  }, page);

  const liveSharesVideos = Array.isArray(sharesState.items)
    ? sharesState.items.map((item) => ({
        tag: Array.isArray(item?.tags) && item.tags.length ? item.tags[0] : "Session",
        title: item?.title || "",
        description: item?.description || "",
        duration: item?.durationText || "",
        meta: item?.metaText || "",
        thumb: item?.thumbnailUrl || "",
        href: item?.slug ? `/dpg-shares/${item.slug}` : (item?.videoUrl || "#"),
      }))
    : [];

  const liveSharesFeatured = sharesState.featured
    ? {
        tag: Array.isArray(sharesState.featured?.tags) && sharesState.featured.tags.length ? sharesState.featured.tags[0] : "Featured",
        title: sharesState.featured?.title || "",
        description: sharesState.featured?.description || "",
        duration: sharesState.featured?.durationText || "",
        meta: sharesState.featured?.metaText || "",
        thumb: sharesState.featured?.thumbnailUrl || "",
        href: sharesState.featured?.slug ? `/dpg-shares/${sharesState.featured.slug}` : (sharesState.featured?.videoUrl || "#"),
      }
    : null;

  const rsvpContent = normalizeRsvpContent({
    ...(contentPages?.rsvp || {}),
    ...(draftPages?.rsvp || {}),
  }, page);

  const beginEditing = () => {
    setDraftPages(contentPages || {});
    setEditorMode(true);
    setActiveField("");
    setSaveMsg("");
  };

  const cancelEditing = () => {
    setDraftPages(contentPages || {});
    setEditorMode(false);
    setActiveField("");
    setSaveMsg("");
  };

  const saveDraft = async () => {
    setSaveBusy(true);
    setSaveMsg("");
    try {
      const payload = {
        ...config,
        content_pages: draftPages,
      };
      const r = await authFetch("/api/orgs/dpg/public/save", {
        method: "POST",
        body: payload,
      });
      const nextPages = r?.public?.content_pages || draftPages;
      setSavedPagesOverride(nextPages);
      setDraftPages(nextPages);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 1200);
    } catch (e) {
      setSaveMsg(e.message || "Failed to save");
    } finally {
      setSaveBusy(false);
    }
  };

  const setAboutContent = (next) => {
    setDraftPages((prev) => ({ ...(prev || {}), about: next }));
  };

  const setFaqContent = (next) => {
    setDraftPages((prev) => ({ ...(prev || {}), faq: next }));
  };

  const setVolunteerContent = (next) => {
    setDraftPages((prev) => ({ ...(prev || {}), volunteer: next }));
  };

  const setDonateContent = (next) => {
    setDraftPages((prev) => ({ ...(prev || {}), donate: next }));
  };

  const setPressContent = (next) => {
    setDraftPages((prev) => ({ ...(prev || {}), press: next }));
  };

  const setSharesContent = (next) => {
    setDraftPages((prev) => ({ ...(prev || {}), "dpg-shares": next }));
  };

  const setRsvpContent = (next) => {
    setDraftPages((prev) => ({ ...(prev || {}), rsvp: next }));
  };

  const submitPublicRsvp = async (e) => {
    e?.preventDefault();
    const name = String(rsvpForm.name || "").trim();
    const email = String(rsvpForm.email || "").trim();

    if (!name || !email) {
      setRsvpMsg("Name and email are required.");
      return;
    }

    setRsvpBusy(true);
    setRsvpMsg("");
    try {
      const res = await fetch("/api/public/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orgId: "dpg",
          ...rsvpForm,
          source: "public_rsvp_page",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      setRsvpForm({
        name: "",
        email: "",
        accessNotes: "",
        notes: "",
        volunteer: false,
        sessionLead: false,
      });
      if (data?.emailSent) {
        setRsvpMsg(
          data?.alreadyExists
            ? "Updated your RSVP. Your confirmation email is already on file."
            : "RSVP confirmed. Check your email for the full logistics form."
        );
      } else {
        const diagnostic = authState.authed && data?.emailError
          ? ` Organizer diagnostic: ${String(data.emailError)}`
          : "";
        setRsvpMsg(
          "RSVP captured. We could not send the confirmation email just now; organizers still have your RSVP." +
          diagnostic
        );
      }
    } catch (e2) {
      setRsvpMsg(String(e2?.message || e2 || "Failed to submit RSVP"));
    } finally {
      setRsvpBusy(false);
    }
  };

  const beginEditShare = (item) => {
    setEditingShareId(String(item?.id || ""));
    setShareDraft({
      title: item?.title || "",
      description: item?.description || "",
      videoUrl: item?.videoUrl || "",
      thumbnailUrl: item?.thumbnailUrl || "",
      tags: Array.isArray(item?.tags) ? item.tags.join(", ") : "",
      durationText: item?.durationText || "",
      metaText: item?.metaText || "",
      featured: !!item?.featured,
    });
    setShareCreateMsg("Editing existing share.");
  };

  const resetShareEditor = () => {
    setEditingShareId("");
    setShareDraft({
      title: "",
      description: "",
      videoUrl: "",
      thumbnailUrl: "",
      tags: "",
      durationText: "",
      metaText: "",
      featured: false,
    });
  };

  const refreshShares = async () => {
    const [fresh, adminData] = await Promise.all([
      fetch("/api/public/shares?org=dpg&limit=12", {
        headers: { Accept: "application/json" },
      }).then((r) => r.json().catch(() => ({}))),
      authFetch("/api/orgs/dpg/shares", {
        method: "GET",
        headers: { Accept: "application/json" },
      }),
    ]);

    setSharesState({
      loading: false,
      items: Array.isArray(fresh?.items) ? fresh.items : [],
      featured: fresh?.featured || null,
      error: "",
    });
    setSharesAdminState({
      loading: false,
      items: Array.isArray(adminData?.shares) ? adminData.shares : [],
      error: "",
    });
  };

  const unpublishShare = async (item) => {
    try {
      setShareCreateBusy(true);
      setShareCreateMsg("");
      await authFetch("/api/orgs/dpg/shares", {
        method: "PATCH",
        body: {
          id: item?.id,
          title: item?.title || "",
          description: item?.description || "",
          videoUrl: item?.videoUrl || "",
          thumbnailUrl: item?.thumbnailUrl || "",
          tags: Array.isArray(item?.tags) ? item.tags : [],
          durationText: item?.durationText || "",
          metaText: item?.metaText || "",
          featured: false,
          status: "draft",
        },
      });

      await refreshShares();
      if (String(editingShareId || "") === String(item?.id || "")) resetShareEditor();
      setShareCreateMsg("Share unpublished.");
    } catch (e) {
      setShareCreateMsg(String(e?.message || e || "Failed to unpublish share"));
    } finally {
      setShareCreateBusy(false);
    }
  };

  const publishShare = async () => {
    setShareCreateBusy(true);
    setShareCreateMsg("");
    try {
      const body = {
        ...shareDraft,
        tags: String(shareDraft.tags || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        status: "published",
      };

      if (editingShareId) {
        await authFetch("/api/orgs/dpg/shares", {
          method: "PATCH",
          body: { id: editingShareId, ...body },
        });
      } else {
        await authFetch("/api/orgs/dpg/shares", {
          method: "POST",
          body,
        });
      }

      const wasEditing = !!editingShareId;
      resetShareEditor();
      await refreshShares();
      setShareCreateMsg(wasEditing ? "Share updated." : "Video entry published.");
    } catch (e) {
      setShareCreateMsg(String(e?.message || e || "Failed to publish video entry"));
    } finally {
      setShareCreateBusy(false);
    }
  };

  if (!page) {
    return (
      <div style={{ ...theme.page, fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px 72px" }}>
          <PublicNav links={navLinks} authed={authState.authed} accent={accent} />
          <h1 style={{ color: "#f3efe8", fontFamily: "Inter, system-ui, Arial, sans-serif", fontWeight: 900 }}>
            Page not found
          </h1>
          <p style={{ color: "#d7ddd8" }}>That public page has not been migrated yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...theme.page, fontFamily: 'var(--dpg-font, "Formulario 1312", Inter, system-ui, Arial, sans-serif)' }}>
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
              Click the actual content to edit. Save only when you want to publish.
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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

      <div className="dpg-public-page-shell" style={{ maxWidth: slug === "about" ? 1240 : 1160, margin: "0 auto", padding: "32px 20px 80px" }}>
        <PublicNav links={navLinks} authed={authState.authed} accent={accent} />

        {slug === "about" ? (
          <AboutPageLayout
            accent={accent}
            editorMode={editorMode}
            activeField={activeField}
            setActiveField={setActiveField}
            content={aboutContent}
            setContent={setAboutContent}
          />
        ) : slug === "faq" ? (
          <FaqPageLayout
            accent={accent}
            editorMode={editorMode}
            activeField={activeField}
            setActiveField={setActiveField}
            content={faqContent}
            setContent={setFaqContent}
          />
        ) : slug === "volunteer" ? (
          <VolunteerPageLayout
            accent={accent}
            editorMode={editorMode}
            activeField={activeField}
            setActiveField={setActiveField}
            content={volunteerContent}
            setContent={setVolunteerContent}
          />
        ) : slug === "donate" ? (
          <DonatePageLayout
            accent={accent}
            editorMode={editorMode}
            activeField={activeField}
            setActiveField={setActiveField}
            content={donateContent}
            setContent={setDonateContent}
          />
        ) : slug === "press" ? (
          <PressPageLayout
            accent={accent}
            editorMode={editorMode}
            activeField={activeField}
            setActiveField={setActiveField}
            content={pressContent}
            setContent={setPressContent}
          />
        ) : slug === "rsvp" ? (
          <RsvpPageLayout
            accent={accent}
            editorMode={editorMode}
            activeField={activeField}
            setActiveField={setActiveField}
            content={rsvpContent}
            setContent={setRsvpContent}
            rsvpForm={rsvpForm}
            setRsvpForm={setRsvpForm}
            rsvpBusy={rsvpBusy}
            rsvpMsg={rsvpMsg}
            submitPublicRsvp={submitPublicRsvp}
          />
        ) : (
          slug === "dpg-shares" ? (
          <SharesPageLayout
            accent={accent}
            editorMode={editorMode}
            activeField={activeField}
            setActiveField={setActiveField}
            content={sharesContent}
            setContent={setSharesContent}
            authed={authState.authed}
            sharesLoading={sharesState.loading}
            sharesError={sharesState.error}
            sharesAdminState={sharesAdminState}
            editingShareId={editingShareId}
            shareDraft={shareDraft}
            setShareDraft={setShareDraft}
            shareCreateBusy={shareCreateBusy}
            shareCreateMsg={shareCreateMsg}
            onPublishShare={publishShare}
            onBeginEditShare={beginEditShare}
            onUnpublishShare={unpublishShare}
            onResetShareEditor={resetShareEditor}
            liveVideos={liveSharesVideos}
            liveFeatured={liveSharesFeatured}
            hasLiveShares={liveSharesVideos.length > 0}
          />
        ) : (
          <GenericPublicPage page={page} accent={accent} />
        )
        )}
      </div>
    </div>
  );
}
