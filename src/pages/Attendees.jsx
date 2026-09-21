import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';


async function authFetch(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

function fmtStamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  try {
    return new Date(n).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getOrgDisplayName(orgId) {
  if (!orgId) return "current workspace";
  try {
    const settings = JSON.parse(localStorage.getItem(`bf_org_settings_${orgId}`) || "{}");
    const orgs = JSON.parse(localStorage.getItem("bf_orgs") || "[]");
    const match = Array.isArray(orgs) ? orgs.find((o) => o?.id === orgId) : null;
    return String(settings?.name || match?.name || orgId);
  } catch {
    return String(orgId);
  }
}

const STATUS_META = {
  captured: { label: 'Email captured', tone: '#dbe6f5', text: '#21405f' },
  confirmed: { label: 'Confirmation sent', tone: '#d9efd1', text: '#2f4b2a' },
  form_started: { label: 'Form started', tone: '#fff0b7', text: '#5e4d14' },
  form_complete: { label: 'Form complete', tone: '#d7f4e1', text: '#23553a' },
  needs_followup: { label: 'Needs follow-up', tone: '#f7d7df', text: '#6a2540' },
  reviewed: { label: 'Reviewed', tone: '#d7f4e1', text: '#23553a' },
};

function StatCard({ label, value, helper }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, margin: '8px 0 6px' }}>{value}</div>
      <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{helper}</div>
    </div>
  );
}

function Pill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.captured;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '6px 10px',
        background: meta.tone,
        color: meta.text,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}

