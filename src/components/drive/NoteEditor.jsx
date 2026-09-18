import React from "react";
import { isDpgVariant } from "../../lib/appVariant.js";

export default function NoteEditor({ value, onChange, focusMode, editorRef }) {
  const dpg = isDpgVariant();
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", background: dpg ? "#fff" : "rgba(255,255,255,0.02)", border: dpg ? "1px solid rgba(56,80,50,0.12)" : "1px solid #1f1f1f", borderRadius: 10, padding: focusMode ? 10 : 8 }}>
      <textarea ref={editorRef} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} style={{ width: "100%", minHeight: focusMode ? "84vh" : "72vh", background: "transparent", border: "none", outline: "none", color: dpg ? "#182018" : "#f5f5f5", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, lineHeight: 1.55, resize: "none" }} />
    </div>
  );
}
