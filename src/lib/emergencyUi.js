export function emergencyError(error) {
  const code = error?.code || error?.message || '';
  const messages = {
    INVALID_PASSWORD: 'That password did not match. Try again.',
    PASSWORD_REQUIRED: 'Enter your current password.',
    MFA_REQUIRED: 'Enter the six-digit code from your authenticator.',
    INVALID_MFA_CODE: 'That authenticator code did not match. Try the current code.',
    RATE_LIMIT: 'Too many authentication attempts. Wait a few minutes, then retry.',
    CSRF_REQUIRED: 'Your security session needs refreshing. Reload the page or sign in again.',
    UNAUTHORIZED: 'Sign in again to continue.',
    INSUFFICIENT_ROLE: 'Only an organization owner can continue to isolation or destruction.',
    NOT_A_MEMBER: 'This organization is no longer available to your account.',
    PROTOCOL_STAGE_CHANGED: 'The protocol stage changed. Refresh before continuing.',
    CONFIRMATION_MISMATCH: 'The confirmation phrase must match exactly.',
    SOLE_OWNED_ORGS_REMAIN: 'Transfer or destroy your remaining sole-owned organizations before deleting your account.',
    ORG_ISOLATED: 'This organization is isolated. Only owners can access it.',
    ORG_LOCKDOWN_ACTIVE: 'Organization writes are locked. Use the emergency protocol to restore access.',
    INTERNAL: 'The request could not finish. Refresh the protocol status before retrying.',
  };
  return messages[code] || (/^[A-Z_]+$/.test(code)
    ? `The action could not finish (${code}). Refresh and retry.`
    : code || 'The action could not finish. Refresh and retry.');
}

export async function clearOrgDeviceData(orgId) {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (key.split(/[:/]/).includes(String(orgId))) storage.removeItem(key);
    }
  }
  if (typeof caches !== 'undefined') {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.startsWith(`/api/orgs/${encodeURIComponent(orgId)}/`)) {
          await cache.delete(request);
        }
      }
    }
  }
}

export async function clearAccountDeviceData() {
  localStorage.clear();
  sessionStorage.clear();
  if (typeof caches !== 'undefined') {
    await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
  }
  if (typeof indexedDB !== 'undefined') {
    const databases = typeof indexedDB.databases === 'function'
      ? await indexedDB.databases()
      : [{ name: 'bondfire_zk' }];
    await Promise.all(databases.filter((entry) => entry.name).map(({ name }) => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = resolve;
      request.onerror = () => reject(new Error('Could not clear browser key storage. Clear this site data in browser settings.'));
      request.onblocked = () => reject(new Error('Account deleted. Close other DPG tabs, then clear this site data in browser settings.'));
    })));
  }
}
