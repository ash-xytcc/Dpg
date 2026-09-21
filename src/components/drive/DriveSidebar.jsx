import React, { useEffect, useMemo, useRef, useState } from "react";
import { isDpgVariant } from "../../lib/appVariant.js";

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

function PopMenu({ trigger, items, align = "right" }) {  const dpg = isDpgVariant();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn" type="button" onClick={() => setOpen((v) => !v)} style={{ padding: "5px 8px", minWidth: 30, borderRadius: 10 }}>
        {trigger}
      </button>
      {open ? (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", ...(align === "left" ? { left: 0 } : { right: 0 }), minWidth: 190, background: dpg ? "var(--dpg-surface, #1a211e)" : "rgba(16,16,20,0.98)", border: dpg ? "1px solid var(--dpg-line, rgba(255,255,255,0.14))" : "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 4, boxShadow: "0 14px 32px rgba(0,0,0,0.42)", zIndex: 120, display: "grid", gap: 4 }}>
          {items.map((item, idx) => (
            <MenuButton key={`${item.label}-${idx}`} label={item.label} danger={item.danger} onClick={() => { item.onClick?.(); setOpen(false); }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TreeRow({ depth = 0, active = false, icon, label, hint, onClick, menuItems,
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
        title={label}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          minWidth: 0,
          padding: "6px 8px",
          paddingLeft: 8 + depth * 12,
          background: active ? (dpg ? "rgba(95,148,221,0.18)" : "rgba(255,255,255,0.08)") : (dropActive ? "rgba(95,148,221,0.22)" : "transparent"),
          color: textColor,
          border: dropActive ? "1px solid #78aef5" : (dpg ? "1px solid var(--dpg-line, rgba(255,255,255,0.14))" : "1px solid rgba(255,255,255,0.07)"),
          borderRadius: 10,
          cursor: draggable ? "grab" : "pointer",
          textAlign: "left",
          outline: dropActive ? "2px solid rgba(120,174,245,0.22)" : "none",
          outlineOffset: 1,
        }}
      >
        <span style={{ opacity: 0.9, width: 12, textAlign: "center", flex: "0 0 12px" }}>{icon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: active ? 700 : 500 }}>{label}</span>
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
  onDownloadFile,
  onOpenFileInBrowser,
  templates = [],
  onApplyTemplate,
  onNewFromTemplate,
  onDeleteTemplate,
  onEditTemplate,
}) {
  const [activePane, setActivePane] = useState("explorer");
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [dropTargetFolder, setDropTargetFolder] = useState(null);

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
    const internalFileId = event.dataTransfer?.getData("application/x-bondfire-drive-file") || "";
    try {
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

  function handleFileDragStart(event, file) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-bondfire-drive-file", String(file.id));
    event.dataTransfer.setData("text/plain", String(file.name || file.id));
  }
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
        const isCollapsed = !!collapsedFolders[folder.id];
        rows.push(
          <TreeRow
            key={folder.id}
            depth={depth}
            active={currentFolder === folder.id}
            icon={isCollapsed ? "▸" : "▾"}
            label={folder.name}
            onClick={() => {
              onSelectFolder?.(folder.id);
              setCollapsedFolders((prev) => ({ ...prev, [folder.id]: !prev[folder.id] }));
            }}
            onDragOver={(event) => handleFolderDragOver(event, folder.id)}
            onDragLeave={handleFolderDragLeave}
            onDrop={(event) => handleFolderDrop(event, folder.id)}
            dropActive={dropTargetFolder === folder.id}
            menuItems={[
              { label: "Open", onClick: () => onSelectFolder?.(folder.id) },
              { label: isCollapsed ? "Expand" : "Collapse", onClick: () => setCollapsedFolders((prev) => ({ ...prev, [folder.id]: !prev[folder.id] })) },
              { label: "Rename", onClick: () => onRenameFolder?.(folder.id) },
              { label: "Delete folder + contents", danger: true, onClick: () => onDeleteFolder?.(folder.id) },
            ]}
          
        textColor={buttonText}
      />,
        );
        if (!isCollapsed) rows.push(...renderBranch(folder.id, depth + 1));
      });

      noteChildren.forEach((note) => {
        rows.push(
          <TreeRow
            key={note.id}
            depth={depth}
            active={selectedKind === "note" && selectedId === note.id}
            icon="•"
            label={note.title || "untitled"}
            onClick={() => onSelectNote?.(note.id)}
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
        rows.push(
          <TreeRow
            key={file.id}
            depth={depth}
            active={selectedKind === "file" && selectedId === file.id}
            icon={String(file.mime || "").includes("bondfire.sheet") || /\.bfsheet$/i.test(String(file.name || "")) ? "▦" : String(file.mime || "").includes("bondfire.form") || /\.bfform$/i.test(String(file.name || "")) ? "☑" : "↗"}
            label={file.name}
            onClick={() => onSelectFile?.(file)}
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
  }, [folders, notes, files, currentFolder, selectedId, selectedKind, search, collapsedFolders, onSelectFolder, onSelectNote, onSelectFile, onRenameFolder, onDeleteFolder, onRenameNote, onMoveNote, onDeleteNote, onRenameFile, onMoveFile, onMoveFileToFolder, onDropFilesOnFolder, onDeleteFile, onDownloadFile, onOpenFileInBrowser]);

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

        {activePane === "explorer" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
              <div className="helper" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>Explorer</div>
              <button
                className="btn"
                type="button"
                onClick={() => onSelectFolder?.(null)}
                onDragOver={(event) => handleFolderDragOver(event, null)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(event) => handleFolderDrop(event, null)}
                style={{
                  padding: "5px 8px",
                  fontSize: 12,
                  borderColor: dropTargetFolder === "__root__" ? "#78aef5" : undefined,
                  background: dropTargetFolder === "__root__" ? "rgba(95,148,221,0.22)" : undefined,
                }}
              >Root</button>
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
                    icon="✦"
                    label={tpl.name}
                    active={false}
                    onClick={() => onApplyTemplate?.(tpl)}
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
    </div>
  );
}
