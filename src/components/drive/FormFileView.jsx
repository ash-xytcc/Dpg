import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_FORM = {
  type: "bondfire-form",
  version: 3,
  title: "Untitled form",
  description: "",
  blocks: [
    { id: "field_1", type: "question", fieldType: "text", label: "Your name", required: false, options: [] },
    { id: "field_2", type: "question", fieldType: "paragraph", label: "Details", required: false, options: [] },
  ],
  fields: [],
  responses: [],
  publicShare: { enabled: false, token: "" },
};

function makeToken() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/gim, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gim, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inCode = false;
  let codeLines = [];
  let codeLanguage = "";
  let listTag = "";
  const closeList = () => { if (listTag) { html += `</${listTag}>`; listTag = ""; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (inCode) {
      if (line.startsWith("```")) {
        html += `<pre><code class="lang-${escapeHtml(codeLanguage)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`;
        inCode = false; codeLines = []; codeLanguage = "";
      } else codeLines.push(raw);
      continue;
    }
    if (line.startsWith("```")) { closeList(); inCode = true; codeLanguage = line.slice(3).trim(); continue; }
    if (!line) { closeList(); continue; }
    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) { closeList(); html += "<hr />"; continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { closeList(); const level = heading[1].length; html += `<h${level}>${applyInlineMarkdown(heading[2])}</h${level}>`; continue; }
    if (line.startsWith(">")) { closeList(); html += `<blockquote><p>${applyInlineMarkdown(line.replace(/^>\s?/, ""))}</p></blockquote>`; continue; }
    const task = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (task || bullet || ordered) {
      const nextTag = ordered ? "ol" : "ul";
      if (listTag !== nextTag) { closeList(); html += `<${nextTag}>`; listTag = nextTag; }
      if (task) {
        const checked = String(task[1]).toLowerCase() === "x";
        html += `<li class="task-list-item"><label><input type="checkbox" disabled ${checked ? "checked" : ""} /> ${applyInlineMarkdown(task[2])}</label></li>`;
      } else html += `<li>${applyInlineMarkdown(bullet ? bullet[1] : ordered[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${applyInlineMarkdown(line)}</p>`;
  }
  closeList();
  if (inCode) html += `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
  return html;
}

function MarkdownContent({ value, className = "" }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }} />;
}

function safeParse(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (parsed && parsed.type === "bondfire-form") return parsed;
  } catch {}
  return DEFAULT_FORM;
}

function normalizeQuestion(field, idx) {
  const fieldType = ["text", "paragraph", "choice", "checkbox", "date"].includes(String(field?.fieldType || field?.type || ""))
    ? (field?.fieldType || field.type) : "text";
  return {
    id: String(field?.id || `field_${idx + 1}`),
    type: "question",
    fieldType,
    label: String(field?.label || `Question ${idx + 1}`),
    required: !!field?.required,
    options: Array.isArray(field?.options) ? field.options.map((x) => String(x || "")).filter(Boolean) : [],
  };
}

function normalizeBlock(block, idx) {
  if (block?.type === "display" || block?.type === "text") {
    return { id: String(block.id || `display_${idx + 1}`), type: "display", text: String(block.text ?? block.content ?? "") };
  }
  if (block?.type === "page-break" || block?.type === "pageBreak") {
    return { id: String(block.id || `page_${idx + 1}`), type: "page-break", label: String(block.label || "Page break") };
  }
  return normalizeQuestion(block, idx);
}

function normalizeForm(input) {
  const rawBlocks = Array.isArray(input?.blocks) && input.blocks.length
    ? input.blocks
    : (Array.isArray(input?.fields) ? input.fields : DEFAULT_FORM.blocks);
  const blocks = rawBlocks.map(normalizeBlock);
  const fields = blocks.filter((block) => block.type === "question").map((block, idx) => normalizeQuestion(block, idx));
  return {
    type: "bondfire-form",
    version: 3,
    title: String(input?.title || "Untitled form"),
    description: String(input?.description || ""),
    blocks,
    fields,
    responses: Array.isArray(input?.responses) ? input.responses : [],
    publicShare: { enabled: !!input?.publicShare?.enabled, token: String(input?.publicShare?.token || "") },
  };
}

function serialize(form) {
  return JSON.stringify(normalizeForm(form), null, 2);
}

function FieldPreview({ field, answer, onAnswerChange, readOnly = false }) {
  const fieldType = field.fieldType || field.type;
  if (fieldType === "paragraph") return <textarea disabled={readOnly} className="input" value={String(answer || "")} onChange={(e) => onAnswerChange?.(e.target.value)} placeholder="Long answer" style={{ width: "100%", minHeight: 88, padding: 8, resize: "vertical" }} />;
  if (fieldType === "choice") return <div style={{ display: "grid", gap: 8 }}>{field.options.map((option, idx) => <label key={`${field.id}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="radio" disabled={readOnly} name={field.id} checked={String(answer || "") === option} onChange={() => onAnswerChange?.(option)} /><MarkdownContent value={option} /></label>)}</div>;
  if (fieldType === "checkbox") {
    const selected = Array.isArray(answer) ? answer.map(String) : [];
    return <div style={{ display: "grid", gap: 8 }}>{field.options.map((option, idx) => { const checked = selected.includes(option); return <label key={`${field.id}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" disabled={readOnly} checked={checked} onChange={(e) => onAnswerChange?.(e.target.checked ? [...selected, option] : selected.filter((value) => value !== option))} /><MarkdownContent value={option} /></label>; })}</div>;
  }
  if (fieldType === "date") return <input disabled={readOnly} className="input" type="date" value={String(answer || "")} onChange={(e) => onAnswerChange?.(e.target.value)} style={{ width: "100%", padding: 8 }} />;
  return <input disabled={readOnly} className="input" type="text" value={String(answer || "")} onChange={(e) => onAnswerChange?.(e.target.value)} placeholder="Short answer" style={{ width: "100%", padding: 8 }} />;
}

function answerSummary(field, value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if ((field.fieldType || field.type) === "checkbox") return "—";
  return String(value || "—");
}

function InsertionControl({ index, onInsert }) {
  return <div style={{ display: "flex", justifyContent: "center", padding: "3px 0" }}><button className="btn" type="button" title={`Insert block at position ${index + 1}`} aria-label={`Insert block at position ${index + 1}`} onClick={() => onInsert(index)} style={{ borderRadius: "50%", width: 28, height: 28, padding: 0, lineHeight: 1, fontSize: 18 }}>+</button></div>;
}

export default function FormFileView({ value, onChange, mode = "edit", fileId = "", orgId = "" }) {
  const form = useMemo(() => normalizeForm(safeParse(value)), [value]);
  const readOnly = mode === "preview";
  const [draftAnswers, setDraftAnswers] = useState({});
  const [responseStatus, setResponseStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [insertAt, setInsertAt] = useState(null);

  useEffect(() => { if (!copyStatus) return undefined; const timer = setTimeout(() => setCopyStatus(""), 1800); return () => clearTimeout(timer); }, [copyStatus]);

  const publicUrl = form.publicShare.enabled && form.publicShare.token && fileId ? `${window.location.origin}/api/public/forms/${encodeURIComponent(fileId)}?token=${encodeURIComponent(form.publicShare.token)}` : "";
  const standaloneEditorUrl = fileId && orgId ? `${window.location.origin}/app/#/org/${encodeURIComponent(orgId)}/drive?file=${encodeURIComponent(fileId)}` : "";
  const commit = (next) => onChange?.(serialize(next));
  const setFormProp = (key, nextValue) => commit({ ...form, [key]: nextValue });
  const setBlock = (blockId, patch) => commit({ ...form, blocks: form.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block) });
  const removeBlock = (blockId) => commit({ ...form, blocks: form.blocks.filter((block) => block.id !== blockId) });
  const addBlockAt = (type, index) => {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const block = type === "question"
      ? { id, type: "question", fieldType: "text", label: "Untitled question", required: false, options: [] }
      : type === "display"
        ? { id, type: "display", text: "Display text" }
        : { id, type: "page-break", label: "Page break" };
    const nextBlocks = [...form.blocks]; nextBlocks.splice(index, 0, block); commit({ ...form, blocks: nextBlocks }); setInsertAt(null);
  };
  const insertBlock = (index) => { if (insertAt === index) setInsertAt(null); else setInsertAt(index); };
  const setDraftAnswer = (fieldId, nextValue) => { setResponseStatus(""); setDraftAnswers((prev) => ({ ...prev, [fieldId]: nextValue })); };
  const togglePublicShare = (enabled) => commit({ ...form, publicShare: { enabled, token: enabled ? (form.publicShare.token || makeToken()) : form.publicShare.token } });
  const regeneratePublicLink = () => { commit({ ...form, publicShare: { enabled: true, token: makeToken() } }); setCopyStatus("New link generated"); };
  const copyPublicUrl = async () => { if (!publicUrl) return; try { await navigator.clipboard.writeText(publicUrl); setCopyStatus("Link copied"); } catch { setCopyStatus("Copy failed"); } };
  const openPublicUrl = () => { if (publicUrl) window.open(publicUrl, "_blank", "noopener,noreferrer"); };
  const openEditorUrl = () => { if (standaloneEditorUrl) window.open(standaloneEditorUrl, "_blank", "noopener,noreferrer"); };
  const submitResponse = () => {
    const missingRequired = form.fields.find((field) => { const answer = draftAnswers[field.id]; return field.required && ((field.fieldType === "checkbox" && (!Array.isArray(answer) || !answer.length)) || (field.fieldType !== "checkbox" && !String(answer || "").trim())); });
    if (missingRequired) { setResponseStatus(`Missing required field: ${missingRequired.label}`); return; }
    const response = { id: `resp_${Date.now()}`, submittedAt: Date.now(), source: "internal", answers: form.fields.reduce((acc, field) => { const answer = draftAnswers[field.id]; acc[field.id] = field.fieldType === "checkbox" ? (Array.isArray(answer) ? answer : []) : String(answer || ""); return acc; }, {}) };
    commit({ ...form, responses: [...form.responses, response] }); setDraftAnswers({}); setResponseStatus("Response submitted.");
  };

  const renderEditorBlock = (block, idx) => {
    if (block.type === "display") return <div key={block.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><strong>Display text</strong><button className="btn" type="button" onClick={() => removeBlock(block.id)} style={{ color: "#ff9a9a" }}>Delete</button></div><textarea className="input" value={block.text} onChange={(e) => setBlock(block.id, { text: e.target.value })} placeholder="Markdown text shown to respondents" style={{ minHeight: 100, padding: 10, resize: "vertical" }} /><div className="helper">Markdown is supported.</div></div>;
    if (block.type === "page-break") return <div key={block.id} style={{ border: "1px dashed rgba(255,255,255,0.25)", borderRadius: 10, padding: 10, display: "flex", alignItems: "center", gap: 10 }}><hr style={{ flex: 1, border: 0, borderTop: "1px solid rgba(255,255,255,0.2)" }} /><span className="helper">Page break</span><hr style={{ flex: 1, border: 0, borderTop: "1px solid rgba(255,255,255,0.2)" }} /><button className="btn" type="button" onClick={() => removeBlock(block.id)} style={{ color: "#ff9a9a" }}>Delete</button></div>;
    const field = normalizeQuestion(block, idx);
    return <div key={block.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}><div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}><textarea className="input" value={field.label} onChange={(e) => setBlock(block.id, { label: e.target.value })} placeholder="Question (Markdown supported)" style={{ flex: 1, minWidth: 220, minHeight: 42, padding: "8px 10px", resize: "vertical" }} /><select className="input" value={field.fieldType} onChange={(e) => setBlock(block.id, { fieldType: e.target.value, options: ["choice", "checkbox"].includes(e.target.value) ? (field.options.length ? field.options : ["Option 1", "Option 2"]) : [] })} style={{ width: 160, padding: "8px 10px" }}><option value="text">Text</option><option value="paragraph">Paragraph</option><option value="choice">Choice</option><option value="checkbox">Checkbox</option><option value="date">Date</option></select><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" checked={field.required} onChange={(e) => setBlock(block.id, { required: e.target.checked })} />Required</label><button className="btn" type="button" onClick={() => removeBlock(block.id)} style={{ color: "#ff9a9a" }}>Delete</button></div>{["choice", "checkbox"].includes(field.fieldType) ? <div style={{ display: "grid", gap: 6 }}><div className="helper">Options (add as many as you need)</div>{field.options.map((option, optionIndex) => <div key={`${block.id}-option-${optionIndex}`} style={{ display: "flex", gap: 6 }}><input className="input" value={option} onChange={(e) => setBlock(block.id, { options: field.options.map((item, i) => i === optionIndex ? e.target.value : item) })} placeholder={`Option ${optionIndex + 1}`} style={{ flex: 1, padding: "7px 9px" }} /><button className="btn" type="button" onClick={() => setBlock(block.id, { options: field.options.filter((_item, i) => i !== optionIndex) })} aria-label={`Delete option ${optionIndex + 1}`}>×</button></div>)}<button className="btn" type="button" onClick={() => setBlock(block.id, { options: [...field.options, `Option ${field.options.length + 1}`] })} style={{ justifySelf: "start" }}>+ Add option</button></div> : null}<div style={{ opacity: 0.8 }}><MarkdownContent value={field.label} className="bf-form-markdown" /><FieldPreview field={field} answer={field.fieldType === "checkbox" ? [] : ""} readOnly /></div></div>;
  };

  const renderPreviewBlock = (block, idx) => {
    if (block.type === "display") return <div key={block.id} style={{ padding: "4px 2px" }}><MarkdownContent value={block.text} className="bf-form-markdown" /></div>;
    if (block.type === "page-break") return <div key={block.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}><hr style={{ flex: 1, border: 0, borderTop: "1px solid rgba(255,255,255,0.25)" }} /><span className="helper">Page break</span><hr style={{ flex: 1, border: 0, borderTop: "1px solid rgba(255,255,255,0.25)" }} /></div>;
    const field = normalizeQuestion(block, idx);
    const questionNumber = form.blocks.slice(0, idx + 1).filter((item) => item.type === "question").length;
    return <div key={block.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}><div style={{ fontWeight: 700 }}>{questionNumber}. <MarkdownContent value={field.label} className="bf-form-markdown" /> {field.required ? <span style={{ color: "#ff9a9a" }}>*</span> : null}</div><FieldPreview field={field} answer={draftAnswers[field.id]} onAnswerChange={(next) => setDraftAnswer(field.id, next)} /></div>;
  };

  return <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 8 }}>
    <style>{`.bf-form-markdown{line-height:1.5}.bf-form-markdown p{margin:0 0 6px}.bf-form-markdown p:last-child{margin-bottom:0}.bf-form-markdown h1,.bf-form-markdown h2,.bf-form-markdown h3{margin:0 0 8px}.bf-form-markdown ul,.bf-form-markdown ol{margin:0 0 8px;padding-left:22px}.bf-form-markdown code{background:rgba(255,255,255,.08);padding:1px 4px;border-radius:4px}.bf-form-markdown a{color:#9ed0ff;text-decoration:underline}`}</style>
    {!readOnly ? <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}><input className="input" value={form.title} onChange={(e) => setFormProp("title", e.target.value)} placeholder="Form title" style={{ fontSize: 20, fontWeight: 800, padding: "8px 10px" }} /><textarea className="input" value={form.description} onChange={(e) => setFormProp("description", e.target.value)} placeholder="Form description (Markdown supported)" style={{ minHeight: 68, padding: 8, resize: "vertical" }} /></div> : <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12 }}><h2 style={{ marginTop: 0, marginBottom: 8 }}>{form.title}</h2>{form.description ? <MarkdownContent value={form.description} className="bf-form-markdown" /> : null}</div>}
    {!readOnly ? <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><div><div style={{ fontWeight: 800, fontSize: 16 }}>Public response link</div><div className="helper">Anyone with this link can submit without a Bondfire account.</div></div><label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}><input type="checkbox" checked={form.publicShare.enabled} onChange={(e) => togglePublicShare(e.target.checked)} />Enable public submissions</label></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="btn" type="button" onClick={openPublicUrl} disabled={!publicUrl}>Open public form</button><button className="btn" type="button" onClick={copyPublicUrl} disabled={!publicUrl}>Copy public link</button><button className="btn" type="button" onClick={regeneratePublicLink} disabled={!form.publicShare.enabled}>Regenerate link</button><button className="btn" type="button" onClick={openEditorUrl} disabled={!standaloneEditorUrl}>Open editor</button></div><input className="input" readOnly value={publicUrl || "Enable public submissions to generate a public share URL."} style={{ padding: "8px 10px" }} />{copyStatus ? <div className="helper">{copyStatus}</div> : null}</div> : null}
    {readOnly ? <>{form.blocks.map(renderPreviewBlock)}</> : <>{Array.from({ length: form.blocks.length + 1 }, (_unused, index) => <React.Fragment key={`insert-${index}`}><InsertionControl index={index} onInsert={insertBlock} />{index < form.blocks.length ? <>{insertAt === index ? <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", padding: 4 }}><button className="btn" type="button" onClick={() => addBlockAt("question", index)}>Question</button><button className="btn" type="button" onClick={() => addBlockAt("display", index)}>Display text</button><button className="btn" type="button" onClick={() => addBlockAt("page-break", index)}>Page break</button></div> : null}{renderEditorBlock(form.blocks[index], index)}</> : null}</React.Fragment>)}</>}
    {readOnly ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button className="btn" type="button" onClick={submitResponse}>Submit response</button>{responseStatus ? <div className="helper">{responseStatus}</div> : null}</div> : null}
    {form.responses.length ? <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12 }}><div style={{ fontWeight: 700, marginBottom: 10 }}>Responses ({form.responses.length})</div><div style={{ display: "grid", gap: 8 }}>{form.responses.slice().reverse().map((response) => <div key={response.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, background: "rgba(255,255,255,0.02)" }}><div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>{new Date(response.submittedAt).toLocaleString()} · {response.source === "public" ? "public" : "internal"}</div><div style={{ display: "grid", gap: 6 }}>{form.fields.map((field) => <div key={`${response.id}_${field.id}`}><div style={{ fontWeight: 700, marginBottom: 2 }}><MarkdownContent value={field.label} className="bf-form-markdown" /></div><div className="helper" style={{ whiteSpace: "pre-wrap" }}>{answerSummary(field, response.answers[field.id])}</div></div>)}</div></div>)}</div></div> : null}
  </div>;
}
