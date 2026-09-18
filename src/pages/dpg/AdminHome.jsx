import React from "react";
import { INSTANCE, siteTitle } from "../../config/instance.js";

const sections = [
  {
    key: "inbox",
    title: "Inbox",
    body: "Review public submissions, contact requests, and future RSVP imports.",
  },
  {
    key: "meetings",
    title: "Meetings",
    body: "Track planning meetings, agendas, notes, and operational cadence.",
  },
  {
    key: "volunteers",
    title: "Volunteers",
    body: "Coordinate staffing, roles, tasks, and on the ground capacity.",
  },
  {
    key: "logistics",
    title: "Logistics",
    body: "Manage housing, rides, supplies, food, and event support information.",
  },
];

export default function AdminHome() {
  React.useEffect(() => {
    document.title = siteTitle("Admin");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#f5f5f5" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 64px" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.72 }}>
            {INSTANCE.shortName} admin
          </div>
          <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(1.8rem, 4vw, 3rem)", lineHeight: 1.06 }}>
            Operations center
          </h1>
          <p style={{ margin: 0, maxWidth: 760, opacity: 0.86, lineHeight: 1.6 }}>
            This is the standalone DPG admin shell. It is the place future intake, logistics, and coordination features should land.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {sections.map((section) => (
            <section
              key={section.key}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                background: "rgba(255,255,255,0.04)",
                padding: 20,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20 }}>{section.title}</h2>
              <p style={{ margin: "10px 0 0", lineHeight: 1.6, opacity: 0.88 }}>
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
