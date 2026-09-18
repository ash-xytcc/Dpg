import React from "react";
import { INSTANCE, siteTitle } from "../../config/instance.js";

export default function PublicHome() {
  React.useEffect(() => {
    document.title = siteTitle("Home");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#f5f5f5" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 64px" }}>
        <header style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>
            {INSTANCE.shortName}
          </div>
          <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.05 }}>
            {INSTANCE.name}
          </h1>
          <p style={{ margin: 0, fontSize: 18, maxWidth: 720, opacity: 0.88 }}>
            {INSTANCE.tagline}
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div style={cardStyle}>
            <h2 style={h2Style}>Public info</h2>
            <p style={pStyle}>
              This is the public facing front door for schedules, announcements, logistics, and event info.
            </p>
          </div>

          <div style={cardStyle}>
            <h2 style={h2Style}>Admin operations</h2>
            <p style={pStyle}>
              The admin side will handle intake, logistics, volunteer coordination, and internal operations.
            </p>
          </div>

          <div style={cardStyle}>
            <h2 style={h2Style}>RSVP flow</h2>
            <p style={pStyle}>
              Ghost remains the live RSVP intake for now. Import and sync can be added later once the DPG app is stable.
            </p>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={h2Style}>Launch priorities</h2>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Public home and information pages</li>
            <li>Admin operations dashboard</li>
            <li>Public inbox and intake review</li>
            <li>Meetings, logistics, and volunteer coordination</li>
            <li>Later: RSVP import or direct intake</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

const cardStyle = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  padding: 20,
};

const h2Style = {
  margin: 0,
  fontSize: 20,
};

const pStyle = {
  margin: "10px 0 0",
  lineHeight: 1.6,
  opacity: 0.88,
};
