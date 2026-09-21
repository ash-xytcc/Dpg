import React, { useEffect, useRef, useState } from "react";

const EMBED_ORIGIN = "https://embed.diagrams.net";
const EMBED_URL = `${EMBED_ORIGIN}/?embed=1&proto=json&spin=1&libraries=1&themes=1&noExitBtn=1&keepmodified=1`;

const EMPTY_DIAGRAM = `<mxfile host="app.diagrams.net"><diagram name="Page-1"><mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;

function parseMessage(event) {
  if (event.origin !== EMBED_ORIGIN) return null;
  if (typeof event.data === "object") return event.data;
  try { return JSON.parse(String(event.data || "")); } catch { return null; }
}

export default function DrawioFileView({ value, onChange, title = "Diagram", mode = "edit" }) {
  const iframeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading diagrams.net…");
  const readOnly = mode === "preview";

  useEffect(() => {
    const onMessage = (event) => {
      const message = parseMessage(event);
      if (!message || event.source !== iframeRef.current?.contentWindow) return;
      if (message.event === "init" || message.event === "ready") {
        setReady(true);
        setStatus(readOnly ? "Preview" : "Ready");
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
          action: "load",
          xml: String(value || EMPTY_DIAGRAM),
          title,
          autosave: readOnly ? 0 : 1,
          noSaveBtn: readOnly ? 1 : 0,
          noExitBtn: 1,
          saveAndExit: 0,
          modified: readOnly ? 0 : 1,
          dark: 1,
        }), EMBED_ORIGIN);
        return;
      }
      if ((message.event === "autosave" || message.event === "save") && typeof message.xml === "string" && !readOnly) {
        onChange?.(message.xml);
        setStatus("Saved");
      }
      if (message.event === "exit" && !readOnly) setStatus("Ready");
      if (message.error) setStatus(`Diagram error: ${message.error}`);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onChange, readOnly, title, value]);

  useEffect(() => {
    if (!ready || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(JSON.stringify({
      action: "merge",
      xml: String(value || EMPTY_DIAGRAM),
    }), EMBED_ORIGIN);
  }, [ready]);

  return (
    <div style={{ display: "grid", gap: 8, minHeight: "72vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="helper">diagrams.net editor</span>
        <span className="helper">{status}</span>
        <a className="btn" href="https://app.diagrams.net/" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", padding: "6px 10px" }}>
          Open standalone editor
        </a>
      </div>
      <iframe
        ref={iframeRef}
        title={title}
        src={EMBED_URL}
        style={{ width: "100%", minHeight: "68vh", border: "1px solid #24262a", borderRadius: 12, background: "#17191d" }}
      />
    </div>
  );
}
