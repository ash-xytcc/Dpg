import React from "react";

async function api(path, opts = {}) {
  const headers = {
    Accept: "application/json",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers || {}),
  };

  const res = await fetch(path, {
    ...opts,
    method: opts.method || "GET",
    credentials: "include",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return {
    ok: !!(res.ok && data?.ok !== false),
    status: res.status,
    data,
  };
}

function uploadFileWithProgress(path, file, onProgress = () => {}) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.open("POST", path, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 100)));
      onProgress(pct);
    };

    xhr.onerror = () => {
      resolve({ ok: false, status: 0, data: { error: "NETWORK_ERROR" } });
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = { raw: xhr.responseText || "" };
      }
      resolve({
        ok: !!(xhr.status >= 200 && xhr.status < 300 && data?.ok !== false),
        status: xhr.status,
        data,
      });
    };

    xhr.send(form);
  });
}

function uploadVideoFile(file, onProgress = () => {}) {
  return uploadFileWithProgress("/api/orgs/dpg/shares-upload", file, onProgress);
}

function uploadThumbFile(file, onProgress = () => {}) {
  return uploadFileWithProgress("/api/orgs/dpg/shares-thumb-upload", file, onProgress);
}

const theme = {
  bgElev: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(10,16,14,0.72)",
  border: "rgba(255,255,255,0.08)",
  text: "#f3efe8",
  muted: "#d7ddd8",
  accent: "#93b4f0",
  inputBg: "rgba(255,255,255,0.06)",
  inputText: "#f3efe8",
};

const EMPTY = {
  title: "",
  description: "",
  videoUrl: "",
  thumbnailUrl: "",
  tags: "",
  durationText: "",
  metaText: "",
  featured: false,
};

function cardStyle() {
  return {
    border: "1px solid var(--border)",
    borderRadius: 24,
    padding: 20,
    background: "var(--bg-elev)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.16)",
  };
}

function inputStyle() {
  return {
    width: "100%",
    borderRadius: 12,
    border: "1px solid var(--border)",
    padding: "12px 14px",
    fontSize: 16,
    background: "var(--input-bg)",
    color: "var(--input-text)",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
}

function buttonStyle(primary = false) {
  return {
    border: primary ? "0" : "1px solid var(--border)",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    background: primary ? "var(--accent)" : "rgba(255,255,255,0.05)",
    color: primary ? "#121715" : "var(--text)",
    fontWeight: 800,
    fontSize: 14,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function sortItems(items = []) {
  return [...items].sort((a, b) => {
    const av = Number(a?.updatedAt || a?.publishedAt || a?.createdAt || 0);
    const bv = Number(b?.updatedAt || b?.publishedAt || b?.createdAt || 0);
    return bv - av;
  });
}

function formatDurationText(totalSeconds) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return [h, String(m).padStart(2, "0"), String(s).padStart(2, "0")].join(":");
  }
  return [m, String(s).padStart(2, "0")].join(":");
}

function readVideoDuration(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const value = Number(video.duration || 0);
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(value) && value > 0 ? value : 0);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      video.src = url;
    } catch {
      resolve(0);
    }
  });
}

