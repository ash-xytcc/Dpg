import React from "react";

const STORAGE_KEY = "dpg_sessions_v2";

const SESSION_THEME = {
  bg: "transparent",
  bgElev: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72)",
  border: "rgba(255,255,255,0.08)",
  text: "#f3efe8",
  muted: "#d7ddd8",
  accent: "#93b4f0",
  inputBg: "rgba(255,255,255,0.06)",
  inputText: "#f3efe8",
};

const SESSIONS_MOBILE_CSS = `
  @media (max-width: 820px) {
    .dpg-sessions-top-grid {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
    .dpg-sessions-form-grid {
      grid-template-columns: 1fr !important;
    }
    .dpg-sessions-title {
      font-size: clamp(2.4rem, 12vw, 4rem) !important;
    }
    .dpg-sessions-subcopy {
      font-size: 18px !important;
    }
    .dpg-sessions-card-title {
      font-size: 24px !important;
    }
  }
`;


const seed = {
  anchors: [
    {
      id: "anchor-1",
      title: "welcome and whiteboard orientation",
      description:
        "A lightweight opening slot to explain the process, norms, and how proposals become real sessions on site.",
      votes: 4,
      leads: [],
      tags: ["orientation", "anchor"],
    },
    {
      id: "anchor-2",
      title: "regional breakouts",
      description:
        "Pre scheduled container for people to cluster by region before the board fills out organically.",
      votes: 6,
      leads: [],
      tags: ["regional", "anchor"],
    },
  ],
  interestPool: [
    {
      id: "pool-1",
      title: "movement kitchens and food distro",
      description:
        "Practical discussion around feeding people at scale, volunteer structure, sanitation, and menu logistics.",
      votes: 11,
      leads: [],
      tags: ["food", "mutual-aid"],
    },
    {
      id: "pool-2",
      title: "community defense radios",
      description:
        "Basic infrastructure, radio usage, low tech redundancy, and how groups actually stay in touch when signal dies.",
      votes: 9,
      leads: [],
      tags: ["comms", "defense"],
    },
    {
      id: "pool-3",
      title: "transforming conflict in movement spaces",
      description:
        "How people handle rupture, repair, and difficult conversations without reproducing bullshit.",
      votes: 14,
      leads: [],
      tags: ["facilitation", "care"],
    },
  ],
  leadThis: [
    {
      id: "lead-1",
      title: "de escalation basics",
      description:
        "Needs someone willing to facilitate a practical intro level session.",
      votes: 7,
      leads: [],
      tags: ["safety", "facilitation"],
    },
    {
      id: "lead-2",
      title: "childcare and child track planning",
      description:
        "Space for people ready to shape child friendly offerings and support structure.",
      votes: 5,
      leads: [],
      tags: ["childcare", "care"],
    },
  ],
  buildOnSite: [
    {
      id: "onsite-1",
      title: "open board proposals",
      description:
        "Most real programming should still emerge from the live whiteboard process during the event.",
      votes: 0,
      leads: [],
      tags: ["onsite"],
    },
  ],
};

