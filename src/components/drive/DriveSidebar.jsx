import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isDpgVariant } from "../../lib/appVariant.js";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, ListChecks, Sparkles, StickyNote } from "lucide-react";

function getDriveFileType(file) {
  const name = String(file?.name || "").toLowerCase();
  const mime = String(file?.mime || "").toLowerCase();
  if (mime.includes("bondfire.sheet") || name.endsWith(".bfsheet")) return "sheet";
  if (mime === "text/markdown" || name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
  if (mime.includes("bondfire.form") || name.endsWith(".bfform")) return "form";
  if (name.endsWith(".drawio") || mime === "application/vnd.jgraph.mxfile") return "drawio";
  return "file";
}

function SheetGridIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <rect x="2" y="2" width="16" height="16" rx="2" />
      <path d="M2 7h16M2 12h16M7 2v16M12 2v16" />
    </svg>
  );
}

function MarkdownFileIcon() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
      <FileText size={18} strokeWidth={2.25} aria-hidden="true" />
      <span style={{ position: "absolute", right: -3, bottom: -3, padding: "1px 2px", borderRadius: 3, background: "var(--dpg-surface, #1a211e)", fontSize: 8, lineHeight: 1, fontWeight: 800 }}>M</span>
    </span>
  );
}

function DriveItemIcon({ type, open = false, fileType = "" }) {
  const props = { size: 17, strokeWidth: 2.25, "aria-hidden": true };
  if (type === "folder") return open ? <FolderOpen {...props} /> : <Folder {...props} />;
  if (type === "note") return <StickyNote {...props} />;
  if (type === "template") return <Sparkles {...props} />;
  if (fileType === "sheet") return <SheetGridIcon />;
  if (fileType === "markdown") return <MarkdownFileIcon />;
  if (fileType === "form") return <ListChecks {...props} />;
  return <FileText {...props} />;
}

function MenuButton({ label, onClick, danger = false }) {
  return (
    <button
      className="btn"
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        justifyContent: "flex-start",
        padding: "7px 10px",
        color: danger ? "#ff8f8f" : undefined,
      }}
    >
      {label}
    </button>
  );
}

