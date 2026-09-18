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

  const loadAttendees = React.useCallback(async () => {
    setLoading(true);
    setLoadMsg('');
    try {
      const data = await authFetch(`/api/orgs/${encodeURIComponent(orgId)}/attendees`);
      const rows = Array.isArray(data?.attendees) ? data.attendees : [];
      setAttendees(rows);
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

  const markReviewed = async () => {
    if (!selected?.id) {
      setActionMsg('No attendee selected.');
      return;
    }
    setActionMsg('');
    try {
      const res = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/attendees`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: selected.id, status: 'reviewed' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      const updated = data?.attendee;
      if (!updated?.id) throw new Error('No attendee returned');
      setAttendees((prev) => prev.map((row) => row.id === updated.id ? updated : row));
      setSelectedId(updated.id);
      setActionMsg('Marked reviewed.');
    } catch (e) {
      setActionMsg(String(e?.message || e || 'Failed to update attendee'));
    }
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
              First-pass DPG attendee pipeline. This is where email capture, confirmation state, follow-up form progress,
              volunteer interest, access notes, and organizer-facing coordination will live.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'start', flexWrap: 'wrap' }}>
            <a className="btn-red" href="/rsvp" style={{ textDecoration: 'none' }}>Capture RSVP</a>
            <button className="btn" type="button" onClick={loadAttendees} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="btn" type="button">Export CSV</button>
          </div>
        </div>
      </div>

      {loadMsg ? (
        <div className="helper" style={{ color: 'tomato' }}>{loadMsg}</div>
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
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn" type="button" disabled title="Reminder sending will be wired with Resend next">
                    Send reminder
                  </button>
                  <button className="btn" type="button" onClick={markReviewed}>
                    Mark reviewed
                  </button>
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
