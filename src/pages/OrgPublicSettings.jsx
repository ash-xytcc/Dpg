import * as React from 'react';

function randSlug() {
  return Math.random().toString(36).slice(2, 8);
}

const DEFAULT_TITLE = '';
const DEFAULT_ABOUT = '';
const DEFAULT_FEATURES = '';
const DEFAULT_LINKS = '';
const TITLE_PLACEHOLDER = 'Dual Power Gathering Public Info';
const ABOUT_PLACEHOLDER = 'What visitors should know before they arrive.';
const FEATURES_PLACEHOLDER = 'Schedule preview\nAccessibility info\nVolunteer details';
const LINKS_PLACEHOLDER = 'Main site | https://dualpowergathering.org\nRSVP | https://dualpowergathering.org/rsvp';

export default function OrgPublicSettings({ orgId }) {
  const [enabled, setEnabled] = React.useState(false);
  const [slug, setSlug] = React.useState('');
  const [title, setTitle] = React.useState(DEFAULT_TITLE);
  const [about, setAbout] = React.useState(DEFAULT_ABOUT);
  const [features, setFeatures] = React.useState(DEFAULT_FEATURES);
  const [links, setLinks] = React.useState(DEFAULT_LINKS);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(`bf_public_${orgId}`) || '{}');
      if (s.enabled != null) setEnabled(!!s.enabled);
      if (s.slug) setSlug(s.slug);
      if (typeof s.title === 'string') setTitle(s.title);
      if (typeof s.about === 'string') setAbout(s.about);
      if (Array.isArray(s.features)) setFeatures(s.features.join('\n'));
      if (Array.isArray(s.links)) setLinks(s.links.map(l => `${l.text} | ${l.url}`).join('\n'));
    } catch {}
  }, [orgId]);

  const save = (e) => {
    e?.preventDefault();
    const payload = {
      enabled,
      slug: (slug || '').trim(),
      title: (title || '').trim(),
      about: (about || '').trim(),
      features: features.split('\n').map(s=>s.trim()).filter(Boolean),
      links: links.split('\n').map(line => {
        const [text, url] = line.split('|').map(s=> (s||'').trim());
        return url ? { text: text || url, url } : null;
      }).filter(Boolean),
    };

    localStorage.setItem(`bf_public_${orgId}`, JSON.stringify(payload));

    const idx = JSON.parse(localStorage.getItem('bf_public_slug_index') || '{}');
    for (const [k,v] of Object.entries(idx)) if (v === orgId) delete idx[k];
    if (payload.slug) idx[payload.slug] = orgId;
    localStorage.setItem('bf_public_slug_index', JSON.stringify(idx));

    setMsg('Saved.');
    setTimeout(()=>setMsg(''), 1500);
  };

  const gen = () => {
    setSlug(randSlug());
    setMsg('');
  };

  const publicUrl = slug ? `${location.origin}/#/p/${slug}` : null;

  return (
    <div className="card" style={{ padding:16 }}>
      <h3>Public Page</h3>
      <p className="helper">Set up the public-facing page visitors will see without pre-filling your real org data.</p>

      <form onSubmit={save} className="grid" style={{ gap:8, marginTop:8 }}>
        <label className="row" style={{ gap:8, alignItems:'center' }}>
          <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />
          <span>Enable public page</span>
        </label>

        <label className="grid" style={{ gap:6 }}>
          <span className="helper">Share URL (slug)</span>
          <div className="row" style={{ gap:8 }}>
            <input style={{ flex:1 }} value={slug} onChange={e=>setSlug(e.target.value)} placeholder="e.g. dual-power-west" />
            <button type="button" onClick={gen}>Generate</button>
          </div>
          {publicUrl && <a className="helper" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>}
        </label>

        <label className="grid" style={{ gap:6 }}>
          <span className="helper">Title</span>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={TITLE_PLACEHOLDER} />
        </label>

        <label className="grid" style={{ gap:6 }}>
          <span className="helper">About</span>
          <textarea rows={3} value={about} onChange={e=>setAbout(e.target.value)} placeholder={ABOUT_PLACEHOLDER} />
        </label>

        <label className="grid" style={{ gap:6 }}>
          <span className="helper">Features (one per line)</span>
          <textarea rows={3} value={features} onChange={e=>setFeatures(e.target.value)} placeholder={FEATURES_PLACEHOLDER} />
        </label>

        <label className="grid" style={{ gap:6 }}>
          <span className="helper">Links (Text | URL per line)</span>
          <textarea rows={3} value={links} onChange={e=>setLinks(e.target.value)} placeholder={LINKS_PLACEHOLDER} />
        </label>

        <div className="row" style={{ gap:8 }}>
          <button className="btn-red" type="submit">Save</button>
          {msg && <span className={msg.includes('Saved') ? 'success' : 'error'}>{msg}</span>}
        </div>
      </form>
    </div>
  );
}