function PopMenu({ trigger, items, align = "right" }) {
  const dpg = isDpgVariant();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const width = Math.max(190, Math.min(320, menu.getBoundingClientRect().width || 190));
      const height = Math.min(420, menu.scrollHeight || 120);
      const gap = 6;
      let top = anchor.bottom + gap;
      if (top + height > window.innerHeight - 8) top = anchor.top - height - gap;
      if (top < 8) top = Math.max(8, Math.min(anchor.bottom + gap, window.innerHeight - height - 8));
      let left = align === "left" ? anchor.left : anchor.right - width;
      if (left + width > window.innerWidth - 8) left = anchor.right - width;
      if (left < 8) left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
      setPosition({ top, left });
    };
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, items.length, align]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button ref={triggerRef} className="btn" type="button" onClick={() => { setOpen((v) => !v); setPosition(null); }} style={{ padding: "5px 8px", minWidth: 30, borderRadius: 10 }}>
        {trigger}
      </button>
      {open ? (
        <div ref={menuRef} style={{ position: "fixed", top: position?.top ?? 8, left: position?.left ?? 8, minWidth: 190, maxHeight: 420, overflow: "auto", visibility: position ? "visible" : "hidden", background: dpg ? "var(--dpg-surface, #1a211e)" : "rgba(16,16,20,0.98)", border: dpg ? "1px solid var(--dpg-line, rgba(255,255,255,0.14))" : "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 4, boxShadow: "0 14px 32px rgba(0,0,0,0.42)", zIndex: 600, display: "grid", gap: 4 }}>
          {items.map((item, idx) => (
            <MenuButton key={`${item.label}-${idx}`} label={item.label} danger={item.danger} onClick={() => { item.onClick?.(); setOpen(false); }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DriveContextMenu({ menu, onClose }) {
  useEffect(() => {
    if (!menu) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const onPointerDown = (event) => {
      if (!event.target.closest("[data-drive-context-menu]")) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  const width = 240;
  const height = Math.min(420, Math.max(100, (menu.items || []).length * 40 + 16));
  const viewportWidth = window.innerWidth || 1000;
  const viewportHeight = window.innerHeight || 700;
  const x = Number(menu.x || 0);
  const y = Number(menu.y || 0);
  const preferredTop = y + height + 8 <= viewportHeight ? y + 6 : y - height - 6;
  const preferredLeft = x + width + 8 <= viewportWidth ? x + 6 : x - width - 6;
  const top = Math.max(8, Math.min(preferredTop, viewportHeight - height - 8));
  const left = Math.max(8, Math.min(preferredLeft, viewportWidth - width - 8));
  return (
    <div
      data-drive-context-menu
      onContextMenu={(event) => event.preventDefault()}
      style={{ position: "fixed", left, top, width, maxHeight: 420, overflow: "auto", zIndex: 500, padding: 5, display: "grid", gap: 3, background: "var(--dpg-surface, #17191d)", border: "1px solid var(--dpg-line, rgba(255,255,255,0.18))", borderRadius: 10, boxShadow: "0 18px 48px rgba(0,0,0,0.55)" }}
    >
      {(menu.items || []).map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          type="button"
          disabled={item.disabled}
          onClick={() => { if (!item.disabled) item.onClick?.(); onClose?.(); }}
          style={{ textAlign: "left", padding: "8px 10px", border: 0, borderRadius: 7, background: "transparent", color: item.danger ? "#ff9b9b" : "var(--dpg-text, #fff)", opacity: item.disabled ? 0.45 : 1, cursor: item.disabled ? "not-allowed" : "pointer" }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function TreeRow({ depth = 0, active = false, icon, itemType = "file", iconColor, label, hint, onClick, onContextMenu, menuItems,
  textColor, draggable = false, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, dropActive = false,
}) {
  const dpg = isDpgVariant();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "center", marginTop: 3 }}>
      <button
        type="button"
        draggable={draggable}
        onClick={onClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        title={label}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          minWidth: 0,
          padding: "6px 8px",
          paddingLeft: 8 + depth * 12,
          background: active ? (dpg ? "rgba(95,148,221,0.18)" : "rgba(255,255,255,0.08)") : (dropActive ? "rgba(95,148,221,0.22)" : (itemType === "folder" ? "rgba(221,177,75,0.08)" : itemType === "file" ? "rgba(95,148,221,0.04)" : "transparent")),
          color: textColor,
          border: dropActive ? "1px solid #78aef5" : (itemType === "folder" ? "1px solid rgba(221,177,75,0.28)" : (dpg ? "1px solid var(--dpg-line, rgba(255,255,255,0.14))" : "1px solid rgba(255,255,255,0.07)")),
          borderRadius: 10,
          cursor: draggable ? "grab" : "pointer",
          textAlign: "left",
          outline: dropActive ? "2px solid rgba(120,174,245,0.22)" : "none",
          outlineOffset: 1,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, width: 30, flex: "0 0 30px", color: iconColor || (itemType === "folder" ? "#e0b34f" : itemType === "file" ? (dpg ? "#78aef5" : "#9ed0ff") : "#c3a7f5") }}>{icon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: active ? 700 : itemType === "folder" ? 650 : 500 }}>{label}</span>
        {hint ? <span className="helper" style={{ marginLeft: "auto", flex: "0 0 auto" }}>{hint}</span> : null}
      </button>
      {menuItems?.length ? <PopMenu trigger="⋯" items={menuItems} /> : null}
    </div>
  );
}

export default function DriveSidebar({
  folders = [],
  notes = [],
  files = [],
  currentFolder,
  selectedId,
  selectedKind,
  search,
  setSearch,
  onSelectFolder,
  onSelectNote,
  onSelectFile,
  onNewNote,
  onNewFolder,
  onNewSpreadsheet,
  onNewForm,
  onOpenCreatePicker,
  onUploadFile,
  onUploadFolder,
  onDropFilesOnFolder,
  onMoveFileToFolder,
  onMoveFolderToFolder,
  onMoveFilesToFolder,
  repairCandidateCount = 0,
  onRepairExplodedFolders,
  onRenameFolder,
  onDeleteFolder,
  onRenameNote,
  onMoveNote,
  onDeleteNote,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
  onDeleteFiles,
  onMoveFiles,
  onDownloadFiles,
  onDownloadFile,
  onOpenFileInBrowser,
  templates = [],
  onApplyTemplate,
  onNewFromTemplate,
  onDeleteTemplate,
  onEditTemplate,
}) {
  const [activePane, setActivePane] = useState("explorer");
  const [expandedFolders, setExpandedFolders] = useState({});
  const [dropTargetFolder, setDropTargetFolder] = useState(null);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [lastSelectedFileId, setLastSelectedFileId] = useState("");
  const [contextMenu, setContextMenu] = useState(null);

  function isInsideDragTarget(event) {
    return event.currentTarget.contains(event.relatedTarget);
  }

  function handleFolderDragOver(event, folderId) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types || []).includes("Files") ? "copy" : "move";
    }
    setDropTargetFolder(folderId || "__root__");
  }

  function handleFolderDragLeave(event) {
    if (isInsideDragTarget(event)) return;
    setDropTargetFolder(null);
  }

  async function handleFolderDrop(event, folderId) {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetFolder(null);
    const internalFolderId = event.dataTransfer?.getData("application/x-bondfire-drive-folder") || "";
    const internalFilesJson = event.dataTransfer?.getData("application/x-bondfire-drive-files") || "";
    const internalFileId = event.dataTransfer?.getData("application/x-bondfire-drive-file") || "";
    try {
      if (internalFolderId) {
        if (String(internalFolderId) === String(folderId || "")) return;
        await onMoveFolderToFolder?.(internalFolderId, folderId || null);
        return;
      }
      if (internalFilesJson) {
        let ids = [];
        try { ids = JSON.parse(internalFilesJson); } catch {}
        if (Array.isArray(ids) && ids.length) {
          await onMoveFilesToFolder?.(ids, folderId || null);
          return;
        }
      }
      if (internalFileId) {
        await onMoveFileToFolder?.(internalFileId, folderId || null);
        return;
      }
      const droppedFiles = Array.from(event.dataTransfer?.files || []);
      if (droppedFiles.length) {
        await onDropFilesOnFolder?.(droppedFiles, folderId || null);
      }
    } catch (error) {
      console.error("Drive tree drop failed", error);
    }
  }

  function handleFolderDragStart(event, folder) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-bondfire-drive-folder", String(folder.id));
    event.dataTransfer.setData("text/plain", String(folder.name || folder.id));
  }

  function handleFileDragStart(event, file) {
    const fileId = String(file.id);
    const ids = selectedFileIds.includes(fileId) ? selectedFileIds : [fileId];
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-bondfire-drive-files", JSON.stringify(ids));
    event.dataTransfer.setData("application/x-bondfire-drive-file", fileId);
    event.dataTransfer.setData("text/plain", String(file.name || file.id));
  }

  function openContextMenu(event, items) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, items });
  }

  const fileOrder = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const fileMatches = (file) => !q || String(file.name || "").toLowerCase().includes(q);
    const folderMatches = (folder) => !q || String(folder.name || "").toLowerCase().includes(q);
    const walk = (parentId = null) => {
      const folderChildren = folders
        .filter((folder) => (folder.parentId || null) === parentId)
        .filter((folder) => !q || folderMatches(folder))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      const fileChildren = files
        .filter((file) => (file.parentId || null) === parentId)
        .filter(fileMatches)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      const result = fileChildren.map((file) => String(file.id));
      folderChildren.forEach((folder) => {
        if (expandedFolders[folder.id]) result.push(...walk(folder.id));
      });
      return result;
    };
    return walk();
  }, [folders, files, search, expandedFolders]);

  function handleFileClick(file, event) {
    const id = String(file.id);
    const additive = !!(event?.metaKey || event?.ctrlKey);
    const range = !!event?.shiftKey;
    if (range && lastSelectedFileId && fileOrder.includes(lastSelectedFileId)) {
      const start = fileOrder.indexOf(lastSelectedFileId);
      const end = fileOrder.indexOf(id);
      const [from, to] = [start, end].sort((a, b) => a - b);
      setSelectedFileIds(fileOrder.slice(from, to + 1));
    } else if (additive) {
      setSelectedFileIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
    } else {
      setSelectedFileIds([id]);
    }
    setLastSelectedFileId(id);
    if (!additive && !range) onSelectFile?.(file);
  }

  useEffect(() => {
    const available = new Set(files.map((file) => String(file.id)));
    setSelectedFileIds((prev) => prev.filter((id) => available.has(id)));
  }, [files]);

  const dpg = isDpgVariant();
  const panelBg = dpg ? "var(--dpg-surface, #1a211e)" : "transparent";
  const panelBorder = dpg ? "var(--dpg-line, rgba(255,255,255,0.14))" : "#1b1b1b";
  const buttonText = dpg ? "var(--dpg-text, #f3efe8)" : "#fff";

  const rootItems = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const noteMatches = (note) => !q || String(note.title || "").toLowerCase().includes(q) || String(note.body || "").toLowerCase().includes(q);
    const fileMatches = (file) => !q || String(file.name || "").toLowerCase().includes(q);
    const folderMatches = (folder) => !q || String(folder.name || "").toLowerCase().includes(q);

    const folderMap = new Map();
    folders.forEach((folder) => folderMap.set(folder.id, folder));

    const visibleFolderIds = new Set();
    folders.forEach((folder) => {
      if (!q || folderMatches(folder)) {
        let cursor = folder;
        while (cursor) {
          visibleFolderIds.add(cursor.id);
          cursor = cursor.parentId ? folderMap.get(cursor.parentId) : null;
        }
      }
    });

    notes.forEach((note) => {
      if (!noteMatches(note)) return;
      let cursor = note.parentId ? folderMap.get(note.parentId) : null;
      while (cursor) {
        visibleFolderIds.add(cursor.id);
        cursor = cursor.parentId ? folderMap.get(cursor.parentId) : null;
      }
    });

    files.forEach((file) => {
      if (!fileMatches(file)) return;
      let cursor = file.parentId ? folderMap.get(file.parentId) : null;
      while (cursor) {
        visibleFolderIds.add(cursor.id);
        cursor = cursor.parentId ? folderMap.get(cursor.parentId) : null;
      }
    });

    function renderBranch(parentId = null, depth = 0) {
      const folderChildren = folders
        .filter((folder) => (folder.parentId || null) === parentId)
        .filter((folder) => !q || visibleFolderIds.has(folder.id) || folderMatches(folder))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

      const noteChildren = notes
        .filter((note) => (note.parentId || null) === parentId)
        .filter(noteMatches)
        .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

      const fileChildren = files
        .filter((file) => (file.parentId || null) === parentId)
        .filter(fileMatches)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

      const rows = [];

      folderChildren.forEach((folder) => {
        const isExpanded = !!expandedFolders[folder.id];
        rows.push(
          <TreeRow
            key={folder.id}
            depth={depth}
            active={currentFolder === folder.id}
            itemType="folder"
            icon={<><span style={{ display: "inline-flex" }}>{isExpanded ? <ChevronDown size={13} strokeWidth={2.5} /> : <ChevronRight size={13} strokeWidth={2.5} />}</span><DriveItemIcon type="folder" open={isExpanded} /></>}
            label={folder.name}
            onClick={() => {
              onSelectFolder?.(folder.id);
              setExpandedFolders((prev) => ({ ...prev, [folder.id]: !prev[folder.id] }));
            }}
            draggable
            onDragStart={(event) => handleFolderDragStart(event, folder)}
            onDragEnd={() => setDropTargetFolder(null)}
            onDragOver={(event) => handleFolderDragOver(event, folder.id)}
            onDragLeave={handleFolderDragLeave}
            onDrop={(event) => handleFolderDrop(event, folder.id)}
            dropActive={dropTargetFolder === folder.id}
            onContextMenu={(event) => openContextMenu(event, [
              { label: "Open", onClick: () => onSelectFolder?.(folder.id) },
              { label: isExpanded ? "Collapse" : "Expand", onClick: () => setExpandedFolders((prev) => ({ ...prev, [folder.id]: !prev[folder.id] })) },
              { label: "Rename", onClick: () => onRenameFolder?.(folder.id) },
              { label: "Delete folder + contents", onClick: () => onDeleteFolder?.(folder.id), danger: true },
            ])}
            menuItems={[
              { label: "Open", onClick: () => onSelectFolder?.(folder.id) },
              { label: isExpanded ? "Expand" : "Collapse", onClick: () => setExpandedFolders((prev) => ({ ...prev, [folder.id]: !prev[folder.id] })) },
              { label: "Rename", onClick: () => onRenameFolder?.(folder.id) },
              { label: "Delete folder + contents", danger: true, onClick: () => onDeleteFolder?.(folder.id) },
            ]}
          
        textColor={buttonText}
      />,
        );
        if (isExpanded) rows.push(...renderBranch(folder.id, depth + 1));
      });

      noteChildren.forEach((note) => {
        rows.push(
          <TreeRow
            key={note.id}
            depth={depth}
            active={selectedKind === "note" && selectedId === note.id}
            itemType="note"
            icon={<DriveItemIcon type="note" />}
            label={note.title || "untitled"}
            onClick={() => onSelectNote?.(note.id)}
            onContextMenu={(event) => openContextMenu(event, [
              { label: "Open", onClick: () => onSelectNote?.(note.id) },
              { label: "Rename", onClick: () => onRenameNote?.(note.id) },
              { label: "Move", onClick: () => onMoveNote?.(note.id) },
              { label: "Delete", onClick: () => onDeleteNote?.(note.id), danger: true },
            ])}
            menuItems={[
              { label: "Open", onClick: () => onSelectNote?.(note.id) },
              { label: "Rename", onClick: () => onRenameNote?.(note.id) },
              { label: "Move", onClick: () => onMoveNote?.(note.id) },
              { label: "Delete", danger: true, onClick: () => onDeleteNote?.(note.id) },
            ]}
          
        textColor={buttonText}
      />,
        );
      });

      fileChildren.forEach((file) => {
        const fileType = getDriveFileType(file);
        rows.push(
          <TreeRow
            key={file.id}
            depth={depth}
            active={(selectedKind === "file" && selectedId === file.id) || selectedFileIds.includes(String(file.id))}
            itemType="file"
            iconColor={fileType === "sheet" ? "#65d391" : fileType === "markdown" ? "#8db8ff" : undefined}
            icon={<DriveItemIcon type="file" fileType={fileType} />}
            label={file.name}
            onClick={(event) => handleFileClick(file, event)}
            onContextMenu={(event) => {
              const fileId = String(file.id);
              const batchIds = selectedFileIds.includes(fileId) ? selectedFileIds : [fileId];
              if (!selectedFileIds.includes(fileId)) setSelectedFileIds([fileId]);
              openContextMenu(event, [
                { label: "Open", onClick: () => onSelectFile?.(file) },
                { label: "Open in browser", onClick: () => onOpenFileInBrowser?.(file) },
                { label: batchIds.length > 1 ? `Download ${batchIds.length} selected files` : "Download", onClick: () => onDownloadFiles?.(batchIds) },
                { label: "Rename", onClick: () => onRenameFile?.(file.id), disabled: batchIds.length > 1 },
                { label: batchIds.length > 1 ? `Move ${batchIds.length} selected files` : "Move", onClick: () => onMoveFiles?.(batchIds) },
                { label: batchIds.length > 1 ? `Delete ${batchIds.length} selected files` : "Delete", onClick: () => onDeleteFiles?.(batchIds), danger: true },
                { label: "Clear selection", onClick: () => setSelectedFileIds([]) },
              ]);
            }}
            draggable
            onDragStart={(event) => handleFileDragStart(event, file)}
            onDragEnd={() => setDropTargetFolder(null)}
            menuItems={[
              { label: "Open", onClick: () => onSelectFile?.(file) },
              { label: "Open in browser", onClick: () => onOpenFileInBrowser?.(file) },
              { label: "Download", onClick: () => onDownloadFile?.(file) },
              { label: "Rename", onClick: () => onRenameFile?.(file.id) },
              { label: "Move", onClick: () => onMoveFile?.(file.id) },
              { label: "Delete", danger: true, onClick: () => onDeleteFile?.(file.id) },
            ]}
          
        textColor={buttonText}
      />,
        );
      });

      return rows;
    }

    return renderBranch();
  }, [folders, notes, files, currentFolder, selectedId, selectedKind, search, expandedFolders, selectedFileIds, onSelectFolder, onSelectNote, onSelectFile, onRenameFolder, onDeleteFolder, onRenameNote, onMoveNote, onDeleteNote, onRenameFile, onMoveFile, onMoveFiles, onMoveFileToFolder, onMoveFolderToFolder, onMoveFilesToFolder, onDropFilesOnFolder, onDeleteFile, onDeleteFiles, onDownloadFiles, onDownloadFile, onOpenFileInBrowser]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr)", height: "100%", position: "relative", zIndex: 0, background: panelBg }}>
      <div style={{ borderRight: `1px solid ${panelBorder}`, padding: 8, display: "grid", alignContent: "start", gap: 6, position: "relative", zIndex: 1 }}>
        <button className="btn" type="button" title="Explorer" onClick={() => setActivePane("explorer")} style={{ padding: "8px 0", fontWeight: activePane === "explorer" ? 800 : 500 }}>⌂</button>
        <button className="btn" type="button" title="Templates" onClick={() => setActivePane("templates")} style={{ padding: "8px 0", fontWeight: activePane === "templates" ? 800 : 500 }}>T</button>
      </div>

      <div style={{ minWidth: 0, overflow: "auto", padding: 10, position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <button className="btn" type="button" onClick={() => onOpenCreatePicker?.()} style={{ padding: "6px 12px", minWidth: 36 }}>＋</button>
          {activePane === "templates" ? (
            <PopMenu
              trigger="⋯"
              align="left"
              items={[
                { label: "New note", onClick: onNewNote },
                { label: "New folder", onClick: onNewFolder },
                { label: "Upload file", onClick: onUploadFile },
                { label: "Upload folder", onClick: onUploadFolder },
              ]}
            />
          ) : null}
          {activePane === "explorer" && repairCandidateCount >= 2 ? (
            <button
              className="btn"
              type="button"
              onClick={() => onRepairExplodedFolders?.()}
              title="Move files out of single-file folders and remove only the emptied folders"
              style={{ padding: "6px 8px", color: "#ffd27a", borderColor: "rgba(255,210,122,0.42)" }}
            >
              Repair {repairCandidateCount}
            </button>
          ) : null}
          <input className="input" placeholder={activePane === "explorer" ? "search..." : "search templates..."} value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 0, flex: 1, padding: "9px 10px" }} />
        </div>
        {activePane === "explorer" && selectedFileIds.length ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8, padding: "6px 8px", border: "1px solid rgba(120,174,245,0.28)", borderRadius: 10, background: "rgba(95,148,221,0.08)" }}>
            <span className="helper" style={{ marginRight: "auto" }}>{selectedFileIds.length} file{selectedFileIds.length === 1 ? "" : "s"} selected</span>
            <button className="btn" type="button" onClick={() => onDownloadFiles?.(selectedFileIds)} style={{ padding: "5px 8px" }}>Download</button>
            <button className="btn" type="button" onClick={() => onMoveFiles?.(selectedFileIds)} style={{ padding: "5px 8px" }}>Move</button>
            <button className="btn" type="button" onClick={async () => { const result = await onDeleteFiles?.(selectedFileIds); if (result !== false) setSelectedFileIds([]); }} style={{ padding: "5px 8px", color: "#ff9b9b" }}>Delete</button>
            <button className="btn" type="button" onClick={() => setSelectedFileIds([])} style={{ padding: "5px 8px" }}>Clear</button>
          </div>
        ) : null}

        {activePane === "explorer" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
              <div className="helper" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>Explorer</div>
              <button
                className="btn"
                type="button"
                onClick={() => onSelectFolder?.(null)}
                onContextMenu={(event) => openContextMenu(event, [
                  { label: "Open root", onClick: () => onSelectFolder?.(null) },
                  { label: "Upload files", onClick: onUploadFile },
                  { label: "Upload folder", onClick: onUploadFolder },
                ])}
                onDragOver={(event) => handleFolderDragOver(event, null)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(event) => handleFolderDrop(event, null)}
                style={{
                  padding: "5px 8px",
                  fontSize: 12,
                  borderColor: dropTargetFolder === "__root__" ? "#78aef5" : undefined,
                  background: dropTargetFolder === "__root__" ? "rgba(95,148,221,0.22)" : undefined,
                }}
              ><Folder size={15} strokeWidth={2.25} aria-hidden="true" />Root</button>
            </div>
            <div style={{ display: "grid", gap: 2 }}>
              {rootItems.length ? rootItems : <div className="helper" style={{ padding: "8px 4px" }}>Nothing here.</div>}
            </div>
          </>
        ) : (
          <>
            <div className="helper" style={{ letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Templates</div>
            <div style={{ display: "grid", gap: 4 }}>
              {templates
                .filter((tpl) => !String(search || "").trim() || String(tpl.name || "").toLowerCase().includes(String(search || "").trim().toLowerCase()) || String(tpl.body || "").toLowerCase().includes(String(search || "").trim().toLowerCase()))
                .map((tpl) => (
                  <TreeRow
                    key={tpl.id}
                    itemType="template"
                    icon={<DriveItemIcon type="template" />}
                    label={tpl.name}
                    active={false}
                    onClick={() => onApplyTemplate?.(tpl)}
                    onContextMenu={(event) => openContextMenu(event, [
                      { label: "Insert into current note", onClick: () => onApplyTemplate?.(tpl) },
                      { label: "New note from template", onClick: () => onNewFromTemplate?.(tpl) },
                      { label: "Edit template", onClick: () => onEditTemplate?.(tpl.id) },
                      { label: "Delete template", danger: true, onClick: () => onDeleteTemplate?.(tpl.id) },
                    ])}
                    menuItems={[
                      { label: "Insert into current note", onClick: () => onApplyTemplate?.(tpl) },
                      { label: "New note from template", onClick: () => onNewFromTemplate?.(tpl) },
                      { label: "Edit template", onClick: () => onEditTemplate?.(tpl.id) },
                      { label: "Delete template", danger: true, onClick: () => onDeleteTemplate?.(tpl.id) },
                    ]}
                  
        textColor={buttonText}
      />
                ))}
              {!templates.length ? <div className="helper" style={{ padding: "8px 4px" }}>No templates yet.</div> : null}
            </div>
          </>
        )}
      </div>
      <DriveContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  );
}
