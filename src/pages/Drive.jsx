import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../utils/api.js";
import DriveSidebar from "../components/drive/DriveSidebar.jsx";
import NoteEditor from "../components/drive/NoteEditor.jsx";
import NotePreview from "../components/drive/NotePreview.jsx";
import DriveFilePreview from "../components/drive/DriveFilePreview.jsx";
import Breadcrumbs from "../components/drive/Breadcrumbs.jsx";
import NoteInspector from "../components/drive/NoteInspector.jsx";
import RichTextToolbar from "../components/drive/RichTextToolbar.jsx";
import DriveCreateModal from "../components/drive/DriveCreateModal.jsx";
import SpreadsheetFileView from "../components/drive/SpreadsheetFileView.jsx";
import FormFileView from "../components/drive/FormFileView.jsx";
import { renderTemplate } from "../components/drive/templateEngine.js";
import { normalizeBulletinFields, buildBulletinPayload } from "../components/BulletinUtils";

const LEGACY_STORAGE_KEY = "bf_drive_v14";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

async function mapWithConcurrency(items, worker, limit = 6) {
  const values = Array.from(items || []);
  const results = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }
  const workerCount = Math.min(Math.max(1, Number(limit) || 1), values.length);
  await Promise.all(Array.from({ length: workerCount }, () => run()));
  return results;
}

function parseTags(body) {
  const matches = [...String(body || "").matchAll(/(^|\s)#([a-zA-Z0-9/_-]+)/gim)];
  return [...new Set(matches.map((m) => String(m[2] || "").trim().toLowerCase()).filter(Boolean))];
}
function parseWikiLinks(body) {
  const matches = [...String(body || "").matchAll(/\[\[(.*?)(\|(.*?))?\]\]/gim)];
  return matches.map((m) => String(m[1] || "").trim()).filter(Boolean);
}
function parseFrontmatter(text) {
  const raw = String(text || "");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { properties: [], body: raw, hasFrontmatter: false };
  const properties = match[1]
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return null;
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((x) => x && x.key);
  return { properties, body: raw.slice(match[0].length), hasFrontmatter: true };
}
function serializeFrontmatter(properties, body) {
  const entries = (properties || []).filter((p) => String(p?.key || "").trim() !== "");
  if (!entries.length) return String(body || "");
  const lines = entries.map((p) => `${String(p.key).trim()}: ${String(p.value || "").trim()}`);
  return `---\n${lines.join("\n")}\n---\n\n${String(body || "")}`;
}
function slugifyText(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "untitled";
}
function getFileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}
function isMarkdownFile(file) {
  const ext = getFileExtension(file?.name);
  return file?.mime === "text/markdown" || ext === "md" || ext === "markdown";
}
function isEditableTextFile(file) {
  const ext = getFileExtension(file?.name);
  const mime = String(file?.mime || "");
  if (mime === "application/vnd.bondfire.sheet+json") return true;
  if (mime === "application/vnd.bondfire.form+json") return true;
  return mime.startsWith("text/") || ["md", "markdown", "txt", "json", "js", "jsx", "ts", "tsx", "css", "html", "yml", "yaml", "xml", "csv", "bfsheet", "bfform"].includes(ext);
}
function canPreviewFileInApp(file) {
  const mime = String(file?.mime || "");
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  if (mime.startsWith("audio/")) return true;
  if (mime.startsWith("video/")) return true;
  if (mime === "application/vnd.bondfire.sheet+json") return true;
  if (mime === "application/vnd.bondfire.form+json") return true;
  if (isEditableTextFile(file)) return true;
  return false;
}
function textToDataUrl(text, mime = "text/plain;charset=utf-8") {
  const safeMime = String(mime || "text/plain;charset=utf-8");
  return `data:${safeMime};base64,${btoa(unescape(encodeURIComponent(String(text || ""))))}`;
}
function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(String(text || "")); } catch { return fallback; }
}
function isBondfireSheetFile(file, rawContent = "") {
  const mime = String(file?.mime || "");
  if (mime === "application/vnd.bondfire.sheet+json") return true;
  const ext = getFileExtension(file?.name);
  if (ext === "bfsheet") return true;
  const parsed = safeJsonParse(rawContent, null);
  return parsed?.type === "bondfire-sheet";
}
function isBondfireFormFile(file, rawContent = "") {
  const mime = String(file?.mime || "");
  if (mime === "application/vnd.bondfire.form+json") return true;
  const ext = getFileExtension(file?.name);
  if (ext === "bfform") return true;
  const parsed = safeJsonParse(rawContent, null);
  return parsed?.type === "bondfire-form";
}
function buildStarterSheet() {
  return JSON.stringify({
    type: "bondfire-sheet",
    version: 1,
    columns: ["A", "B", "C", "D"],
    rows: [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]],
  }, null, 2);
}
function buildStarterForm() {
  return JSON.stringify({
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
  }, null, 2);
}

function buildDriveFileUrls(orgId, fileId) {
  const encodedOrgId = encodeURIComponent(String(orgId || ""));
  const encodedFileId = encodeURIComponent(String(fileId || ""));
  const base = `/api/orgs/${encodedOrgId}/drive/files/${encodedFileId}/download`;
  return { previewUrl: base, downloadUrl: `${base}?download=1`, url: base };
}
function withFileUrls(orgId, file) {
  if (!file?.id) return file;
  return { ...file, ...buildDriveFileUrls(orgId, file.id) };
}

const STARTER_TEMPLATES = [
  {
    id: "tpl_daily_note",
    name: "daily note",
    title: '<% tp.date.now("YYYY-MM-DD") %>',
    body: `---
type: daily-note
date: <% tp.date.now("YYYY-MM-DD") %>
weekday: <% tp.date.now("dddd") %>
tags: daily
---

# <% tp.file.title %>

## schedule

- [ ] 

## notes

<% tp.date.now("HH:mm") %> — 

## wins

- [ ] 

## tomorrow

- [ ] 
`,
  },
  {
    id: "tpl_timestamp",
    name: "timestamp block",
    title: "timestamp",
    body: `<% tp.date.now("HH:mm") %> — `,
  },
  {
    id: "tpl_weekly_checkin",
    name: "weekly check-in",
    title: '<% tp.date.now("YYYY-[W]WW") %> weekly check-in',
    body: `---
type: weekly-checkin
date: <% tp.date.now("YYYY-MM-DD") %>
tags: weekly, checkin
---

# weekly relationship accountability check-in

## what i did well this week

- [ ] 

## where i fell short

- [ ] 

## one concrete change for next week

- [ ] 

## evidence i am becoming safer, not just apologetic

- [ ] 
`,
  },
];