export default function Attendees() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [permissions, setPermissions] = useState({ actor_role: "", can_delete: false });
  const [emailStatus, setEmailStatus] = useState(null);

  const loadAttendees = React.useCallback(async () => {
    setLoading(true);
    setLoadMsg('');
    try {
      const [data, emailData] = await Promise.all([
        authFetch(`/api/orgs/${encodeURIComponent(orgId)}/attendees`),
        authFetch(`/api/orgs/${encodeURIComponent(orgId)}/email/status`).catch(() => null),
      ]);
      const rows = Array.isArray(data?.attendees) ? data.attendees : [];
      setAttendees(rows);
      setPermissions(data?.permissions || { actor_role: "", can_delete: false });
      setEmailStatus(emailData?.email || null);
      setSelectedId((prev) => {
        if (prev && rows.some((row) => row.id === prev)) return prev;
        return rows[0]?.id || null;
      });
    } catch (e) {
      setAttendees([]);
      setSelectedId(null);
      setLoadMsg(String(e?.message || e || 'Failed to load attendees'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    let dead = false;
    (async () => {
      if (dead) return;
      await loadAttendees();
    })();
    return () => { dead = true; };
  }, [loadAttendees]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search || '');
    const fromQuery = qs.get('attendee');
    if (fromQuery) {
      setSelectedId(fromQuery);
    }
  }, [location.search]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees.filter((person) => {
      const matchesStatus = statusFilter === 'all' ? true : person.status === statusFilter;
      const matchesQuery = !q
        ? true
        : `${person.name} ${person.email} ${person.notes} ${person.access}`.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, attendees]);

  const selected = filtered.find((person) => person.id === selectedId) || filtered[0] || null;

  const counts = useMemo(() => {
    const base = {
      total: attendees.length,
      volunteer: attendees.filter((p) => p.volunteer).length,
      sessionLead: attendees.filter((p) => p.sessionLead).length,
      needsFollowup: attendees.filter((p) => p.status === 'needs_followup').length,
    };
    return base;
  }, [attendees]);

  const updateStatus = async (status) => {
    if (!selected?.id || !status) {
      setActionMsg('No attendee selected.');
      return;
    }
    setStatusBusy(true);
    setActionMsg('');
    try {
      const data = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/attendees`, {
        method: 'PATCH',
        body: JSON.stringify({ id: selected.id, status }),
      });
      const updated = data?.attendee;
      if (!updated?.id) throw new Error('No attendee returned');
      setAttendees((prev) => prev.map((row) => row.id === updated.id ? updated : row));
      setSelectedId(updated.id);
      setActionMsg(`Status updated to ${STATUS_META[status]?.label || status}.`);
    } catch (e) {
      setActionMsg(String(e?.message || e || 'Failed to update attendee'));
    } finally {
      setStatusBusy(false);
    }
  };

  const sendConfirmation = async () => {
    if (!selected?.id) {
      setActionMsg('No attendee selected.');
      return;
    }
    setConfirmationBusy(true);
    setActionMsg('');
    try {
      const data = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/attendees`, {
        method: 'PATCH',
        body: JSON.stringify({ id: selected.id, action: 'send_confirmation' }),
      });
      const updated = data?.attendee;
      if (!updated?.id) throw new Error('No attendee returned');
      setAttendees((prev) => prev.map((row) => row.id === updated.id ? updated : row));
      setSelectedId(updated.id);
      setActionMsg('Confirmation email accepted by Resend.');
    } catch (e) {
      setActionMsg(String(e?.message || e || 'Failed to send confirmation'));
    } finally {
      setConfirmationBusy(false);
    }
  };

  const sendReminder = async () => {
    if (!selected?.id) {
      setActionMsg('No attendee selected.');
      return;
    }
    setReminderBusy(true);
    setActionMsg('');
    try {
      const data = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/attendees`, {
        method: 'PATCH',
        body: JSON.stringify({ id: selected.id, action: 'send_reminder' }),
      });
      const updated = data?.attendee;
      if (!updated?.id) throw new Error('No attendee returned');
      setAttendees((prev) => prev.map((row) => row.id === updated.id ? updated : row));
      setSelectedId(updated.id);
      setActionMsg('Reminder email sent.');
    } catch (e) {
      setActionMsg(String(e?.message || e || 'Failed to send reminder'));
    } finally {
      setReminderBusy(false);
    }
  };

  const deleteAttendee = async () => {
    if (!selected?.id) {
      setActionMsg('No attendee selected.');
      return;
    }

    const label = selected.name || selected.email || 'this RSVP';
    if (!window.confirm(`Delete ${label}'s RSVP record? This permanently removes the test record from DPG.`)) {
      return;
    }

    setDeleteBusy(true);
    setActionMsg('');
    try {
      const data = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/attendees`, {
        method: 'DELETE',
        body: JSON.stringify({ id: selected.id }),
      });
      if (!data?.deleted) throw new Error('RSVP_DELETE_NOT_CONFIRMED');

      const deletedId = selected.id;
      const qs = new URLSearchParams(location.search || '');
      qs.delete('attendee');
      navigate(qs.toString() ? `?${qs.toString()}` : '.', { replace: true });

      // Reload from the backend instead of trusting an optimistic local removal.
      // If a stale/legacy record somehow still exists, it remains visible and the
      // delete is not falsely presented as successful.
      await loadAttendees();
      setSelectedId((prev) => prev === deletedId ? null : prev);

      const legacyNote = Number(data?.legacyDeletedCount || 0) > 0
        ? ' Legacy alias copy removed too.'
        : '';
      setActionMsg(`RSVP record deleted and verified.${legacyNote}`);
    } catch (e) {
      setActionMsg(String(e?.message || e || 'Failed to delete RSVP'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const exportCsv = () => {
    const quote = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
    const header = [
      'name','email','status','volunteer','session_lead','access_notes','notes','source',
      'confirmation_sent_at','reminder_sent_at','reminder_count','email_error','created_at','updated_at'
    ];
    const lines = attendees.map((row) => [
      row.name,
      row.email,
      row.status,
      row.volunteer ? 'yes' : 'no',
      row.sessionLead ? 'yes' : 'no',
      row.access,
      row.notes,
      row.source,
      row.confirmationSentAt ? new Date(row.confirmationSentAt).toISOString() : '',
      row.reminderSentAt ? new Date(row.reminderSentAt).toISOString() : '',
      row.reminderCount || 0,
      row.emailError || '',
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
      row.updatedAt ? new Date(row.updatedAt).toISOString() : '',
    ].map(quote).join(','));

    const blob = new Blob([[header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dpg-attendees.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setActionMsg(`Exported ${attendees.length} attendee${attendees.length === 1 ? '' : 's'}.`);
  };

  const openFullProfile = async () => {
    if (!selected?.id) {
      setActionMsg('No attendee selected.');
      return;
    }
    const qs = new URLSearchParams(location.search || '');
    qs.set('attendee', selected.id);
    const url = `${window.location.origin}${window.location.pathname}?${qs.toString()}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setActionMsg('Profile link copied.');
      } else {
        navigate(`?${qs.toString()}`);
        setActionMsg('Profile link ready in the address bar.');
      }
    } catch {
      navigate(`?${qs.toString()}`);
      setActionMsg('Profile link ready in the address bar.');
    }
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: 8 }}>Attendees</h1>
            <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--muted)' }}>
              DPG RSVP pipeline for confirmations, logistics-form progress, reminders, volunteer interest,
              access notes, and organizer follow-up.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'start', flexWrap: 'wrap' }}>
            <a className="btn-red" href="/rsvp" style={{ textDecoration: 'none' }}>Capture RSVP</a>
            <button className="btn" type="button" onClick={loadAttendees} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="btn" type="button" onClick={exportCsv} disabled={!attendees.length}>Export CSV</button>
          </div>
        </div>
      </div>

      {loadMsg ? (
        <div className="helper" style={{ color: 'tomato' }}>{loadMsg}</div>
      ) : null}
      {emailStatus ? (
        <div
          className="helper"
          style={{ color: emailStatus.resendConfigured ? 'var(--muted)' : 'tomato' }}
        >
          Email: {emailStatus.resendConfigured
            ? `Resend ready · relay online · ${emailStatus.from} · logistics form ${emailStatus.rsvpFormUrl}`
            : emailStatus.relayError
              ? `Resend unavailable · ${emailStatus.relayError}`
              : 'Resend is not available to the running app.'}
        </div>
      ) : null}
      {actionMsg ? (
        <div className="helper" style={{ color: actionMsg.toLowerCase().includes('failed') ? 'tomato' : 'var(--muted)' }}>{actionMsg}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <StatCard label="Total tracked" value={counts.total} helper="Everyone currently in the RSVP pipeline." />
        <StatCard label="Volunteers" value={counts.volunteer} helper="People who already raised a hand to help." />
        <StatCard label="Potential session leads" value={counts.sessionLead} helper="People offering to lead or hold space." />
        <StatCard label="Needs follow-up" value={counts.needsFollowup} helper="People who still need organizer attention." />
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(220px, 1.3fr) minmax(180px, .8fr)' }}>
          <input
            className="input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, access notes, or organizer notes"
          />
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="captured">Email captured</option>
            <option value="confirmed">Confirmation sent</option>
            <option value="form_started">Form started</option>
            <option value="form_complete">Form complete</option>
            <option value="needs_followup">Needs follow-up</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, .9fr)' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
            <strong>{loading ? 'Loading attendees…' : 'Tracked people'}</strong>
          </div>
          <div style={{ display: 'grid' }}>
            {filtered.length ? filtered.map((person) => {
              const active = person.id === selected?.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(person.id);
                    const qs = new URLSearchParams(location.search || '');
                    qs.set('attendee', person.id);
                    navigate(`?${qs.toString()}`);
                  }}
                  style={{
                    textAlign: 'left',
                    background: active ? 'rgba(95,148,221,.18)' : 'rgba(255,255,255,0.04)',
                    color: 'var(--text)',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    borderRadius: 0,
                    padding: 16,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800 }}>{person.name}</div>
                    <Pill status={person.status} />
                  </div>
                  <div style={{ color: 'var(--muted)' }}>{person.email}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
                    {person.volunteer ? <span>Volunteer interested</span> : null}
                    {person.sessionLead ? <span>Can lead a session</span> : null}
                    <span>{fmtStamp(person.updatedAt || person.createdAt) ? `Updated ${fmtStamp(person.updatedAt || person.createdAt)}` : 'Recently added'}</span>
                  </div>
                </button>
              );
            }) : (
              <div style={{ padding: 16, color: 'var(--muted)' }}>
                {attendees.length ? 'No attendees match this filter yet.' : 'No RSVP records yet.'}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 18, alignSelf: 'start' }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 8 }}>Attendee detail</div>
                  <h2 style={{ marginTop: 0, marginBottom: 6 }}>{selected.name}</h2>
                  <div style={{ color: 'var(--muted)' }}>{selected.email}</div>
                </div>
                <Pill status={selected.status} />
              </div>

              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 6 }}>Access notes</div>
                  <div>{selected.access}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 6 }}>Organizer notes</div>
                  <div style={{ lineHeight: 1.6 }}>{selected.notes}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="tag">{selected.volunteer ? 'Volunteer interested' : 'No volunteer flag yet'}</span>
                  <span className="tag">{selected.sessionLead ? 'Can lead a session' : 'No session lead flag yet'}</span>
                  <span className="tag">Source: {selected.source || 'public_rsvp'}</span>
                </div>
                <div style={{ display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 14 }}>
                  <div><strong>Created:</strong> {fmtStamp(selected.createdAt) || '—'}</div>
                  <div><strong>Updated:</strong> {fmtStamp(selected.updatedAt) || '—'}</div>
                  <div><strong>Confirmation email:</strong> {fmtStamp(selected.confirmationSentAt) || 'not sent'}</div>
                  <div><strong>Last reminder:</strong> {fmtStamp(selected.reminderSentAt) || 'none'}{selected.reminderCount ? ` · ${selected.reminderCount} sent` : ''}</div>
                  {selected.emailError ? <div style={{ color: 'tomato' }}><strong>Email error:</strong> {selected.emailError}</div> : null}
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>
                    RSVP status
                  </span>
                  <select
                    className="input"
                    value={selected.status || 'captured'}
                    onChange={(e) => updateStatus(e.target.value)}
                    disabled={statusBusy}
                  >
                    <option value="captured">Email captured</option>
                    <option value="confirmed">Confirmation sent</option>
                    <option value="form_started">Form started</option>
                    <option value="form_complete">Form complete</option>
                    <option value="needs_followup">Needs follow-up</option>
                    <option value="reviewed">Reviewed</option>
                  </select>
                </label>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={sendConfirmation}
                    disabled={confirmationBusy || !selected.email || emailStatus?.resendConfigured === false}
                  >
                    {confirmationBusy
                      ? 'Sending…'
                      : selected.confirmationSentAt
                        ? 'Resend confirmation'
                        : 'Send confirmation'}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={sendReminder}
                    disabled={reminderBusy || !selected.email || selected.status === 'form_complete' || emailStatus?.resendConfigured === false}
                    title={selected.status === 'form_complete' ? 'This attendee is marked form complete.' : ''}
                  >
                    {reminderBusy ? 'Sending…' : 'Send logistics reminder'}
                  </button>
                  {permissions.can_delete ? (
                    <button
                      className="btn-red"
                      type="button"
                      onClick={deleteAttendee}
                      disabled={deleteBusy}
                    >
                      {deleteBusy ? 'Deleting…' : 'Delete RSVP'}
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--muted)' }}>Select an attendee to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