function normalizeBucket(items = []) {
  return items.map((item) => ({
    ...item,
    leads: Array.isArray(item.leads)
      ? item.leads
      : item.lead
        ? [item.lead]
        : [],
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    return {
      anchors: normalizeBucket(parsed.anchors || seed.anchors),
      interestPool: normalizeBucket(parsed.interestPool || seed.interestPool),
      leadThis: normalizeBucket(parsed.leadThis || seed.leadThis),
      buildOnSite: normalizeBucket(parsed.buildOnSite || seed.buildOnSite),
    };
  } catch {
    return seed;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function cardStyle(bg) {
  return {
    background: bg,
    borderRadius: 18,
    padding: 18,
    minHeight: 170,
    boxShadow: "0 18px 42px rgba(0,0,0,0.16)",
    border: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
}

function buttonStyle(active = false) {
  return {
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    background: active ? "var(--accent)" : "rgba(255,255,255,0.05)",
    color: active ? "#121715" : "var(--text)",
    fontWeight: 700,
    fontSize: 14,
  };
}

function SessionCard({ item, color, onVote, onClaimLead, onClearLeads, onRemoveLead }) {
  const [leadName, setLeadName] = React.useState("");

  return (
    <div style={cardStyle(color)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h3
          className="dpg-sessions-card-title"
          style={{
            margin: 0,
            fontSize: 28,
            lineHeight: 1,
            fontWeight: 800,
            color: "var(--text)",
            textTransform: "lowercase",
          }}
        >
          {item.title}
        </h3>

        <button type="button" onClick={onVote} style={buttonStyle(false)}>
          ↑ {item.votes}
        </button>
      </div>

      <div style={{ fontSize: 18, color: "var(--text)", lineHeight: 1.35 }}>
        {item.description}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(item.tags || []).map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 13,
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--border)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
        {Array.isArray(item.leads) && item.leads.length > 0 ? (
          <div
            style={{
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--border)",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              current leads
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {item.leads.map((name) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{name}</div>
                  <button
                    type="button"
                    onClick={() => onRemoveLead(name)}
                    style={buttonStyle(false)}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>

            <div>
              <button type="button" onClick={onClearLeads} style={buttonStyle(false)}>
                clear all
              </button>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = leadName.trim();
            if (!name) return;
            onClaimLead(name);
            setLeadName("");
          }}
          style={{
            display: "grid",
            gap: 8,
          }}
        >
          <label
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Name
          </label>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="enter your name"
              aria-label="Name"
              style={{
                flex: "1 1 180px",
                minWidth: 0,
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "10px 12px",
                fontSize: 15,
                color: "var(--input-text)",
                background: "var(--input-bg)",
              }}
            />
            <button
              type="submit"
              disabled={!leadName.trim()}
              style={{
                ...buttonStyle(true),
                opacity: leadName.trim() ? 1 : 0.55,
                cursor: leadName.trim() ? "pointer" : "not-allowed",
              }}
            >
              i can lead this
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Column({
  title,
  subtitle,
  color,
  items,
  onVote,
  onClaimLead,
  onClearLeads,
  onRemoveLead,
}) {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 36,
            lineHeight: 1,
            color: "var(--accent)",
            textTransform: "lowercase",
          }}
        >
          {title}
        </h2>
        <div style={{ marginTop: 8, fontSize: 16, color: "var(--muted)" }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {items.length ? (
          items.map((item) => (
            <SessionCard
              key={item.id}
              item={item}
              color={color}
              onVote={() => onVote(item.id)}
              onClaimLead={(name) => onClaimLead(item.id, name)}
              onClearLeads={() => onClearLeads(item.id)}
              onRemoveLead={(name) => onRemoveLead(item.id, name)}
            />
          ))
        ) : (
          <div style={cardStyle(color)}>
            <div style={{ fontSize: 18, color: "var(--text)" }}>nothing here yet</div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function DpgSessionsPage() {
  const [data, setData] = React.useState(loadState);
  const [query, setQuery] = React.useState("");
  const [newItem, setNewItem] = React.useState({
    title: "",
    description: "",
    bucket: "interestPool",
    tags: "",
  });

  React.useEffect(() => {
    saveState(data);
  }, [data]);

  function updateBucket(bucketName, updater) {
    setData((prev) => ({
      ...prev,
      [bucketName]: prev[bucketName].map(updater),
    }));
  }

  function vote(bucketName, id) {
    updateBucket(bucketName, (item) =>
      item.id === id ? { ...item, votes: (item.votes || 0) + 1 } : item
    );
  }

  function claimLead(bucketName, id, name) {
    updateBucket(bucketName, (item) => {
      if (item.id !== id) return item;
      const existing = Array.isArray(item.leads) ? item.leads : [];
      if (existing.some((x) => x.toLowerCase() == name.toLowerCase())) return item;
      return { ...item, leads: [...existing, name] };
    });
  }

  function clearLeads(bucketName, id) {
    updateBucket(bucketName, (item) =>
      item.id === id ? { ...item, leads: [] } : item
    );
  }

  function removeLead(bucketName, id, name) {
    updateBucket(bucketName, (item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        leads: (item.leads || []).filter((x) => x !== name),
      };
    });
  }

  function addIdea(e) {
    e.preventDefault();
    const title = newItem.title.trim();
    const description = newItem.description.trim();
    if (!title || !description) return;

    const item = {
      id: `${newItem.bucket}-${Date.now()}`,
      title: title.toLowerCase(),
      description,
      votes: 0,
      leads: [],
      tags: newItem.tags
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    };

    setData((prev) => ({
      ...prev,
      [newItem.bucket]: [item, ...prev[newItem.bucket]],
    }));

    setNewItem({
      title: "",
      description: "",
      bucket: "interestPool",
      tags: "",
    });
  }

  function filterItems(items) {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [
        item.title,
        item.description,
        ...(item.tags || []),
        ...((item.leads || [])),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const buckets = [
    {
      key: "anchors",
      title: "anchors",
      subtitle: "A few things pre scheduled ahead of time.",
      color: "rgba(255,245,120,0.32)",
    },
    {
      key: "interestPool",
      title: "interest pool",
      subtitle: "Ideas people want, with upvotes and demand signals.",
      color: "rgba(120,235,255,0.30)",
    },
    {
      key: "leadThis",
      title: "lead this",
      subtitle: "Someone can step forward to facilitate or hold the slot.",
      color: "rgba(255,140,220,0.30)",
    },
    {
      key: "buildOnSite",
      title: "build on site",
      subtitle: "Most of the real programming still comes together in person.",
      color: "rgba(140,255,140,0.30)",
    },
  ];

  return (
    <div
      className="dpg-sessions-root"
      style={{
        "--bg": SESSION_THEME.bg,
        "--bg-elev": SESSION_THEME.bgElev,
        "--border": SESSION_THEME.border,
        "--text": SESSION_THEME.text,
        "--muted": SESSION_THEME.muted,
        "--accent": SESSION_THEME.accent,
        "--input-bg": SESSION_THEME.inputBg,
        "--input-text": SESSION_THEME.inputText,
        padding: 0,
        background: "transparent",
        minHeight: "100%",
        color: "var(--text)",
      }}
    >
      <style>{SESSIONS_MOBILE_CSS}</style>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 24,
          padding: 22,
          background: "var(--bg-elev)",
          boxShadow: "0 18px 42px rgba(0,0,0,0.16)",
          marginBottom: 20,
        }}
      >
        <h1
          className="dpg-sessions-title"
          style={{
            margin: 0,
            fontSize: "clamp(2.6rem, 6vw, 5.4rem)",
            lineHeight: 0.95,
            color: "var(--accent)",
            textTransform: "lowercase",
          }}
        >
          sessions
        </h1>

        <p
          className="dpg-sessions-subcopy"
          style={{
            margin: "16px 0 0",
            fontSize: 20,
            lineHeight: 1.45,
            color: "var(--muted)",
            maxWidth: 1200,
          }}
        >
          This is the future home of the DPG session commons: ideas, upvotes,
          pre scheduled anchors, and multi lead support, all shaped around the
          actual whiteboard process used at the event.
        </p>
      </div>

      <div
        className="dpg-sessions-top-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <form
          onSubmit={addIdea}
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 18px 42px rgba(0,0,0,0.16)",
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "var(--accent)",
              textTransform: "lowercase",
            }}
          >
            add a session idea
          </div>

          <input
            value={newItem.title}
            onChange={(e) =>
              setNewItem((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="title"
            style={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              padding: "12px 14px",
              fontSize: 16,
              background: "var(--input-bg)",
              color: "var(--input-text)",
            }}
          />

          <textarea
            value={newItem.description}
            onChange={(e) =>
              setNewItem((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="what is this session or conversation about"
            rows={4}
            style={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              padding: "12px 14px",
              fontSize: 16,
              resize: "vertical",
              background: "var(--input-bg)",
              color: "var(--input-text)",
            }}
          />

          <div
            className="dpg-sessions-form-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <select
              value={newItem.bucket}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, bucket: e.target.value }))
              }
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "12px 14px",
                fontSize: 16,
                background: "var(--input-bg)",
                color: "var(--input-text)",
              }}
            >
              <option value="interestPool">interest pool</option>
              <option value="leadThis">lead this</option>
              <option value="anchors">anchors</option>
              <option value="buildOnSite">build on site</option>
            </select>

            <input
              value={newItem.tags}
              onChange={(e) =>
                setNewItem((prev) => ({ ...prev, tags: e.target.value }))
              }
              placeholder="tags, comma, separated"
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                padding: "12px 14px",
                fontSize: 16,
                background: "var(--input-bg)",
                color: "var(--input-text)",
              }}
            />
          </div>

          <div>
            <button type="submit" style={buttonStyle(true)}>
              add idea
            </button>
          </div>
        </form>

        <div
          style={{
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 18px 42px rgba(0,0,0,0.16)",
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "var(--accent)",
              textTransform: "lowercase",
            }}
          >
            filter
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search titles, descriptions, tags, or leads"
            style={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              padding: "12px 14px",
              fontSize: 16,
              background: "var(--input-bg)",
              color: "var(--input-text)",
            }}
          />

          <div style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.45 }}>
            This is intentionally halfway between a suggestion board and a real
            scheduling tool. The point is to support the live whiteboard, not
            replace it with software because apparently everything must become an app.
          </div>

          <div
            style={{
              marginTop: "auto",
              padding: 14,
              borderRadius: 14,
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              fontSize: 17,
              color: "var(--text)",
            }}
          >
            <strong>Current org:</strong> Dual Power Gathering
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        {buckets.map((bucket) => (
          <Column
            key={bucket.key}
            title={bucket.title}
            subtitle={bucket.subtitle}
            color={bucket.color}
            items={filterItems(data[bucket.key] || [])}
            onVote={(id) => vote(bucket.key, id)}
            onClaimLead={(id, name) => claimLead(bucket.key, id, name)}
            onClearLeads={(id) => clearLeads(bucket.key, id)}
            onRemoveLead={(id, name) => removeLead(bucket.key, id, name)}
          />
        ))}
      </div>
    </div>
  );
}
