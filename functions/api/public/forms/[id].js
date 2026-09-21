import { bad, json, now, uuid } from "../../_lib/http.js";
import { ensureDriveSchema, getDb, loadFileBlob, saveFileBlob } from "../../_lib/drive.js";

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(value) {
  let html = htmlEscape(value);
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/gim, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gim, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function renderMarkdown(markdown) {
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
      if (line.startsWith("```")) { html += `<pre><code class="lang-${htmlEscape(codeLanguage)}">${htmlEscape(codeLines.join("\n"))}</code></pre>`; inCode = false; codeLines = []; codeLanguage = ""; }
      else codeLines.push(raw);
      continue;
    }
    if (line.startsWith("```")) { closeList(); inCode = true; codeLanguage = line.slice(3).trim(); continue; }
    if (!line) { closeList(); continue; }
    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) { closeList(); html += "<hr />"; continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { closeList(); const level = heading[1].length; html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`; continue; }
    if (line.startsWith(">")) { closeList(); html += `<blockquote><p>${inlineMarkdown(line.replace(/^>\s?/, ""))}</p></blockquote>`; continue; }
    const task = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (task || bullet || ordered) {
      const nextTag = ordered ? "ol" : "ul";
      if (listTag !== nextTag) { closeList(); html += `<${nextTag}>`; listTag = nextTag; }
      if (task) html += `<li>${inlineMarkdown(task[2])}</li>`;
      else html += `<li>${inlineMarkdown(bullet ? bullet[1] : ordered[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  closeList();
  if (inCode) html += `<pre><code>${htmlEscape(codeLines.join("\n"))}</code></pre>`;
  return html;
}

function normalizeConditions(value) {
  return Array.isArray(value) ? value.map((condition) => ({
    sourceId: String(condition?.sourceId || ""),
    operator: ["equals", "not_equals", "contains", "not_empty"].includes(String(condition?.operator || "")) ? String(condition.operator) : "equals",
    value: String(condition?.value || ""),
  })).filter((condition) => condition.sourceId) : [];
}

function conditionMatches(condition, answers) {
  const answer = answers?.[condition.sourceId];
  const values = Array.isArray(answer) ? answer.map((value) => String(value)) : [String(answer ?? "")];
  const hasValue = Array.isArray(answer) ? answer.length > 0 : String(answer ?? "").trim() !== "";
  if (condition.operator === "not_empty") return hasValue;
  if (condition.operator === "equals") return values.includes(String(condition.value || ""));
  if (condition.operator === "not_equals") return !values.includes(String(condition.value || ""));
  if (condition.operator === "contains") return values.some((value) => value.toLowerCase().includes(String(condition.value || "").toLowerCase()));
  return false;
}

function isBlockVisible(block, answers) {
  const conditions = normalizeConditions(block?.conditions);
  if (!conditions.length) return true;
  const matched = conditions.map((condition) => conditionMatches(condition, answers));
  return block?.conditionLogic === "any" ? matched.some(Boolean) : matched.every(Boolean);
}
function normalizeQuestion(field, idx)
  const fieldType = ["text", "paragraph", "choice", "checkbox", "date"].includes(String(field?.fieldType || field?.type || ""))
    ? (field?.fieldType || field.type) : "text";
  return {
    id: String(field?.id || `field_${idx + 1}`),
    type: "question",
    fieldType,
    label: String(field?.label || `Question ${idx + 1}`),
    required: !!field?.required,
    options: Array.isArray(field?.options) ? field.options.map((x) => String(x || "")).filter(Boolean) : [],
    conditions: normalizeConditions(field?.conditions),
    conditionLogic: field?.conditionLogic === "any" ? "any" : "all",
  };
}

function normalizeBlock(block, idx) {
  if (block?.type === "display" || block?.type === "text") return { id: String(block.id || `display_${idx + 1}`), type: "display", text: String(block.text ?? block.content ?? "") };
  if (block?.type === "page-break" || block?.type === "pageBreak") return { id: String(block.id || `page_${idx + 1}`), type: "page-break", label: String(block.label || "Page break") };
  return normalizeQuestion(block, idx);
}

function normalizeForm(input) {
  const rawBlocks = Array.isArray(input?.blocks) && input.blocks.length ? input.blocks : (Array.isArray(input?.fields) ? input.fields : []);
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

async function getPublicForm(env, fileId) {
  await ensureDriveSchema(env);
  const db = getDb(env);
  const row = await db.prepare(`SELECT id, org_id, name, mime, storage_key FROM drive_files WHERE id = ?`).bind(fileId).first();
  if (!row) return null;
  const blob = await loadFileBlob(env, row.org_id, row.id, row.storage_key || null, row.mime || "application/octet-stream", row.name || "");
  const parsed = normalizeForm(JSON.parse(String(blob?.textContent || "{}")));
  return { file: row, form: parsed, orgId: row.org_id, storageKey: row.storage_key || null, mime: row.mime || "application/octet-stream" };
}

function verifyToken(record, token) {
  return !!record?.form?.publicShare?.enabled && !!record?.form?.publicShare?.token && String(token || "") === String(record.form.publicShare.token || "");
}

function renderField(field) {
  const fieldType = field.fieldType || field.type;
  const req = field.required ? "required" : "";
  if (fieldType === "paragraph") return `<textarea name="${htmlEscape(field.id)}" ${req} style="width:100%;min-height:110px;padding:12px;border-radius:10px;border:1px solid #2a2a2a;background:#101012;color:#fff;"></textarea>`;
  if (fieldType === "choice") return `<div style="display:grid;gap:8px;">${field.options.map((option) => `<label style="display:flex;gap:8px;align-items:center;"><input type="radio" name="${htmlEscape(field.id)}" value="${htmlEscape(option)}" ${req} /><span>${inlineMarkdown(option)}</span></label>`).join("")}</div>`;
  if (fieldType === "checkbox") return `<div style="display:grid;gap:8px;">${field.options.map((option) => `<label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" name="${htmlEscape(field.id)}" value="${htmlEscape(option)}" /><span>${inlineMarkdown(option)}</span></label>`).join("")}</div>`;
  if (fieldType === "date") return `<input type="date" name="${htmlEscape(field.id)}" ${req} style="width:100%;padding:12px;border-radius:10px;border:1px solid #2a2a2a;background:#101012;color:#fff;" />`;
  return `<input type="text" name="${htmlEscape(field.id)}" ${req} style="width:100%;padding:12px;border-radius:10px;border:1px solid #2a2a2a;background:#101012;color:#fff;" />`;
}

function renderQuestion(block, number) {
  const field = normalizeQuestion(block, number - 1);
  return `<div class="card" data-block-id="${htmlEscape(field.id)}"><div style="font-weight:800;">${number}. <span class="bf-markdown">${renderMarkdown(field.label)}</span> ${field.required ? '<span style="color:#ff9a9a">*</span>' : ""}</div>${renderField(field)}</div>`;
}

function renderPages(form) {
  const pages = [[]];
  let questionNumber = 0;
  for (const block of form.blocks) {
    if (block.type === "page-break") { if (pages[pages.length - 1].length) pages.push([]); continue; }
    if (block.type === "question") { questionNumber += 1; pages[pages.length - 1].push(renderQuestion(block, questionNumber)); }
    else if (block.type === "display") pages[pages.length - 1].push(`<div class="display bf-markdown" data-block-id="${htmlEscape(block.id)}">${renderMarkdown(block.text)}</div>`);
  }
  while (pages.length > 1 && !pages[pages.length - 1].length) pages.pop();
  return pages.map((page, index) => `<section class="bf-page" data-page="${index}"${index ? ' hidden' : ''}>${page.join("")}</section>`).join("");
}

function renderPage(fileId, form, token) {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${htmlEscape(form.title)}</title><style>
body{margin:0;font-family:Inter,system-ui,sans-serif;background:#090909;color:#fff;padding:24px}.shell{max-width:760px;margin:0 auto;background:#0f0f10;border:1px solid #222;border-radius:18px;padding:24px;box-shadow:0 18px 50px rgba(0,0,0,.38)}.card,.display{display:grid;gap:10px;padding:18px;border:1px solid #242424;border-radius:14px;background:#131315;margin-top:14px}.display{display:block}.small{font-size:13px;color:#a8a8ad}.success{color:#9be7ac}.error{color:#ff9a9a}button{padding:12px 18px;border-radius:12px;border:1px solid #333;background:#17181c;color:#fff;font-weight:700;cursor:pointer}.bf-markdown{line-height:1.5}.bf-markdown p{margin:0 0 8px}.bf-markdown p:last-child{margin-bottom:0}.bf-markdown h1,.bf-markdown h2,.bf-markdown h3{margin:0 0 8px}.bf-markdown ul,.bf-markdown ol{margin:0 0 8px;padding-left:22px}.bf-markdown code{background:#25252a;padding:1px 4px;border-radius:4px}.bf-markdown a{color:#9ed0ff}.page-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:14px}
</style></head><body><div class="shell"><h1 style="margin:0 0 8px 0;">${htmlEscape(form.title)}</h1>${form.description ? `<div class="small bf-markdown" style="margin-bottom:8px;">${renderMarkdown(form.description)}</div>` : ""}<form id="bf-public-form" style="display:grid;gap:0;">${renderPages(form)}<div class="page-actions"><button type="button" id="back" hidden>Back</button><button type="button" id="next">Next</button><button type="submit" id="submit" hidden>Submit response</button><div id="status" class="small"></div></div></form></div><script>
const formEl=document.getElementById('bf-public-form'),statusEl=document.getElementById('status'),pages=[...document.querySelectorAll('.bf-page')],back=document.getElementById('back'),next=document.getElementById('next'),submit=document.getElementById('submit'),blocks=${JSON.stringify(form.blocks)};let page=0;function readAnswers(){const fd=new FormData(formEl),answers={};${JSON.stringify(form.fields)}.forEach(field=>{if(field.fieldType==='checkbox')answers[field.id]=fd.getAll(field.id);else answers[field.id]=fd.get(field.id)||''});return answers}function matches(condition,answers){const answer=answers[condition.sourceId],values=Array.isArray(answer)?answer.map(String):[String(answer??'')],has=Array.isArray(answer)?answer.length>0:String(answer??'').trim()!=='';if(condition.operator==='not_empty')return has;if(condition.operator==='equals')return values.includes(String(condition.value||''));if(condition.operator==='not_equals')return !values.includes(String(condition.value||''));if(condition.operator==='contains')return values.some(value=>value.toLowerCase().includes(String(condition.value||'').toLowerCase()));return false}function visible(block,answers){const conditions=Array.isArray(block.conditions)?block.conditions:[];if(!conditions.length)return true;const result=conditions.map(condition=>matches(condition,answers));return block.conditionLogic==='any'?result.some(Boolean):result.every(Boolean)}function updateConditions(){const answers=readAnswers();document.querySelectorAll('[data-block-id]').forEach(element=>{const block=blocks.find(item=>item.id===element.dataset.blockId);if(block)element.hidden=!visible(block,answers)})}function showPage(n){page=Math.max(0,Math.min(n,pages.length-1));pages.forEach((item,i)=>{item.hidden=i!==page});back.hidden=page===0;next.hidden=page===pages.length-1;submit.hidden=page!==pages.length-1;updateConditions()}showPage(0);next.addEventListener('click',()=>showPage(page+1));back.addEventListener('click',()=>showPage(page-1));formEl.addEventListener('input',updateConditions);formEl.addEventListener('change',updateConditions);formEl.addEventListener('submit',async(event)=>{event.preventDefault();statusEl.textContent='Submitting…';statusEl.className='small';const fd=new FormData(formEl),answers={};${JSON.stringify(form.fields)}.forEach(field=>{if(field.fieldType==='checkbox')answers[field.id]=fd.getAll(field.id);else answers[field.id]=fd.get(field.id)||''});try{const res=await fetch(window.location.pathname+window.location.search,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:${JSON.stringify(token)},answers})});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'SUBMIT_FAILED');formEl.reset();updateConditions();statusEl.textContent='Response submitted.';statusEl.className='small success'}catch(err){statusEl.textContent=err.message||'Submit failed';statusEl.className='small error'}});
</script></body></html>`;
}

export async function onRequestGet({ env, request, params }) {
  const fileId = params.id;
  const token = new URL(request.url).searchParams.get("token") || "";
  const record = await getPublicForm(env, fileId);
  if (!record) return bad(404, "NOT_FOUND");
  if (!verifyToken(record, token)) return bad(403, "FORBIDDEN");
  const wantsJson = new URL(request.url).searchParams.get("format") === "json" || String(request.headers.get("accept") || "").includes("application/json");
  if (wantsJson) return json({ ok: true, form: { title: record.form.title, description: record.form.description, blocks: record.form.blocks, fields: record.form.fields } });
  return new Response(renderPage(fileId, record.form, token), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, max-age=0, no-store" } });
}

export async function onRequestPost({ env, request, params }) {
  const fileId = params.id;
  const record = await getPublicForm(env, fileId);
  if (!record) return bad(404, "NOT_FOUND");
  const body = await request.json().catch(() => ({}));
  if (!verifyToken(record, body?.token || "")) return bad(403, "FORBIDDEN");
  const answers = body && typeof body.answers === "object" && !Array.isArray(body.answers) ? body.answers : {};
  const visibleFields = record.form.fields.filter((field) => isBlockVisible(field, answers));
  const missing = visibleFields.find((field) => { if (!field.required) return false; const value = answers[field.id]; if (field.fieldType === "checkbox") return !Array.isArray(value) || !value.length; return !String(value || "").trim(); });
  if (missing) return bad(400, "REQUIRED_FIELD_MISSING", { fieldId: missing.id, label: missing.label });
  const response = { id: uuid(), submittedAt: now(), source: "public", answers: visibleFields.reduce((acc, field) => { const value = answers[field.id]; acc[field.id] = field.fieldType === "checkbox" ? (Array.isArray(value) ? value.map((x) => String(x || "")) : []) : String(value || ""); return acc; }, {}) };
  const nextForm = { ...record.form, responses: [...record.form.responses, response] };
  const textContent = JSON.stringify(nextForm, null, 2);
  await saveFileBlob(env, { orgId: record.orgId, fileId, storageKey: record.storageKey, mime: record.mime, textContent, dataUrl: `data:${record.mime || "application/json"};base64,${btoa(unescape(encodeURIComponent(textContent)))}` });
  await getDb(env).prepare(`UPDATE drive_files SET updated_at = ? WHERE id = ?`).bind(now(), fileId).run();
  return json({ ok: true, submitted: true, responseId: response.id });
}
