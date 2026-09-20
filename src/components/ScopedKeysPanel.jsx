import React from 'react';
import { api } from '../utils/api.js';
import {
  getCachedOrgKey,
  cacheOrgKey,
  unwrapOrgKey,
  wrapOrgKeyForRecovery,
  unwrapOrgKeyFromRecovery,
  saveRecoveryToServer,
  loadRecoveryFromServer,
  deleteRecoveryFromServer,
} from '../lib/zk.js';

export default function ScopedKeysPanel({ orgId }) {
  const [state, setState] = React.useState(null);
  const [passphrase, setPassphrase] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [restorePassphrase, setRestorePassphrase] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const refresh = React.useCallback(async () => {
    const [cryptoInfo, recoveryInfo] = await Promise.all([
      api(`/api/orgs/${encodeURIComponent(orgId)}/crypto`, { method: 'GET' }),
      loadRecoveryFromServer(orgId),
    ]);
    const next = {
      crypto: cryptoInfo,
      recovery: recoveryInfo,
      localKey: !!getCachedOrgKey(orgId),
    };
    setState(next);
    return next;
  }, [orgId]);

  React.useEffect(() => {
    refresh().catch((error) => setMessage(error?.message || 'Could not load key status.'));
  }, [refresh]);

  async function loadWrappedKey() {
    setBusy(true);
    setMessage('');
    try {
      const current = state || await refresh();
      if (!current?.crypto?.wrapped_key) throw new Error('No wrapped key is available for this account.');
      const key = await unwrapOrgKey(current.crypto.wrapped_key);
      cacheOrgKey(orgId, key);
      await refresh();
      setMessage('Organization key restored to this device.');
    } catch (error) {
      setMessage(error?.message || 'Could not load the organization key.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRecovery() {
    setBusy(true);
    setMessage('');
    try {
      if (passphrase.length < 20) throw new Error('Use a recovery passphrase of at least 20 characters.');
      if (passphrase !== confirm) throw new Error('Recovery passphrases do not match.');
      const key = getCachedOrgKey(orgId);
      if (!key) throw new Error('Load the organization key on this device first.');
      await saveRecoveryToServer(orgId, await wrapOrgKeyForRecovery(key, passphrase));
      setPassphrase('');
      setConfirm('');
      await refresh();
      setMessage('Encrypted recovery backup saved.');
    } catch (error) {
      setMessage(error?.message || 'Could not save recovery.');
    } finally {
      setBusy(false);
    }
  }

  async function restoreRecovery() {
    setBusy(true);
    setMessage('');
    try {
      if (restorePassphrase.length < 20) throw new Error('Enter the recovery passphrase for this organization.');
      const recovery = await loadRecoveryFromServer(orgId);
      if (!recovery?.has_recovery) throw new Error('No recovery backup is stored for this account and organization.');
      const key = await unwrapOrgKeyFromRecovery(recovery, restorePassphrase);
      cacheOrgKey(orgId, key);
      setRestorePassphrase('');
      await refresh();
      setMessage('Organization key restored from your encrypted recovery backup.');
    } catch (error) {
      setMessage(error?.message || 'Recovery failed.');
    } finally {
      setBusy(false);
    }
  }

  async function removeRecovery() {
    if (!window.confirm('Remove your encrypted recovery backup for this organization?')) return;
    setBusy(true);
    setMessage('');
    try {
      await deleteRecoveryFromServer(orgId);
      await refresh();
      setMessage('Recovery backup removed.');
    } catch (error) {
      setMessage(error?.message || 'Could not remove recovery.');
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return <section className="card" style={{ padding: 16, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>Encryption keys & recovery</h2><p role="status">{message || 'Checking keys…'}</p></section>;
  }

  const info = state.crypto || {};
  const recovery = state.recovery || {};

  return <section className="card" style={{ padding: 16, marginTop: 16 }} aria-labelledby="keys-title">
    <h2 id="keys-title" style={{ marginTop: 0 }}>Encryption keys & recovery</h2>
    <p>The organization key is created and unwrapped on member devices. Recovery stores only a passphrase-encrypted copy of that key on the server.</p>
    <p><strong>Key version: {Number(info.key_version || 1)}</strong> · Device key: <strong>{state.localKey ? 'loaded' : info.wrapped_key ? 'available' : 'not available'}</strong> · Recovery: <strong>{recovery.has_recovery ? 'saved' : 'not saved'}</strong></p>

    {!state.localKey && info.wrapped_key ? <div style={{ marginBottom: 14, padding: 12, border: '1px solid #d97706', borderRadius: 8 }}>
      <strong>This browser does not currently have the organization key.</strong>
      <p>Load the wrapped key issued to this account, or use your recovery passphrase below.</p>
      <button className="btn-red" type="button" disabled={busy} onClick={loadWrappedKey}>{busy ? 'Loading…' : 'Load key on this device'}</button>
    </div> : null}

    {recovery.has_recovery && !state.localKey ? <div style={{ display: 'grid', gap: 8, maxWidth: 560, marginBottom: 14 }}>
      <label>Recovery passphrase<input className="input" type="password" autoComplete="current-password" minLength={20} value={restorePassphrase} onChange={(e) => setRestorePassphrase(e.target.value)} disabled={busy} /></label>
      <button className="btn-red" type="button" disabled={busy || restorePassphrase.length < 20} onClick={restoreRecovery}>{busy ? 'Restoring…' : 'Restore keys on this device'}</button>
    </div> : null}

    {state.localKey ? <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 0 }}>Recovery backup</h3>
      <p style={{ marginTop: 0 }}>Use a separate passphrase of at least 20 characters. DPG does not know or store the passphrase.</p>
      <label>Recovery passphrase<input className="input" type="password" autoComplete="new-password" minLength={20} value={passphrase} onChange={(e) => setPassphrase(e.target.value)} disabled={busy} /></label>
      <label>Confirm passphrase<input className="input" type="password" autoComplete="new-password" minLength={20} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} /></label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-red" type="button" disabled={busy || passphrase.length < 20 || passphrase !== confirm} onClick={saveRecovery}>{recovery.has_recovery ? 'Replace my recovery backup' : 'Save my recovery backup'}</button>
        {recovery.has_recovery ? <button className="btn" type="button" disabled={busy} onClick={removeRecovery}>Remove recovery backup</button> : null}
      </div>
    </div> : null}

    <div style={{ marginTop: 14, padding: 12, border: '1px solid rgba(255,255,255,.14)', borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Key rotation</h3>
      <p style={{ marginBottom: 0 }}>Bondfire proper now keeps versioned, role-scoped key history during rotation. This DPG fork still uses one replaceable organization key, so unsafe rotation is intentionally not exposed here until its private-storage layer is migrated. Replacing the key today could strand existing ciphertext.</p>
    </div>

    {message ? <p role="status">{message}</p> : null}
  </section>;
}