export default function Drive() {
  const { orgId = "" } = useParams();
  const uiStorageKey = `bf_drive_ui_v14_${orgId}`;
  const importMarkerKey = `bf_drive_imported_${orgId}`;

  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKind, setSelectedKind] = useState("note");
  const [title, setTitle] = useState("untitled");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("saved");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("split");
  const [focusMode, setFocusMode] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(296);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 900 : false));
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const saveTimer = useRef(null);
  const skipNextSave = useRef(false);
  const resizeMode = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const objectUrlRegistry = useRef(new Set());

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(uiStorageKey) || "{}");
      setSidebarWidth(Number.isFinite(raw.sidebarWidth) ? clamp(raw.sidebarWidth, 220, 380) : 296);
      setSplitRatio(Number.isFinite(raw.splitRatio) ? clamp(raw.splitRatio, 0.3, 0.7) : 0.5);
      setViewMode(["edit", "read", "split"].includes(raw.viewMode) ? raw.viewMode : "split");
      setInspectorOpen(!!raw.inspectorOpen);
      setPropertiesCollapsed(!!raw.propertiesCollapsed);
    } catch {}
  }, [uiStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(uiStorageKey, JSON.stringify({ sidebarWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed }));
    } catch {}
  }, [uiStorageKey, sidebarWidth, splitRatio, viewMode, inspectorOpen, propertiesCollapsed]);

  async function loadDrive({ preserveSelection = true } = {}) {
    if (!orgId) return;
    setLoadState("loading");
    setLoadError("");
    setActionError("");
    try {
      let data = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive`);
      const empty = !data?.folders?.length && !data?.notes?.length && !data?.files?.length && !data?.templates?.length;
      if (empty) {
        try {
          const alreadyImported = localStorage.getItem(importMarkerKey) === "1";
          const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
          const hasLegacy = Array.isArray(legacy?.folders) && legacy.folders.length || Array.isArray(legacy?.notes) && legacy.notes.length || Array.isArray(legacy?.files) && legacy.files.length || Array.isArray(legacy?.templates) && legacy.templates.length;
          if (!alreadyImported && hasLegacy) {
            await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/import`, {
              method: "PATCH",
              body: JSON.stringify({
                folders: legacy.folders || [],
                notes: legacy.notes || [],
                files: legacy.files || [],
                templates: legacy.templates || STARTER_TEMPLATES,
              }),
            });
            localStorage.setItem(importMarkerKey, "1");
            data = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive`);
          }
        } catch {}
      }
      const nextFolders = Array.isArray(data?.folders) ? data.folders : [];
      const nextNotes = Array.isArray(data?.notes) ? data.notes : [];
      const nextFiles = (Array.isArray(data?.files) ? data.files : []).map((file) => withFileUrls(orgId, file));
      const nextTemplates = Array.isArray(data?.templates) && data.templates.length ? data.templates : STARTER_TEMPLATES;
      setFolders(nextFolders);
      setNotes(Array.isArray(nextNotes) ? nextNotes.map(normalizeBulletinFields) : nextNotes);
      setFiles(Array.isArray(nextFiles) ? nextFiles.map(normalizeBulletinFields) : nextFiles);
      setTemplates(nextTemplates);
      if (preserveSelection && selectedId) {
        if (selectedKind === "note") {
          const note = nextNotes.find((n) => n.id === selectedId);
          if (note) {
            skipNextSave.current = true;
            setTitle(note.title || "untitled");
            setContent(note.body || "");
          } else {
            setSelectedId(null);
            setTitle("untitled");
            setContent("");
          }
        }
        if (selectedKind === "file") {
          const file = nextFiles.find((f) => f.id === selectedId);
          if (!file) {
            setSelectedId(null);
            setTitle("untitled");
            setContent("");
          }
        }
      }
      setLoadState("ready");
    } catch (e) {
      setLoadError(String(e?.message || e || "Failed to load Drive"));
      setLoadState("error");
    }
  }

  useEffect(() => {
    loadDrive({ preserveSelection: false });
  }, [orgId]);

  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (folderInput) {
      folderInput.setAttribute("webkitdirectory", "true");
      folderInput.setAttribute("directory", "true");
    }
    return () => {
      objectUrlRegistry.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch {}
      });
      objectUrlRegistry.current.clear();
    };
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!resizeMode.current) return;
      if (resizeMode.current === "sidebar") setSidebarWidth(clamp(e.clientX, 220, 380));
      if (resizeMode.current === "split") {
        const main = document.getElementById("bf-drive-editor-zone");
        if (!main) return;
        const rect = main.getBoundingClientRect();
        setSplitRatio(clamp((e.clientX - rect.left) / rect.width, 0.3, 0.7));
      }
    };
    const onUp = () => {
      resizeMode.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") { e.preventDefault(); createNote(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "1") { e.preventDefault(); setViewMode("edit"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "2") { e.preventDefault(); setViewMode("read"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "3") { e.preventDefault(); setViewMode("split"); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); setInspectorOpen((v) => !v); }
      if (e.key === "Escape") {
        if (focusMode) setFocusMode(false);
        setInspectorOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, selectedId, selectedKind, title, content]);

  const selectedNote = selectedKind === "note" ? notes.find((n) => n.id === selectedId) || null : null;
  const selectedFile = selectedKind === "file" ? files.find((f) => f.id === selectedId) || null : null;
  const selectedFileSubtype = selectedKind === "file" && selectedFile ? (isBondfireSheetFile(selectedFile, content) ? "sheet" : isBondfireFormFile(selectedFile, content) ? "form" : null) : null;
  const fileIsEditable = isEditableTextFile(selectedFile);
  const fileIsMarkdown = isMarkdownFile(selectedFile);
  const isStructuredDriveDoc = selectedFileSubtype === "sheet" || selectedFileSubtype === "form";

  const noteMap = useMemo(() => {
    const map = new Map();
    notes.forEach((note) => map.set(String(note.title || "").trim().toLowerCase(), note.id));
    return map;
  }, [notes]);

  const backlinks = selectedNote ? notes.filter((note) => note.id !== selectedNote.id && parseWikiLinks(note.body).some((link) => link.toLowerCase() === String(selectedNote.title || "").toLowerCase())) : [];

  const explodedFolderCandidates = useMemo(() => folders
    .map((folder) => {
      const directFiles = files.filter((file) => (file.parentId || null) === folder.id);
      const directNotes = notes.filter((note) => (note.parentId || null) === folder.id);
      const childFolders = folders.filter((child) => (child.parentId || null) === folder.id);
      const file = directFiles.length === 1 ? directFiles[0] : null;
      const folderTime = Number(folder.createdAt || 0);
      const fileTime = Number(file?.createdAt || 0);
      const recentTogether = !folderTime || !fileTime || Math.abs(folderTime - fileTime) <= 15 * 60 * 1000;
      return directFiles.length === 1 && directNotes.length === 0 && childFolders.length === 0 && recentTogether
        ? { folder, file }
        : null;
    })
    .filter(Boolean),
  [folders, files, notes]);

  async function updateSelectedNoteBulletin(extra = {}) {
    if (!selectedNote?.id) return;
    try {
      const payload = { ...extra };
      if (selectedId === selectedNote.id && selectedKind === "note") {
        payload.title = title;
        payload.body = content;
      }
      const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(selectedNote.id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (res?.note) {
        setNotes((prev) => prev.map((n) => (n.id === res.note.id ? res.note : n)));
        skipNextSave.current = true;
        setTitle(res.note.title || "untitled");
        setContent(res.note.body || "");
        setStatus("saved");
      }
    } catch (e) {
      console.error("Failed to update bulletin metadata for note", e);
      setStatus("error");
    }
  }

  async function saveBulletinDraft() {
    if (!selectedNote) return;
    const defaultSlug = selectedNote?.bulletinSlug || slugifyText(title || selectedNote.title || "untitled");
    const slug = window.prompt("Bulletin slug", defaultSlug);
    if (!slug) return;
    const excerpt = window.prompt("Bulletin excerpt", selectedNote?.bulletinExcerpt || "");
    await updateSelectedNoteBulletin({
      bulletinSlug: slugifyText(slug),
      bulletinExcerpt: String(excerpt || ""),
      bulletinStatus: "draft",
    });
  }

  async function publishSelectedNote() {
    if (!selectedNote?.id) return;
    const defaultSlug = selectedNote?.bulletinSlug || slugifyText(title || selectedNote.title || "untitled");
    const slug = window.prompt("Public slug", defaultSlug);
    if (!slug) return;
    const excerpt = window.prompt("Public excerpt", selectedNote?.bulletinExcerpt || "");
    const cleanSlug = slugifyText(slug);
    const cleanExcerpt = String(excerpt || "");
    const publishTitle = title || selectedNote.title || "untitled";

    await updateSelectedNoteBulletin({
      bulletinSlug: cleanSlug,
      bulletinExcerpt: cleanExcerpt,
      bulletinStatus: "published",
    });

    try {
      const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/posts/${encodeURIComponent(selectedNote.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          slug: cleanSlug,
          titleOverride: publishTitle,
          excerpt: cleanExcerpt,
          status: "published",
        }),
      });
      if (!res?.ok && !res?.post) {
        throw new Error(res?.error || "Failed to publish bulletin post");
      }

      setNotes((prev) => prev.map((n) => (
        n.id === selectedNote.id
          ? {
              ...n,
              bulletinSlug: cleanSlug,
              bulletinExcerpt: cleanExcerpt,
              bulletinStatus: "published",
              bulletinPublishedAt: res?.post?.publishedAt || n?.bulletinPublishedAt || Date.now(),
            }
          : n
      )));
    } catch (e) {
      console.error("Failed to publish public bulletin post", e);
      window.alert(`Drive note updated, but public bulletin publish failed: ${String(e?.message || e)}`);
    }
  }


  async function unpublishSelectedNote() {
    if (!selectedNote?.id) return;
    const ok = window.confirm(`Remove "${selectedNote.title || "this note"}" from the public bulletin?`);
    if (!ok) return;

    await updateSelectedNoteBulletin({
      bulletinStatus: "",
    });

    try {
      const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/posts/${encodeURIComponent(selectedNote.id)}`, {
        method: "DELETE",
      });
      if (!res?.ok && !res?.deleted) {
        throw new Error(res?.error || "Failed to remove bulletin post");
      }

      setNotes((prev) => prev.map((n) => (
        n.id === selectedNote.id
          ? {
              ...n,
              bulletinStatus: "",
              bulletinPublishedAt: "",
            }
          : n
      )));
    } catch (e) {
      console.error("Failed to remove public bulletin post", e);
      window.alert(`Drive note metadata cleared, but public bulletin removal failed: ${String(e?.message || e)}`);
    }
  }

  function openPublicBulletinPage() {
    if (!selectedNote?.bulletinSlug) return;
    window.open(`${window.location.origin}/bulletin/${encodeURIComponent(selectedNote.bulletinSlug)}`, "_blank", "noopener,noreferrer");
  }

  function beginResize(which) {
    resizeMode.current = which;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  async function createFolder() {
    const name = prompt("Folder name?");
    if (!name) return;
    setActionError("");
    try {
      const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders`, {
        method: "POST",
        body: JSON.stringify({ name: String(name).trim(), parentId: currentFolder }),
      });
      const folder = res?.folder;
      if (!folder) throw new Error("FOLDER_CREATE_FAILED");
      setFolders((prev) => [...prev, folder]);
      setCurrentFolder(folder.id);
    } catch (error) {
      console.error("Drive folder creation failed", error);
      setActionError(`Could not create folder: ${String(error?.message || error)}`);
    }
  }
  async function renameFolder(id) {
    const folder = folders.find((f) => f.id === id);
    const name = prompt("Rename folder", folder?.name || "");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: String(name).trim() }),
    });
    if (!res?.folder) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? res.folder : f)));
  }
  async function deleteFolder(id) {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;

    const confirmed = window.confirm(
      `Delete "${folder.name || "this folder"}" and everything inside it? This permanently removes its files, notes, and subfolders.`
    );
    if (!confirmed) return;

    setActionError("");
    const key = (value) => (value == null ? "" : String(value));
    const localFolderIds = new Set([key(id)]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach((candidate) => {
        if (!localFolderIds.has(key(candidate.id)) && localFolderIds.has(key(candidate.parentId))) {
          localFolderIds.add(key(candidate.id));
          changed = true;
        }
      });
    }

    try {
      const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/folders/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res?.deleted) throw new Error(res?.error || "FOLDER_DELETE_FAILED");

      const deletedFolderIds = new Set(
        (Array.isArray(res.deletedFolderIds) && res.deletedFolderIds.length ? res.deletedFolderIds : [...localFolderIds]).map(key)
      );
      const selectedItemWasDeleted = (
        (selectedKind === "note" && notes.some((note) => note.id === selectedId && deletedFolderIds.has(key(note.parentId)))) ||
        (selectedKind === "file" && files.some((file) => file.id === selectedId && deletedFolderIds.has(key(file.parentId))))
      );

      setFolders((prev) => prev.filter((candidate) => !deletedFolderIds.has(key(candidate.id))));
      setNotes((prev) => prev.filter((note) => !deletedFolderIds.has(key(note.parentId))));
      setFiles((prev) => prev.filter((file) => !deletedFolderIds.has(key(file.parentId))));

      if (currentFolder && deletedFolderIds.has(key(currentFolder))) {
        setCurrentFolder(folder.parentId || null);
      }
      if (selectedItemWasDeleted) {
        setSelectedId(null);
        setSelectedKind("note");
        setTitle("untitled");
        setContent("");
        setStatus("saved");
      }
    } catch (error) {
      console.error("Drive folder deletion failed", error);
      setActionError(`Could not delete folder: ${String(error?.message || error)}`);
    }
  }

  async function createNoteWithPayload(payload) {
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const note = res?.note;
    if (!note) return null;
    skipNextSave.current = true;
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
    setSelectedKind("note");
    setTitle(note.title || "untitled");
    setContent(note.body || "");
    setStatus("saved");
    return note;
  }
  async function createNote() {
    await createNoteWithPayload({ title: "untitled", body: "", parentId: currentFolder, tags: [] });
  }
  async function createFileWithPayload(payload) {
    const mime = String(payload?.mime || "text/plain;charset=utf-8");
    const textContent = String(payload?.textContent || "");
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, {
      method: "POST",
      body: JSON.stringify({
        name: payload?.name || "untitled.txt",
        parentId: payload?.parentId ?? currentFolder,
        mime,
        size: new Blob([textContent], { type: mime }).size,
        textContent,
        dataUrl: textToDataUrl(textContent, mime),
      }),
    });
    const file = res?.file ? withFileUrls(orgId, res.file) : null;
    if (!file) return null;
    setFiles((prev) => [file, ...prev.filter((existing) => existing.id !== file.id)]);
    skipNextSave.current = true;
    setSelectedId(file.id);
    setSelectedKind("file");
    setTitle(file.name || "untitled");
    setContent(file.textContent || textContent);
    setStatus("saved");
    return file;
  }
  async function createSpreadsheet() {
    await createFileWithPayload({
      name: `${new Date().toISOString().slice(0, 10)} sheet.bfsheet`,
      mime: "application/vnd.bondfire.sheet+json",
      textContent: buildStarterSheet(),
    });
  }
  async function createForm() {
    await createFileWithPayload({
      name: `${new Date().toISOString().slice(0, 10)} form.bfform`,
      mime: "application/vnd.bondfire.form+json",
      textContent: buildStarterForm(),
    });
  }
  async function createNoteFromTemplate(template) {
    const renderedTitle = renderTemplate(template.title || template.name || "untitled", {});
    const renderedBody = renderTemplate(template.body || "", { title: renderedTitle });
    await createNoteWithPayload({ title: renderedTitle, body: renderedBody, parentId: currentFolder, tags: [] });
  }
  function selectNote(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    skipNextSave.current = true;
    setSelectedId(id);
    setSelectedKind("note");
    setTitle(note.title || "untitled");
    setContent(note.body || "");
    setStatus("saved");
  }
  async function renameNote(id) {
    const note = notes.find((n) => n.id === id);
    const name = prompt("Rename note", note?.title || "");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ title: String(name).trim() }),
    });
    if (!res?.note) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? res.note : n)));
    if (selectedId === id && selectedKind === "note") {
      skipNextSave.current = true;
      setTitle(res.note.title || "untitled");
      setContent(res.note.body || "");
      setStatus("saved");
    }
  }
  async function deleteNote(id) {
    await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id && selectedKind === "note") {
      setSelectedId(null);
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
  }
  async function moveNote(id) {
    const target = prompt("Move to folderId (blank for root)", currentFolder || "");
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ parentId: target || null }),
    });
    if (!res?.note) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? res.note : n)));
  }

  async function renameFile(id) {
    const file = files.find((f) => f.id === id);
    const name = prompt("Rename file", file?.name || "");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: String(name).trim() }),
    });
    if (!res?.file) return;
    setFiles((prev) => prev.map((f) => (f.id === id ? withFileUrls(orgId, { ...f, ...res.file }) : f)));
    if (selectedId === id && selectedKind === "file") {
      skipNextSave.current = true;
      setTitle(res.file.name || "untitled");
      setContent(res.file.textContent || content);
      setStatus("saved");
    }
  }
  async function deleteFile(id) {
    await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id && selectedKind === "file") {
      setSelectedId(null);
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
  }

  async function deleteFiles(ids) {
    const uniqueIds = [...new Set((ids || []).map((id) => String(id)))];
    const targets = files.filter((file) => uniqueIds.includes(String(file.id)));
    if (!targets.length) return false;
    const confirmed = window.confirm(`Delete ${targets.length} selected file${targets.length === 1 ? "" : "s"} permanently?`);
    if (!confirmed) return false;

    setActionError("");
    const deletedIds = [];
    const failures = [];
    await mapWithConcurrency(uniqueIds, async (id) => {
      try {
        const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res?.deleted) throw new Error(res?.error || "FILE_DELETE_FAILED");
        deletedIds.push(id);
      } catch (error) {
        console.error("Drive batch file deletion failed", error);
        failures.push(`${id}: ${String(error?.message || error)}`);
      }
      return null;
    }, 4);
    const deletedSet = new Set(deletedIds);
    setFiles((prev) => prev.filter((file) => !deletedSet.has(String(file.id))));
    if (selectedKind === "file" && deletedSet.has(String(selectedId))) {
      setSelectedId(null);
      setSelectedKind("note");
      setTitle("untitled");
      setContent("");
      setStatus("saved");
    }
    if (failures.length) {
      setActionError(`Deleted ${deletedIds.length} file${deletedIds.length === 1 ? "" : "s"}; ${failures.length} failed: ${failures.join(" · ")}`);
      return false;
    }
    return true;
  }

  async function moveFileToFolder(id, parentId) {
    const res = await api("/api/orgs/" + encodeURIComponent(orgId) + "/drive/files/" + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify({ parentId: parentId || null }),
    });
    if (!res?.file) return null;
    const nextFile = withFileUrls(orgId, { ...files.find((file) => file.id === id), ...res.file });
    setFiles((prev) => prev.map((f) => (f.id === id ? nextFile : f)));
    return nextFile;
  }

  async function moveFile(id) {
    const target = prompt("Move to folderId (blank for root)", currentFolder || "");
    if (target === null) return false;
    return !!(await moveFileToFolder(id, target.trim() || null));
  }

  async function moveFiles(ids) {
    const uniqueIds = [...new Set((ids || []).map((id) => String(id)))];
    if (!uniqueIds.length) return false;
    const target = prompt("Move selected files to folderId (blank for root)", currentFolder || "");
    if (target === null) return false;
    const parentId = target.trim() || null;
    const moved = new Map();
    const failures = [];
    await mapWithConcurrency(uniqueIds, async (id) => {
      try {
        const nextFile = await moveFileToFolder(id, parentId);
        if (!nextFile) throw new Error("FILE_MOVE_FAILED");
        moved.set(id, nextFile);
      } catch (error) {
        console.error("Drive batch file move failed", error);
        failures.push(`${id}: ${String(error?.message || error)}`);
      }
      return null;
    }, 4);
    if (failures.length) setActionError(`Moved ${moved.size} file${moved.size === 1 ? "" : "s"}; ${failures.length} failed: ${failures.join(" · ")}`);
    return failures.length === 0;
  }

  async function repairExplodedFolders() {
    const candidates = explodedFolderCandidates;
    if (candidates.length < 2) {
      setActionError("No batch of single-file folders was found to repair.");
      return;
    }

    const confirmed = window.confirm(
      "Repair " + candidates.length + " single-file folders? Their files will be moved to each folder's parent location, then only the emptied folders will be removed. The files themselves will be preserved."
    );
    if (!confirmed) return;

    setActionError("");
    const movedFiles = new Map();
    const removedFolderIds = new Set();
    const failures = [];

    for (const candidate of candidates) {
      try {
        const res = await api("/api/orgs/" + encodeURIComponent(orgId) + "/drive/files/" + encodeURIComponent(candidate.file.id), {
          method: "PATCH",
          body: JSON.stringify({ parentId: candidate.folder.parentId || null }),
        });
        if (!res?.file) throw new Error("FILE_MOVE_FAILED");

        const deleted = await api("/api/orgs/" + encodeURIComponent(orgId) + "/drive/folders/" + encodeURIComponent(candidate.folder.id), {
          method: "DELETE",
        });
        if (!deleted?.deleted) throw new Error("EMPTY_FOLDER_DELETE_FAILED");

        movedFiles.set(candidate.file.id, withFileUrls(orgId, {
          ...candidate.file,
          ...res.file,
          parentId: candidate.folder.parentId || null,
        }));
        removedFolderIds.add(candidate.folder.id);
      } catch (error) {
        console.error("Drive exploded-folder repair failed", error);
        failures.push(candidate.folder.name + ": " + String(error?.message || error));
      }
    }

    if (movedFiles.size) {
      setFiles((prev) => prev.map((file) => movedFiles.get(file.id) || file));
      setFolders((prev) => prev.filter((folder) => !removedFolderIds.has(folder.id)));
      if (currentFolder && removedFolderIds.has(currentFolder)) setCurrentFolder(null);
    }

    if (failures.length) {
      setActionError("Repaired " + movedFiles.size + " folder" + (movedFiles.size === 1 ? "" : "s") + "; " + failures.length + " could not be repaired: " + failures.join(" · "));
    } else {
      setActionError("Repaired " + movedFiles.size + " folder" + (movedFiles.size === 1 ? "" : "s") + " and preserved their files.");
    }
  }

  async function hydrateFile(fileId) {
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(fileId)}`);
    const hydrated = res?.file || null;
    if (!hydrated) return null;
    setFiles((prev) => prev.map((f) => (f.id === fileId ? withFileUrls(orgId, { ...f, ...hydrated }) : f)));
    return hydrated;
  }

  function openFileInBrowser(file) {
    const name = String(file?.name || "");
    const mime = String(file?.mime || "");
    const textContent = String(file?.textContent || "");
    if ((/\.bfform$/i.test(name) || mime === "application/vnd.bondfire.form+json") && textContent) {
      try {
        const parsed = JSON.parse(textContent);
        const token = String(parsed?.publicShare?.token || "");
        if (parsed?.publicShare?.enabled && token) {
          window.open(`${window.location.origin}/api/public/forms/${encodeURIComponent(file.id)}?token=${encodeURIComponent(token)}`, "_blank", "noopener,noreferrer");
          return;
        }
        const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8" /><title>${name}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#090909;color:#fff;padding:24px}pre{white-space:pre-wrap;background:#111214;border:1px solid #232427;border-radius:12px;padding:16px}</style></head><body><h1>${name}</h1><pre>${textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
        return;
      } catch {}
    }
    if ((/\.bfsheet$/i.test(name) || mime === "application/vnd.bondfire.sheet+json") && textContent) {
      try {
        const parsed = JSON.parse(textContent);
        const sheet = Array.isArray(parsed?.sheets) && parsed.sheets.length ? parsed.sheets[0] : null;
        const rows = Math.max(25, Number(sheet?.rowCount || 25));
        const cols = Math.max(10, Number(sheet?.columnCount || 10));
        const labels = Array.from({ length: cols }, (_, idx) => {
          let n = idx + 1; let out = ""; while (n > 0) { const rem = (n - 1) % 26; out = String.fromCharCode(65 + rem) + out; n = Math.floor((n - 1) / 26); } return out;
        });
        const cells = sheet?.cells || {};
        const esc = (value) => String(value || "").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const table = `<table><thead><tr><th>#</th>${labels.map((label)=>`<th>${label}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: rows }, (_, r)=>`<tr><th>${r+1}</th>${labels.map((label)=>`<td>${esc(cells[`${label}${r+1}`]?.input || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8" /><title>${name}</title><style>body{font-family:Inter,system-ui,sans-serif;background:#090909;color:#fff;padding:24px}table{border-collapse:collapse;background:#111214}th,td{border:1px solid #26282c;padding:8px 10px;min-width:120px}th{background:#15171b;position:sticky;top:0}</style></head><body><h1>${name}</h1>${table}</body></html>`], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
        return;
      } catch {}
    }
    if (file?.dataUrl) {
      const a = document.createElement("a");
      a.href = file.dataUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }
    window.open(file?.previewUrl || `/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(file.id)}/download`, "_blank", "noopener,noreferrer");
  }
  async function openFile(file) {
    let nextFile = withFileUrls(orgId, file);
    if (!nextFile) return;
    if (isEditableTextFile(nextFile) && !nextFile.textContent && !nextFile.dataUrl) {
      nextFile = await hydrateFile(nextFile.id);
      if (!nextFile) return;
      nextFile = withFileUrls(orgId, nextFile);
    }
    if (canPreviewFileInApp(nextFile)) {
      skipNextSave.current = true;
      setSelectedId(nextFile.id);
      setSelectedKind("file");
      setTitle(nextFile.name || "untitled");
      setContent(nextFile.textContent || "");
      setStatus("saved");
      return;
    }
    openFileInBrowser(nextFile);
  }
  function downloadFile(file) {
    const a = document.createElement("a");
    a.href = file?.downloadUrl || `/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(file.id)}/download?download=1`;
    a.download = file.name || "download";
    a.click();
  }

  function downloadFiles(ids) {
    const targets = (ids || [])
      .map((id) => files.find((file) => String(file.id) === String(id)))
      .filter(Boolean);
    targets.forEach((file, index) => {
      window.setTimeout(() => downloadFile(file), index * 120);
    });
  }

  async function saveNow() {
    if (!selectedId) return;
    try {
      if (selectedKind === "note") {
        const parsed = parseFrontmatter(content);
        const propertyTags = parsed.properties.find((p) => p.key.toLowerCase() === "tags")?.value || "";
        const combinedTags = [...new Set([...parseTags(parsed.body), ...String(propertyTags).split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)])];
        const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/notes/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          body: JSON.stringify({ title, body: content, tags: combinedTags }),
        });
        if (res?.note) {
          setNotes((prev) => prev.map((n) => (n.id === selectedId ? res.note : n)));
        }
        setStatus("saved");
        return;
      }
      if (selectedKind === "file" && fileIsEditable) {
        const mime = selectedFile?.mime || (fileIsMarkdown ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8");
        const dataUrl = textToDataUrl(content, mime);
        const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: title,
            mime,
            size: new Blob([content], { type: mime }).size,
            dataUrl,
            textContent: content,
          }),
        });
        if (res?.file) {
          setFiles((prev) => prev.map((file) => (file.id === selectedId ? withFileUrls(orgId, { ...file, ...res.file }) : file)));
        }
        setStatus("saved");
      }
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    if (selectedKind !== "note" && !(selectedKind === "file" && fileIsEditable)) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveNow(); }, 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedId, selectedKind, title, content, fileIsEditable]);

  async function fileToStoredRecord(file, parentId, relativePath = "") {
    let textContent = "";
    if (isEditableTextFile({ name: file?.name, mime: file?.type })) {
      try { textContent = await file.text(); } catch {}
    }
    return {
      name: file?.name || "file",
      parentId,
      updatedAt: Date.now(),
      size: Number(file?.size || 0),
      mime: file?.type || "application/octet-stream",
      textContent,
      relativePath,
    };
  }

  async function uploadFileRecord(rawFile, parentId, relativePath = "", { deferState = false } = {}) {
    const record = await fileToStoredRecord(rawFile, parentId, relativePath);
    const isPreviewableBinary = canPreviewFileInApp(record) && !isEditableTextFile(record);
    const localPreviewUrl = isPreviewableBinary ? URL.createObjectURL(rawFile) : "";
    if (localPreviewUrl) objectUrlRegistry.current.add(localPreviewUrl);

    const tempId = `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticFile = withFileUrls(orgId, {
      id: tempId,
      ...record,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      previewObjectUrl: localPreviewUrl || undefined,
      isUploading: true,
    });
    if (!deferState) {
      setFiles((prev) => [optimisticFile, ...prev.filter((existing) => existing.id !== tempId)]);
    }

    try {
      const headers = {
        "x-drive-name": record.name || rawFile.name || "file",
        "x-drive-mime": record.mime || rawFile.type || "application/octet-stream",
      };
      if (parentId) headers["x-drive-parent-id"] = String(parentId);
      if (relativePath) headers["x-drive-relative-path"] = String(relativePath);

      let res;
      try {
        res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, {
          method: "POST",
          headers,
          body: rawFile,
        });
      } catch {
        const form = new FormData();
        form.append("file", rawFile, rawFile.name || record.name || "file");
        form.append("name", record.name || rawFile.name || "file");
        form.append("mime", record.mime || rawFile.type || "application/octet-stream");
        if (parentId) form.append("parentId", String(parentId));
        if (relativePath) form.append("relativePath", String(relativePath));
        res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/files`, {
          method: "POST",
          body: form,
        });
      }

      const createdFile = res?.file || (res?.id ? { id: res.id } : null);
      if (!createdFile?.id) throw new Error("UPLOAD_FAILED");

      const nextFile = withFileUrls(orgId, {
        ...record,
        ...createdFile,
        previewObjectUrl: localPreviewUrl || undefined,
      });
      if (!deferState) {
        setFiles((prev) => [nextFile, ...prev.filter((existing) => existing.id !== tempId && existing.id !== nextFile.id)]);
      }
      return nextFile;
    } catch (error) {
      if (!deferState) {
        setFiles((prev) => prev.filter((existing) => existing.id !== tempId));
      }
      if (localPreviewUrl) {
        try { URL.revokeObjectURL(localPreviewUrl); } catch {}
        objectUrlRegistry.current.delete(localPreviewUrl);
      }
      throw error;
    }
  }


  async function uploadFilesToFolder(fileList, targetFolder = currentFolder) {
    const chosen = Array.from(fileList || []);
    if (!chosen.length) return;

    setActionError("");
    const results = await mapWithConcurrency(chosen, async (rawFile) => {
      try {
        const file = await uploadFileRecord(rawFile, targetFolder, "", { deferState: true });
        return { file };
      } catch (error) {
        console.error("Drive file upload failed", error);
        return { error, name: rawFile.name || "file" };
      }
    }, 6);

    const createdFiles = results.map((result) => result.file).filter(Boolean);
    if (createdFiles.length) {
      const createdIds = new Set(createdFiles.map((file) => file.id));
      setFiles((prev) => [
        ...createdFiles,
        ...prev.filter((file) => !createdIds.has(file.id)),
      ]);
    }

    const failures = results.filter((result) => result.error);
    if (failures.length) {
      const detail = failures
        .map((result) => result.name + ": " + String(result.error?.message || result.error))
        .join(" · ");
      setActionError("Could not upload " + failures.length + " file" + (failures.length === 1 ? "" : "s") + ": " + detail);
    }
  }

  async function onUploadFiles(event) {
    const input = event.target;
    await uploadFilesToFolder(input.files, currentFolder);
    input.value = "";
  }

  async function ensureFolderChain(segments, context = {}) {
    let parentId = currentFolder;
    const folderByKey = context.folderByKey || new Map();
    const pendingByKey = context.pendingByKey || new Map();
    const createdFolders = context.createdFolders || new Map();

    for (const segment of segments) {
      const key = String(parentId || "") + "\u0000" + String(segment);
      let folder = folderByKey.get(key);

      if (!folder && pendingByKey.has(key)) {
        folder = await pendingByKey.get(key);
      }

      if (!folder) {
        const request = api("/api/orgs/" + encodeURIComponent(orgId) + "/drive/folders", {
          method: "POST",
          body: JSON.stringify({ name: segment, parentId }),
        }).then((res) => {
          const created = res?.folder || null;
          if (!created) throw new Error("FOLDER_CREATE_FAILED");
          folderByKey.set(key, created);
          createdFolders.set(created.id, created);
          return created;
        });
        pendingByKey.set(key, request);
        folder = await request;
      }

      parentId = folder.id;
    }

    return parentId;
  }

  async function onUploadFolder(event) {
    const input = event.target;
    const chosen = Array.from(input.files || []);
    if (!chosen.length) return;

    setActionError("");

    // A directory picker should give every file the same first path segment.
    // Only use that hierarchy when the shared root is unambiguous; otherwise
    // upload the files into the current target without inventing folders.
    const pathEntries = chosen.map((file) => {
      const relative = String(file.webkitRelativePath || "");
      return {
        file,
        relative,
        segments: relative.split("/").filter(Boolean),
      };
    });
    const firstRoot = pathEntries[0]?.segments?.[0] || "";
    const hasSharedRoot = !!firstRoot && pathEntries.every((entry) => (
      entry.segments.length >= 2 && entry.segments[0] === firstRoot
    ));

    const folderContext = {
      folderByKey: new Map(folders.map((folder) => [
        String(folder.parentId || "") + "\u0000" + String(folder.name || ""),
        folder,
      ])),
      pendingByKey: new Map(),
      createdFolders: new Map(),
    };

    const results = await mapWithConcurrency(pathEntries, async (entry) => {
      const file = entry.file;
      const fileSegments = entry.segments.length ? entry.segments : [file.name];
      const rel = entry.relative || String(file.name || "");
      const fileName = fileSegments[fileSegments.length - 1] || file.name;
      const folderSegments = hasSharedRoot ? fileSegments.slice(0, -1) : [];

      try {
        const parentId = folderSegments.length
          ? await ensureFolderChain(folderSegments, folderContext)
          : currentFolder;
        const wrapped = new File([file], fileName, { type: file.type });
        const createdFile = await uploadFileRecord(
          wrapped,
          parentId,
          hasSharedRoot ? rel : "",
          { deferState: true },
        );
        return { file: createdFile, rel };
      } catch (error) {
        console.error("Drive folder upload failed", error);
        return { error, rel };
      }
    }, 6);

    const createdFolders = [...folderContext.createdFolders.values()];
    if (createdFolders.length) {
      setFolders((prev) => [
        ...prev,
        ...createdFolders.filter((folder) => !prev.some((existing) => existing.id === folder.id)),
      ]);
    }

    const createdFiles = results.map((result) => result.file).filter(Boolean);
    if (createdFiles.length) {
      const createdIds = new Set(createdFiles.map((file) => file.id));
      setFiles((prev) => [
        ...createdFiles,
        ...prev.filter((file) => !createdIds.has(file.id)),
      ]);
    }

    const failures = results.filter((result) => result.error);
    if (failures.length) {
      const detail = failures
        .map((result) => result.rel + ": " + String(result.error?.message || result.error))
        .join(" · ");
      setActionError("Could not upload " + failures.length + " folder item" + (failures.length === 1 ? "" : "s") + ": " + detail);
    }

    input.value = "";
  }

  async function onDropFilesOnFolder(fileList, folderId) {
    await uploadFilesToFolder(fileList, folderId);
  }

  async function openLinkedNoteByTitle(rawTitle) {
    const clean = String(rawTitle || "").trim();
    const existingId = noteMap.get(clean.toLowerCase());
    if (existingId) {
      const n = notes.find((x) => x.id === existingId);
      setCurrentFolder(n?.parentId || null);
      selectNote(existingId);
      return;
    }
    if (!window.confirm(`Create note "${clean}"?`)) return;
    await createNoteWithPayload({ title: clean || "untitled", body: "", parentId: currentFolder, tags: [] });
  }

  function wrapSelection(prefix, suffix = prefix) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = content.slice(start, end);
    setContent(content.slice(0, start) + prefix + selected + suffix + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }
  function prefixLines(prefix) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = content.slice(start, end) || "";
    const nextSelected = selected.split("\n").map((line) => `${prefix}${line}`).join("\n");
    setContent(content.slice(0, start) + nextSelected + content.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + nextSelected.length);
    });
  }
  function insertBlock(block) {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    setContent(content.slice(0, start) + block + content.slice(start));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + block.length, start + block.length);
    });
  }
  function insertFrontmatterTemplate() {
    const parsed = parseFrontmatter(content);
    if (parsed.hasFrontmatter) return;
    setContent(serializeFrontmatter([{ key: "type", value: "bit-log" }, { key: "date", value: "" }, { key: "status", value: "" }, { key: "tags", value: "" }], content));
  }
  function updateFrontmatterProperty(key, value) {
    const parsed = parseFrontmatter(content);
    setContent(serializeFrontmatter(parsed.properties.map((p) => (p.key === key ? { ...p, value } : p)), parsed.body));
  }
  function addFrontmatterProperty() {
    const parsed = parseFrontmatter(content);
    const key = prompt("Property name?");
    if (!key) return;
    if (!parsed.hasFrontmatter) {
      setContent(serializeFrontmatter([{ key: String(key).trim(), value: "" }], content));
      return;
    }
    if (parsed.properties.some((p) => p.key === String(key).trim())) return;
    setContent(serializeFrontmatter([...parsed.properties, { key: String(key).trim(), value: "" }], parsed.body));
  }
  function removeFrontmatterProperty(key) {
    const parsed = parseFrontmatter(content);
    setContent(serializeFrontmatter(parsed.properties.filter((p) => p.key !== key), parsed.body));
  }
  async function saveCurrentAsTemplate() {
    if (!content) return;
    const name = prompt("Template name?", title || "Untitled template");
    if (!name) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates`, {
      method: "POST",
      body: JSON.stringify({ name: String(name).trim(), title: title || "untitled", body: content || "" }),
    });
    if (res?.template) {
      setTemplates((prev) => [res.template, ...prev.filter((x) => x.id !== res.template.id)]);
    }
  }
  async function editTemplate(id) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    const nextName = prompt("Template name", tpl.name || "");
    if (nextName === null) return;
    const nextTitle = prompt("Template note title", tpl.title || "");
    if (nextTitle === null) return;
    const nextBody = prompt("Template body", tpl.body || "");
    if (nextBody === null) return;
    const res = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: String(nextName).trim(), title: String(nextTitle), body: String(nextBody) }),
    });
    if (res?.template) setTemplates((prev) => prev.map((x) => (x.id === id ? res.template : x)));
  }
  async function applyTemplate(template) {
    if (!template) return;
    const renderedTitle = renderTemplate(template.title || template.name || "untitled", { title });
    const renderedBody = renderTemplate(template.body || "", { title: renderedTitle });
    if (!selectedId || selectedKind !== "note") {
      await createNoteWithPayload({ title: renderedTitle, body: renderedBody, parentId: currentFolder, tags: [] });
      return;
    }
    const el = editorRef.current;
    const insertion = renderedBody || "";
    if (!el) {
      setContent((prev) => `${prev}${prev ? "\n" : ""}${insertion}`);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    setContent((prev) => prev.slice(0, start) + insertion + prev.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insertion.length, start + insertion.length);
    });
  }
  async function deleteTemplate(id) {
    await api(`/api/orgs/${encodeURIComponent(orgId)}/drive/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  }

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsMobile(!!media.matches);
    sync();
    if (typeof media.addEventListener === "function") media.addEventListener("change", sync);
    else media.addListener(sync);
    return () => {
      if (typeof media.removeEventListener === "function") media.removeEventListener("change", sync);
      else media.removeListener(sync);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileSidebarOpen(false);
  }, [isMobile]);

  const showEditableDocument = selectedKind === "note" || (selectedKind === "file" && fileIsEditable);
  // Structured Drive documents are intentionally single-pane. Their editor and
  // preview are dense enough on their own, especially on smaller screens.
  const effectiveViewMode = isStructuredDriveDoc && viewMode === "split" ? "edit" : viewMode;
  const showEditor = showEditableDocument && effectiveViewMode !== "read";
  const showPreview = showEditableDocument && effectiveViewMode !== "edit";
  const workspaceHeight = focusMode ? "100vh" : "calc(100vh - 86px)";
  const createModalActions = [
    { id: "folder", label: "Folder", hint: "Create a new folder in the current location.", icon: "📁", onClick: createFolder },
    { id: "upload-file", label: "Upload files", hint: "Import one or more existing files.", icon: "⤴", onClick: () => { if (fileInputRef.current) fileInputRef.current.value = ""; fileInputRef.current?.click(); } },
    { id: "upload-folder", label: "Upload folder", hint: "Import a whole folder tree.", icon: "🗂", onClick: () => { const input = folderInputRef.current; if (input) { input.value = ""; input.setAttribute("webkitdirectory", "true"); input.setAttribute("directory", "true"); } input?.click(); } },
    { id: "note", label: "Rich note", hint: "Markdown note with templates and backlinks.", icon: "📝", onClick: createNote },
    { id: "sheet", label: "Sheet", hint: "Simple grid document stored directly in Drive.", icon: "📊", onClick: createSpreadsheet },
    { id: "form", label: "Form", hint: "Build an intake form with a live preview.", icon: "☑", onClick: createForm },
  ];

  const driveGridStyle = isMobile ? { display: "block", height: "100%" } : { display: "grid", gridTemplateColumns: `${sidebarWidth}px 6px minmax(0,1fr)`, height: "100%" };

  return (
    <div style={{ position: focusMode ? "fixed" : "relative", inset: focusMode ? 0 : "auto", zIndex: focusMode ? 80 : "auto", background: "#0b0b0b", height: workspaceHeight }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={onUploadFiles} />
      <input ref={folderInputRef} type="file" multiple style={{ display: "none" }} onChange={onUploadFolder} />

      <div style={driveGridStyle}>
        {isMobile ? (
          <>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", padding: "8px 8px 0" }}>
              <button className="btn" type="button" onClick={() => setMobileSidebarOpen(true)} style={{ padding: "7px 10px" }}>Explorer</button>
              <button className="btn" type="button" onClick={() => setCreateModalOpen(true)} style={{ padding: "7px 10px" }}>New</button>
              <button className="btn" type="button" onClick={() => { if (fileInputRef.current) fileInputRef.current.value = ""; fileInputRef.current?.click(); }} style={{ padding: "7px 10px" }}>Upload</button>
              <div className="helper" style={{ marginLeft: "auto" }}>Mobile Drive</div>
            </div>
            {mobileSidebarOpen ? (
              <div style={{ position: "fixed", inset: focusMode ? 0 : "56px 8px 8px", zIndex: 95, background: "rgba(10,10,12,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", boxShadow: "0 18px 48px rgba(0,0,0,0.45)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#101012" }}>
                  <div style={{ fontWeight: 800 }}>Drive Explorer</div>
                  <button className="btn" type="button" onClick={() => setMobileSidebarOpen(false)} style={{ padding: "6px 10px" }}>Done</button>
                </div>
                <div style={{ height: "calc(100% - 48px)", overflow: "auto" }}>
                  <DriveSidebar
                    folders={folders}
                    notes={notes}
                    files={files}
                    currentFolder={currentFolder}
                    selectedId={selectedId}
                    selectedKind={selectedKind}
                    search={search}
                    setSearch={setSearch}
                    onSelectFolder={(id) => { setCurrentFolder(id); setMobileSidebarOpen(false); }}
                    onSelectNote={(id) => { selectNote(id); setMobileSidebarOpen(false); }}
                    onSelectFile={(file) => { openFile(file); setMobileSidebarOpen(false); }}
                    onNewNote={createNote}
                    onNewFolder={createFolder}
                    onNewSpreadsheet={createSpreadsheet}
                    onNewForm={createForm}
                    onOpenCreatePicker={() => setCreateModalOpen(true)}
                    onUploadFile={() => { if (fileInputRef.current) fileInputRef.current.value = ""; fileInputRef.current?.click(); }}
                    onUploadFolder={() => { const input = folderInputRef.current; if (input) { input.value = ""; input.setAttribute("webkitdirectory", "true"); input.setAttribute("directory", "true"); } input?.click(); }}
                    onRenameFolder={renameFolder}
                    onDeleteFolder={deleteFolder}
                    onRenameNote={renameNote}
                    onMoveNote={moveNote}
                    onDeleteNote={deleteNote}
                    onRenameFile={renameFile}
                    onMoveFile={moveFile}
                    onMoveFileToFolder={moveFileToFolder}
                    onDropFilesOnFolder={onDropFilesOnFolder}
                    repairCandidateCount={explodedFolderCandidates.length}
                    onRepairExplodedFolders={repairExplodedFolders}
                    onDeleteFile={deleteFile}
                    onDeleteFiles={deleteFiles}
                    onMoveFiles={moveFiles}
                    onDownloadFiles={downloadFiles}
                    onDownloadFile={downloadFile}
                    onOpenFileInBrowser={openFileInBrowser}
                    templates={templates}
                    onApplyTemplate={applyTemplate}
                    onNewFromTemplate={createNoteFromTemplate}
                    onDeleteTemplate={deleteTemplate}
                    onEditTemplate={editTemplate}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div style={{ borderRight: "1px solid #1b1b1b", overflow: "hidden" }}>
              <DriveSidebar
                folders={folders}
                notes={notes}
                files={files}
                currentFolder={currentFolder}
                selectedId={selectedId}
                selectedKind={selectedKind}
                search={search}
                setSearch={setSearch}
                onSelectFolder={setCurrentFolder}
                onSelectNote={selectNote}
                onSelectFile={openFile}
                onNewNote={createNote}
                onNewFolder={createFolder}
                onNewSpreadsheet={createSpreadsheet}
                onNewForm={createForm}
                onOpenCreatePicker={() => setCreateModalOpen(true)}
                onUploadFile={() => {
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  fileInputRef.current?.click();
                }}
                onUploadFolder={() => {
                  const input = folderInputRef.current;
                  if (input) {
                    input.value = "";
                    input.setAttribute("webkitdirectory", "true");
                    input.setAttribute("directory", "true");
                  }
                  input?.click();
                }}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
                onRenameNote={renameNote}
                onMoveNote={moveNote}
                onDeleteNote={deleteNote}
                onRenameFile={renameFile}
                onMoveFile={moveFile}
                onMoveFileToFolder={moveFileToFolder}
                onDropFilesOnFolder={onDropFilesOnFolder}
                repairCandidateCount={explodedFolderCandidates.length}
                onRepairExplodedFolders={repairExplodedFolders}
                onDeleteFile={deleteFile}
                onDeleteFiles={deleteFiles}
                onMoveFiles={moveFiles}
                onDownloadFiles={downloadFiles}
                onDownloadFile={downloadFile}
                onOpenFileInBrowser={openFileInBrowser}
                templates={templates}
                onApplyTemplate={applyTemplate}
                onNewFromTemplate={createNoteFromTemplate}
                onDeleteTemplate={deleteTemplate}
                onEditTemplate={editTemplate}
              />
            </div>

            <div onMouseDown={() => beginResize("sidebar")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.03)" }} title="Drag to resize explorer" />
          </>
        )}

        <div style={{ minWidth: 0, overflow: "auto", padding: isMobile ? 8 : 8 }}>
          <Breadcrumbs folders={folders} currentFolder={currentFolder} setCurrentFolder={setCurrentFolder} compact />

          {actionError ? <div className="card" style={{ padding: 12, marginBottom: 10, borderColor: "#7a2f2f", color: "#ffb0b0" }}>{actionError}</div> : null}

          {loadState === "loading" ? (
            <div className="card" style={{ padding: 14, maxWidth: 560 }}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Drive</h2>
              <div className="helper">Loading org Drive…</div>
            </div>
          ) : loadState === "error" ? (
            <div className="card" style={{ padding: 14, maxWidth: 560 }}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Drive</h2>
              <div className="helper" style={{ marginBottom: 12 }}>{loadError || "Drive failed to load."}</div>
              <button className="btn" type="button" onClick={() => loadDrive({ preserveSelection: false })}>Retry</button>
            </div>
          ) : showEditableDocument ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" style={{ flex: 1, minWidth: isMobile ? 120 : 220, fontSize: isMobile ? 18 : 20, fontWeight: 800, background: "transparent", border: "none", outline: "none", color: "#fff", padding: "2px 0" }} />
                <span className="helper">{status}</span>
                {selectedFile && !fileIsEditable ? <span className="helper">read only</span> : null}
              </div>

              {isStructuredDriveDoc ? (
                <div role="tablist" aria-label="Form view" style={{ display: "inline-flex", gap: 6, marginBottom: 8, padding: 4, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
                  <button
                    className="btn"
                    type="button"
                    role="tab"
                    aria-selected={effectiveViewMode === "edit"}
                    onClick={() => setViewMode("edit")}
                    style={{ background: effectiveViewMode === "edit" ? "rgba(255,255,255,0.14)" : undefined }}
                  >Editor</button>
                  <button
                    className="btn"
                    type="button"
                    role="tab"
                    aria-selected={effectiveViewMode === "read"}
                    onClick={() => setViewMode("read")}
                    style={{ background: effectiveViewMode === "read" ? "rgba(255,255,255,0.14)" : undefined }}
                  >Preview</button>
                </div>
              ) : <RichTextToolbar
                onBold={showEditor ? () => wrapSelection("**") : undefined}
                onItalic={showEditor ? () => wrapSelection("*") : undefined}
                onH1={showEditor ? () => prefixLines("# ") : undefined}
                onH2={showEditor ? () => prefixLines("## ") : undefined}
                onBullet={showEditor ? () => prefixLines("- ") : undefined}
                onQuote={showEditor ? () => prefixLines("> ") : undefined}
                onCode={showEditor ? () => wrapSelection("`") : undefined}
                onRule={showEditor ? () => insertBlock("\n---\n") : undefined}
                onLink={showEditor ? () => wrapSelection("[", "](https://)") : undefined}
                onWikiLink={showEditor ? () => wrapSelection("[[", "]]") : undefined}
                menuOpen={menuOpen}
                onToggleMenu={() => setMenuOpen((v) => !v)}
                menuItems={[
                  { label: "Source", onClick: () => { setViewMode("edit"); setMenuOpen(false); } },
                  { label: "Reading", onClick: () => { setViewMode("read"); setMenuOpen(false); } },
                  { label: "Split", onClick: () => { setViewMode("split"); setMenuOpen(false); } },
                  { label: "Props", onClick: () => { insertFrontmatterTemplate(); setMenuOpen(false); } },
                  { label: inspectorOpen ? "Hide inspector" : "Inspector", onClick: () => { setInspectorOpen((v) => !v); setMenuOpen(false); } },
                  { label: "Save as template", onClick: () => { saveCurrentAsTemplate(); setMenuOpen(false); } },
                  selectedFile ? { label: "Open in browser", onClick: () => { openFileInBrowser(selectedFile); setMenuOpen(false); } } : null,
                  selectedFile ? { label: "Download", onClick: () => { downloadFile(selectedFile); setMenuOpen(false); } } : null,
                  { label: focusMode ? "Exit focus" : "Focus", onClick: () => { setFocusMode((v) => !v); setMenuOpen(false); } },
                ].filter(Boolean)}
              />}

              <div id="bf-drive-editor-zone" style={{ display: "grid", gridTemplateColumns: !isMobile && !isStructuredDriveDoc && effectiveViewMode === "split" ? `${Math.round(splitRatio * 100)}% 6px minmax(0,1fr)` : "minmax(0,1fr)", gap: !isMobile && !isStructuredDriveDoc && effectiveViewMode === "split" ? 6 : 0, alignItems: "start" }}>
                {showEditor ? (
                  <div style={{ minWidth: 0 }}>
                    {selectedFileSubtype === "sheet" ? (
                      <SpreadsheetFileView value={content} onChange={setContent} mode="edit" />
                    ) : selectedFileSubtype === "form" ? (
                      <FormFileView value={content} onChange={setContent} mode="edit" fileId={selectedFile?.id || ""} orgId={orgId} />
                    ) : (
                      <NoteEditor value={content} onChange={setContent} focusMode={focusMode} editorRef={editorRef} compact />
                    )}
                  </div>
                ) : null}
                {!isMobile && !isStructuredDriveDoc && effectiveViewMode === "split" ? <div onMouseDown={() => beginResize("split")} style={{ cursor: "col-resize", background: "rgba(255,255,255,0.03)", minHeight: focusMode ? "84vh" : "72vh" }} title="Drag to resize split" /> : null}
                {showPreview ? (
                  <div style={{ minWidth: 0 }}>
                    {selectedFileSubtype === "sheet" ? (
                      <SpreadsheetFileView value={content} mode="preview" />
                    ) : selectedFileSubtype === "form" ? (
                      <FormFileView value={content} onChange={setContent} mode="preview" fileId={selectedFile?.id || ""} orgId={orgId} />
                    ) : selectedKind === "file" && !fileIsMarkdown ? (
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 12, minHeight: "72vh", overflow: "auto" }}>{String(content || "")}</pre>
                    ) : (
                      <NotePreview content={content} onOpenLink={openLinkedNoteByTitle} focusMode={focusMode} onUpdateProperty={updateFrontmatterProperty} onAddProperty={addFrontmatterProperty} onRemoveProperty={removeFrontmatterProperty} propertiesCollapsed={propertiesCollapsed} onToggleProperties={() => setPropertiesCollapsed((v) => !v)} compact />
                    )}
                  </div>
                ) : null}
              </div>
            </>
          ) : selectedFile ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{selectedFile.name}</h2>
                <span className="helper">{selectedFile.mime || "file"}</span>
                <span className="helper">{Math.round((Number(selectedFile.size || 0) / 1024) * 10) / 10} KB</span>
              </div>
              <DriveFilePreview file={selectedFile} />
            </>
          ) : (
            <div className="card" style={{ padding: 14, maxWidth: 760 }}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Drive</h2>
              <div className="helper" style={{ marginBottom: 14 }}>
                Select a note or file from the explorer, or create something new from the sidebar.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>What works here</div>
                  <div className="helper">Notes, folders, uploaded files, markdown editing, templates, backlinks, frontmatter properties, split view, and inspector.</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Storage</div>
                  <div className="helper">Drive content now loads from this org instead of living only in browser localStorage.</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Templates</div>
                  <div className="helper">Templates can create a new note, insert into the current note, and be edited in app.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DriveCreateModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} actions={createModalActions} />

      {inspectorOpen && selectedNote ? (
        <div style={{ position: "fixed", top: isMobile ? "auto" : (focusMode ? 8 : 94), right: isMobile ? 8 : 8, left: isMobile ? 8 : "auto", bottom: isMobile ? 8 : "auto", width: isMobile ? "auto" : 250, maxHeight: isMobile ? "55vh" : (focusMode ? "calc(100vh - 16px)" : "calc(100vh - 102px)"), overflow: "auto", zIndex: 90 }}>
          <NoteInspector
            note={selectedNote}
            backlinks={backlinks}
            onOpenNote={selectNote}
            onClose={() => setInspectorOpen(false)}
            onSaveBulletinDraft={saveBulletinDraft}
            onPublishNote={publishSelectedNote}
            onUnpublishNote={unpublishSelectedNote}
            onOpenPublicBulletin={openPublicBulletinPage}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
