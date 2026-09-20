// src/utils/api.js
// Central fetch wrapper for cookie/Bearer sessions with CSRF protection.
import { isDemoMode } from "../demo/demoMode.js";
import { demoHandle, ensureDemoOrgList } from "../demo/demoStore.js";

const API_BASE = (import.meta?.env?.VITE_API_BASE || "").replace(/\/$/, "");

function pickToken() {
  try {
    return (
      localStorage.getItem("bf_token") ||
      localStorage.getItem("bf_auth_token") ||
      localStorage.getItem("bf_access_token") ||
      localStorage.getItem("bf_accessToken") ||
      ""
    );
  } catch {
    return "";
  }
}

function saveToken(token) {
  if (!token) return;
  try { localStorage.setItem("bf_token", token); } catch {}
}

function readCsrfCookie() {
  try {
    const part = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("bf_csrf="));
    return part ? decodeURIComponent(part.slice(8)) : "";
  } catch {
    return "";
  }
}

function applyCsrfHeader(headers) {
  const csrf = readCsrfCookie();
  if (csrf) headers.set("x-csrf", csrf);
}

async function readJsonMaybe(response) {
  if (!response || response.status === 204 || response.status === 205) return null;
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return { raw: text }; }
}

async function responseError(response) {
  const text = await response.text().catch(() => "");
  let payload = null;
  try { payload = JSON.parse(text); } catch {}
  const error = new Error(payload?.error || text || `Request failed (${response.status})`);
  error.code = payload?.error || "";
  error.status = response.status;
  error.details = payload;
  return error;
}

async function tryRefresh() {
  const rel = "/api/auth/refresh";
  const url = API_BASE ? `${API_BASE}${rel}` : rel;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) return null;
  const data = await readJsonMaybe(response);
  if (data?.token) saveToken(data.token);
  if (data?.access_token) saveToken(data.access_token);
  return data;
}

function buildHeaders(options) {
  const headers = new Headers(options.headers || {});
  const body = options.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
  const isArrayBuffer = typeof ArrayBuffer !== "undefined" && (body instanceof ArrayBuffer || ArrayBuffer.isView(body));

  if (!headers.has("Content-Type") && body != null && !isFormData && !isBlob && !isArrayBuffer) {
    headers.set("Content-Type", "application/json");
  }

  applyCsrfHeader(headers);
  const token = pickToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function api(path, options = {}) {
  const rel = path.startsWith("/") ? path : `/${path}`;
  const method = String(options.method || "GET").toUpperCase();
  const safeToRetry = method === "GET" || method === "HEAD";

  if (isDemoMode()) {
    ensureDemoOrgList();
    const handled = demoHandle(rel, options);
    if (handled) return handled;
  }

  const candidates = path.startsWith("http")
    ? [path]
    : !API_BASE
      ? [rel]
      : rel.startsWith("/api/")
        ? [rel, `${API_BASE}${rel}`]
        : [`${API_BASE}${rel}`];

  let chosenUrl = candidates[0];
  let response = null;
  let headers = buildHeaders(options);

  for (let i = 0; i < candidates.length; i += 1) {
    chosenUrl = candidates[i];
    try {
      response = await fetch(chosenUrl, { ...options, headers, credentials: "include" });
      const shouldTryNext =
        i < candidates.length - 1 &&
        (response.status === 404 || (safeToRetry && response.status >= 500));
      if (!shouldTryNext) break;
    } catch {
      response = null;
      if (!safeToRetry) break;
    }
  }

  if (!response) throw new Error("Network error");

  if (response.status === 401) {
    await tryRefresh().catch(() => null);
    headers = buildHeaders(options);
    response = await fetch(chosenUrl, { ...options, headers, credentials: "include" });
  }

  if (response.status === 403 && !safeToRetry) {
    const payload = await response.clone().json().catch(() => null);
    if (payload?.error === "CSRF_REQUIRED" || payload?.error === "CSRF_INVALID") {
      const refreshed = await tryRefresh().catch(() => null);
      if (refreshed) {
        headers = buildHeaders(options);
        response = await fetch(chosenUrl, { ...options, headers, credentials: "include" });
      }
    }
  }

  if (!response.ok) throw await responseError(response);
  return (await readJsonMaybe(response)) || {};
}