export default function DpgVideosPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadPct, setUploadPct] = React.useState(0);
  const [thumbUploading, setThumbUploading] = React.useState(false);
  const [thumbPct, setThumbPct] = React.useState(0);
  const [items, setItems] = React.useState([]);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("Loading videos…");
  const [editingId, setEditingId] = React.useState("");
  const [draft, setDraft] = React.useState(EMPTY);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    setStatus("Loading video records…");

    try {
      const res = await api("/api/orgs/dpg/shares");

      if (!res.ok) {
        const msg =
          res?.data?.error ||
          res?.data?.detail ||
          res?.data?.message ||
          res?.data?.raw ||
          `HTTP ${res.status}`;
        setItems([]);
        setError(String(msg));
        setStatus("Could not load video records.");
        return;
      }

      const next = Array.isArray(res?.data?.shares) ? res.data.shares : [];
      setItems(sortItems(next));
      setStatus(`Loaded ${next.length} video entr${next.length === 1 ? "y" : "ies"}.`);
    } catch (e) {
      setItems([]);
      setError(String(e?.message || e));
      setStatus("Runtime error while loading videos.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditingId("");
    setDraft(EMPTY);
  }

  function beginEdit(item) {
    setEditingId(String(item?.id || ""));
    setDraft({
      title: item?.title || "",
      description: item?.description || "",
      videoUrl: item?.videoUrl || "",
      thumbnailUrl: item?.thumbnailUrl || "",
      tags: Array.isArray(item?.tags) ? item.tags.join(", ") : "",
      durationText: item?.durationText || "",
      metaText: item?.metaText || "",
      featured: !!item?.featured,
    });
    setError("");
    setStatus("Editing existing video entry.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onPickVideo(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadPct(0);
    setError("");
    setStatus(`Uploading ${file.name} `);

    try {
      const seconds = await readVideoDuration(file);
      const autoDurationText = seconds > 0 ? formatDurationText(seconds) : "";
      const res = await uploadVideoFile(file, setUploadPct);

      if (!res.ok) {
        throw new Error(
          res?.data?.error ||
          res?.data?.detail ||
          res?.data?.message ||
          res?.data?.raw ||
          `HTTP ${res.status}`
        );
      }

      const url = String(res?.data?.url || "").trim();
      const filename = String(res?.data?.filename || file.name || "").trim();
      const titleFromFile = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

      setDraft((prev) => ({
        ...prev,
        videoUrl: url || prev.videoUrl,
        title: prev.title || titleFromFile,
        durationText: autoDurationText || prev.durationText,
      }));

      setUploadPct(100);
      setStatus(autoDurationText
        ? `Upload complete.`
        : "Upload complete.");
    } catch (err) {
      setError(String(err?.message || err));
      setStatus("Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onPickThumb(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbUploading(true);
    setThumbPct(0);
    setError("");
    setStatus(`Uploading thumbnail ${file.name}…`);

    try {
      const res = await uploadThumbFile(file, setThumbPct);

      if (!res.ok) {
        throw new Error(
          res?.data?.error ||
          res?.data?.detail ||
          res?.data?.message ||
          res?.data?.raw ||
          `HTTP ${res.status}`
        );
      }

      const url = String(res?.data?.url || "").trim();
      setDraft((prev) => ({
        ...prev,
        thumbnailUrl: url || prev.thumbnailUrl,
      }));

      setThumbPct(100);
      setStatus("Thumbnail upload complete.");
    } catch (err) {
      setError(String(err?.message || err));
      setStatus("Thumbnail upload failed.");
    } finally {
      setThumbUploading(false);
      e.target.value = "";
    }
  }

  async function save(statusValue = "published") {
    const title = String(draft.title || "").trim();
    const videoUrl = String(draft.videoUrl || "").trim();

    if (!title) {
      setError("Title is required.");
      return;
    }
    if (!videoUrl) {
      setError("Upload a file or provide a video URL.");
      return;
    }

    setSaving(true);
    setError("");
    setStatus(editingId ? "Saving changes…" : "Creating video entry…");

    const body = {
      ...(editingId ? { id: editingId } : {}),
      title,
      description: String(draft.description || "").trim(),
      videoUrl,
      thumbnailUrl: String(draft.thumbnailUrl || "").trim(),
      tags: String(draft.tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      durationText: String(draft.durationText || "").trim(),
      metaText: String(draft.metaText || "").trim(),
      featured: !!draft.featured,
      status: statusValue,
    };

    try {
      const res = await api("/api/orgs/dpg/shares", {
        method: editingId ? "PATCH" : "POST",
        body,
      });

      if (!res.ok) {
        throw new Error(
          res?.data?.error ||
          res?.data?.detail ||
          res?.data?.message ||
          res?.data?.raw ||
          `HTTP ${res.status}`
        );
      }

      const wasEditing = !!editingId;
      resetForm();
      await load();
      setStatus(wasEditing ? "Video entry updated." : "Video entry created.");
    } catch (e) {
      setError(String(e?.message || e));
      setStatus("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(item) {
    const id = String(item?.id || "").trim();
    if (!id) return;

    const confirmed = window.confirm(
      `Delete "${item?.title || "this entry"}"?\n\nThis removes the share record and will also try to remove uploaded assets tied to it.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const res = await api("/api/orgs/dpg/shares", {
        method: "DELETE",
        body: { id, deleteAssets: true },
      });

      if (!res.ok) {
        throw new Error(
          res?.data?.error ||
          res?.data?.detail ||
          res?.data?.message ||
          res?.data?.raw ||
          `HTTP ${res.status}`
        );
      }

      if (String(editingId || "") === id) resetForm();
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function unpublish(item) {
    setSaving(true);
    setError("");
    setStatus("Unpublishing video entry…");

    try {
      const res = await api("/api/orgs/dpg/shares", {
        method: "PATCH",
        body: {
          id: item?.id,
          title: item?.title || "",
          description: item?.description || "",
          videoUrl: item?.videoUrl || "",
          thumbnailUrl: item?.thumbnailUrl || "",
          tags: Array.isArray(item?.tags) ? item.tags : [],
          durationText: item?.durationText || "",
          metaText: item?.metaText || "",
          featured: false,
          status: "draft",
        },
      });

      if (!res.ok) {
        throw new Error(
          res?.data?.error ||
          res?.data?.detail ||
          res?.data?.message ||
          res?.data?.raw ||
          `HTTP ${res.status}`
        );
      }

      if (String(editingId || "") === String(item?.id || "")) {
        resetForm();
      }

      await load();
      setStatus("Video entry unpublished.");
    } catch (e) {
      setError(String(e?.message || e));
      setStatus("Unpublish failed.");
    } finally {
      setSaving(false);
    }
  }

  const publishedCount = items.filter((item) => item?.status === "published").length;
  const draftCount = items.filter((item) => item?.status !== "published").length;
  const tagSuggestions = Array.from(
    new Set(
      items.flatMap((item) =>
        Array.isArray(item?.tags)
          ? item.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
          : []
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div
      style={{
        "--bg-elev": theme.bgElev,
        "--border": theme.border,
        "--text": theme.text,
        "--muted": theme.muted,
        "--accent": theme.accent,
        "--input-bg": theme.inputBg,
        "--input-text": theme.inputText,
        color: "var(--text)",
        padding: 20,
        display: "grid",
        gap: 20,
      }}
    >
      <div style={cardStyle()}>
        <div
          style={{
            color: "var(--accent)",
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            marginBottom: 10,
          }}
        >
          DPG Shares backend
        </div>

        <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3.6rem)", lineHeight: 0.96 }}>
          videos
        </h1>

        <div style={{ marginTop: 12, color: "var(--muted)", lineHeight: 1.58, maxWidth: 900 }}>
          This phase adds the first R2-backed upload flow. Uploading a video fills the video URL field
          automatically, and public playback still uses the existing shares routes and detail pages.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <div style={{ ...buttonStyle(false), cursor: "default" }}>{items.length} total</div>
          <div style={{ ...buttonStyle(false), cursor: "default" }}>{publishedCount} published</div>
          <div style={{ ...buttonStyle(false), cursor: "default" }}>{draftCount} drafts</div>
        </div>
      </div>


    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
        gap: 20,
        alignItems: "start",
      }}
    >
        <div style={cardStyle()}>
          <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 14 }}>
            {editingId ? "edit video entry" : "new video entry"}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                                <label style={{ ...buttonStyle(false), cursor: uploading ? "default" : "pointer" }}>
                  {uploading ? "uploading video..." : "choose video file"}
                  <input
                    type="file"
                    accept="video/*"
                    onChange={onPickVideo}
                    disabled={uploading || thumbUploading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {(uploading || uploadPct > 0) ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>video upload progress: {uploadPct}%</div>
                  <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ width: `${uploadPct}%`, height: "100%", background: "var(--accent)", transition: "width 120ms linear" }} />
                  </div>
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>upload thumbnail image</div>
                <label style={{ ...buttonStyle(false), cursor: thumbUploading ? "default" : "pointer" }}>
                  {thumbUploading ? "uploading thumbnail..." : "choose thumbnail image"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onPickThumb}
                    disabled={uploading || thumbUploading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {(thumbUploading || thumbPct > 0) ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>thumbnail upload progress: {thumbPct}%</div>
                  <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ width: `${thumbPct}%`, height: "100%", background: "var(--accent)", transition: "width 120ms linear" }} />
                  </div>
                </div>
              ) : null}
            </div>

            <input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="title"
              style={inputStyle()}
            />

            <input
              value={draft.videoUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, videoUrl: e.target.value }))}
              placeholder="video URL or uploaded R2 asset URL"
              style={inputStyle()}
            />

            <input
              value={draft.thumbnailUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
              placeholder="thumbnail URL"
              style={inputStyle()}
            />

            <div style={{ display: "grid", gap: 6 }}>
              <input
                list="dpg-video-tag-suggestions"
                value={draft.tags}
                onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="tags, comma separated"
                style={inputStyle()}
              />
              <datalist id="dpg-video-tag-suggestions">
                {tagSuggestions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>duration</div>
              <input
                value={draft.durationText}
                readOnly
                placeholder="auto-set from uploaded video"
                style={{ ...inputStyle(), opacity: 0.88 }}
              />
            </div>

            <input
              value={draft.metaText}
              onChange={(e) => setDraft((prev) => ({ ...prev, metaText: e.target.value }))}
              placeholder="meta text"
              style={inputStyle()}
            />

            <textarea
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="description"
              rows={6}
              style={{ ...inputStyle(), resize: "vertical" }}
            />

            <label style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={!!draft.featured}
                onChange={(e) => setDraft((prev) => ({ ...prev, featured: e.target.checked }))}
              />
              mark as featured
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => save("published")} disabled={saving || uploading} style={buttonStyle(true)}>
                {saving ? "saving..." : editingId ? "save changes" : "publish entry"}
              </button>

              <button type="button" onClick={() => save("draft")} disabled={saving || uploading} style={buttonStyle(false)}>
                save as draft
              </button>

              {editingId ? (
                <button type="button" onClick={resetForm} disabled={saving || uploading} style={buttonStyle(false)}>
                  cancel edit
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 14 }}>archive entries</div>

          {loading ? (
            <div style={{ color: "var(--muted)" }}>loading…</div>
          ) : !items.length ? (
            <div style={{ color: "var(--muted)" }}>
              no entries found yet. use the form to create the first one.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: 14,
                    background: "rgba(255,255,255,0.04)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ color: "var(--text)", fontWeight: 800 }}>
                    {item.title || "(untitled)"}
                  </div>

                  <div style={{ color: "var(--muted)", fontSize: 14 }}>
                    {item.status || "draft"} • {item.slug || "no-slug"}{item.featured ? " • featured" : ""}
                  </div>

                  {item.metaText ? (
                    <div style={{ color: "var(--accent)", fontSize: 13 }}>{item.metaText}</div>
                  ) : null}

                  {item.description ? (
                    <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>{item.description}</div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => beginEdit(item)} style={buttonStyle(false)}>
                      edit
                    </button>

                    {item.status === "published" ? (
                      <button type="button" onClick={() => unpublish(item)} disabled={saving} style={buttonStyle(false)}>
                        unpublish
                      </button>
                    ) : null}

                    <button type="button" onClick={() => deleteEntry(item)} disabled={saving} style={buttonStyle(false)}>
                      delete
                    </button>

                    {item.slug ? (
                      <a href={`/dpg-shares/${item.slug}`} style={buttonStyle(false)}>
                        view public
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
