import React from 'react';
import { api } from '../utils/api.js';
import {
  ensureDeviceKeypair,
  randomOrgKey,
  wrapForMember,
  unwrapOrgKey,
  cacheOrgKey,
  getCachedOrgKey,
} from '../lib/zk.js';

export default function PrivateStoragePanel({ orgId }) {
  const [status, setStatus] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const refresh = React.useCallback(async () => {
    setMessage('');
    await ensureDeviceKeypair();
    const info = await api(`/api/orgs/${encodeURIComponent(orgId)}/crypto`, { method: 'GET' });
    setStatus({ ...info, localKey: !!getCachedOrgKey(orgId) });
    return info;
  }, [orgId]);

  React.useEffect(() => {
    refresh().catch((error) => setMessage(error?.message || 'Could not load encryption status.'));
  }, [refresh]);

  async function loadThisDevice() {
    setBusy(true);
    setMessage('');
    try {
      const info = status || await refresh();
      if (!info?.wrapped_key) throw new Error('This device does not have a wrapped organization key yet.');
      const key = await unwrapOrgKey(info.wrapped_key);
      cacheOrgKey(orgId, key);
      await refresh();
      setMessage('Organization key loaded on this device.');
    } catch (error) {
      setMessage(error?.message || 'Could not load the organization key.');
    } finally {
      setBusy(false);
    }
  }

  async function initializeEncryption() {
    setBusy(true);
    setMessage('');
    try {
      const info = status || await refresh();
      if (info?.has_org_key) throw new Error('This organization already has an encryption key. Load or recover that key instead of replacing it.');

      await ensureDeviceKeypair();
      const memberResult = await api(`/api/orgs/${encodeURIComponent(orgId)}/members`, { method: 'GET' });
      const members = Array.isArray(memberResult?.members) ? memberResult.members : [];
      if (!members.length) throw new Error('No organization members were found.');

      const missing = members.filter((member) => !(member?.public_key || member?.publicKey));
      if (missing.length) {
        throw new Error('Every current member must sign in on a device once before the initial organization key can be shared safely.');
      }

      const key = randomOrgKey();
      const wrappedKeys = [];
      for (const member of members) {
        const userId = member?.user_id || member?.userId;
        const publicKey = member?.public_key || member?.publicKey;
        if (!userId || !publicKey) continue;
        const jwk = typeof publicKey === 'string' ? JSON.parse(publicKey) : publicKey;
        wrappedKeys.push({
          user_id: userId,
          wrapped_key: await wrapForMember(key, jwk),
          key_version: Number(info?.key_version || 1),
        });
      }

      if (!wrappedKeys.length) throw new Error('No usable member device keys were found.');

      await api(`/api/orgs/${encodeURIComponent(orgId)}/crypto`, {
        method: 'POST',
        body: JSON.stringify({
          wrapped_keys: wrappedKeys,
          key_version: Number(info?.key_version || 1),
          encrypted_org_metadata: null,
        }),
      });

      cacheOrgKey(orgId, key);
      await refresh();
      setMessage('Client-side organization encryption is ready on this device.');
    } catch (error) {
      setMessage(error?.message || 'Could not initialize encryption.');
    } finally {
      setBusy(false);
    }
  }

  const role = String(status?.role || '').toLowerCase();
  const canInitialize = role === 'admin' || role === 'owner';

  return <section className="card" style={{ marginTop: 16, padding: 16 }} aria-labelledby="private-storage-title">
    <h2 id="private-storage-title" style={{ marginTop: 0 }}>Encrypted storage</h2>
    <p>DPG private records use client-side organization-key encryption where supported. The server stores encrypted payloads and routing metadata; plaintext private content is intended to remain on authorized member devices.</p>
    <p>This protects private content, not anonymity. Accounts, memberships, roles, timestamps, opaque identifiers, traffic, and ciphertext sizes can still be visible to the service.</p>

    {!status ? <p role="status">Checking encryption status…</p> : <>
      <p><strong>Status: {status.has_org_key ? 'organization key exists' : 'organization key not initialized'}</strong>{role ? ` · Your role: ${role}` : ''}</p>
      <p>Current device: <strong>{status.localKey ? 'key loaded' : status.wrapped_key ? 'key available to load' : 'no organization key on this device'}</strong></p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {status.wrapped_key && !status.localKey ? <button className="btn-red" type="button" disabled={busy} onClick={loadThisDevice}>{busy ? 'Loading…' : 'Load organization key on this device'}</button> : null}
        {!status.has_org_key && canInitialize ? <button className="btn-red" type="button" disabled={busy} onClick={initializeEncryption}>{busy ? 'Preparing…' : 'Initialize organization encryption'}</button> : null}
        <button className="btn" type="button" disabled={busy} onClick={() => refresh().catch((error) => setMessage(error?.message || 'Refresh failed.'))}>Refresh encryption status</button>
      </div>
    </>}

    <p className="helper" style={{ marginBottom: 0, marginTop: 12 }}>DPG is still on its earlier single-organization-key storage model. This page uses the newer Bondfire security flow without pretending DPG already has Bondfire’s versioned, role-scoped key history.</p>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
