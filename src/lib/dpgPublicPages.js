export const DPG_PUBLIC_PAGES = {
  about: {
    slug: "about",
    title: "About",
    eyebrow: "Dual Power Gathering",
    featureImage: "",
    html: `
      <p>Dual Power Gathering is a gathering for learning, sharing, building, and reflection across anti-authoritarian and anti-capitalist movements.</p>
      <p>We are building a space for trust, skill sharing, solidarity, and collective exploration. The point is not polished conference culture. The point is relationships, courage, and practical capacity.</p>
      <p>This public site is the front door. Organizer tools, internal logistics, and planning live behind sign-in.</p>
    `,
  },

  faq: {
    slug: "faq",
    title: "FAQ",
    eyebrow: "Questions people keep asking because apparently reading minds is still not a feature.",
    featureImage: "",
    html: `
      <p><strong>What is Dual Power?</strong></p>
      <p>Dual power is the project of building self determination, mutual aid, solidarity, and direct democracy in our communities by creating spaces that empower us all and from which new emancipatory institutions can emerge.</p>

      <p><strong>Who is organizing Dual Power Gathering?</strong></p>
      <p>Dual Power Gathering is an autonomous event being organized by a developing network of tenants, workers, and activists participating in Symbiosis Federation, Autonomous Tenants Union Network, the Industrial Workers of the World, and independent dual power projects across the country. We are not affiliated with any political party.</p>

      <p><strong>Why do we think this is important?</strong></p>
      <p>We come together from across the spectrum of anti-authoritarian and anti-capitalist tendencies, traditions, and organizations. We want a space where people can build trusting relationships, construct bridges, share ideas, and strengthen each other.</p>

      <p><strong>What kind of event is this?</strong></p>
      <p>The gathering uses an unconference structure. That means participants help create the agenda, shape sessions, and bring their own ideas, skills, and questions into the space.</p>

      <p><strong>Will it be child friendly?</strong></p>
      <p>Several core organizers have children and they will be part of the event. Child-friendly planning is part of the event culture, not an afterthought.</p>

      <p><strong>What happens after the gathering?</strong></p>
      <p>We are not imposing a predetermined outcome. What comes next will be defined locally, and the networks built through the gathering will help inform, grow, and articulate the movements that emerge from it.</p>
    `,
  },

  volunteer: {
    slug: "volunteer",
    title: "Volunteer",
    eyebrow: "This only works if people actually help, tragic but true.",
    featureImage: "",
    html: `
      <h2>We need your help</h2>
      <p>We need all kinds of help in advance of and during the Western Dual Power Gathering to pull these events off.</p>

      <p><strong>Current areas of need include:</strong></p>
      <ul>
        <li>Food and kitchen support</li>
        <li>Transportation</li>
        <li>Childcare</li>
        <li>Outreach and getting the word out</li>
        <li>Camping gear sharing and sourcing</li>
        <li>Fundraising</li>
        <li>Facilitation</li>
        <li>Organizing and logistics</li>
        <li>Communications</li>
        <li>Training, workshops, and session support</li>
      </ul>

      <p>We are looking for people who want to help during the event as well as people who want to help plan and organize beforehand.</p>
      <p>If you want to get involved, email <a href="mailto:dualpowergathering@proton.me">dualpowergathering@proton.me</a>.</p>
    `,
  },

  donate: {
    slug: "donate",
    title: "Donate",
    eyebrow: "Money is fake and yet unfortunately still useful.",
    featureImage: "",
    html: `
      <p>Dual Power Gathering is free for anyone to attend, but holding the gathering still costs money. Campsites, food, equipment, accessibility support, and travel all add up.</p>
      <p>If you or someone you know would like to support the gathering, donations help make the event more accessible and materially sustainable.</p>
      <p><a href="https://hcb.hackclub.com/donations/start/dual-power-gathering" target="_blank" rel="noreferrer">Donate to Dual Power Gathering</a></p>
      <p>If you need a receipt or have questions, reach out through the organizer contacts.</p>
    `,
  },

  press: {
    slug: "press",
    title: "Press",
    eyebrow: "Media, roundtables, and traces left behind.",
    featureImage: "",
    html: `
      <p>Listen to Sabot Media's round table discussion with participants and organizers of DPG West, reflecting on the gathering and what worked, what changed, and what should grow next.</p>

      <ul>
        <li><a href="https://kolektiva.media/w/2im6KJj8NRBPbZwTxxAuwr" target="_blank" rel="noreferrer">Episode 8: Dual Power Gathering West Roundtable</a></li>
        <li><a href="https://kolektiva.media/w/bfGVFNr6yViDQD2nN8eHez" target="_blank" rel="noreferrer">Molotov Now! interview</a></li>
        <li><a href="https://itsgoingdown.org/this-is-america-189/" target="_blank" rel="noreferrer">This Is America #189</a></li>
      </ul>

      <p>More media, interviews, and reports can be migrated in later once you decide how much of the old archive should live here versus the bulletin feed.</p>
    `,
  },

  "dpg-shares": {
    slug: "dpg-shares",
    title: "DPG Shares",
    eyebrow: "A session archive, media commons, and public memory bank for DPG.",
    featureImage: "",
    html: `
      <p>DPG Shares is the future home for uploaded session recordings, interviews, roundtables, and movement media connected to the gathering.</p>
      <p>The goal is not just a page of links. The goal is a usable public archive with native hosting, collections, and long term access.</p>
    `,
  },

  rsvp: {
    slug: "rsvp",
    title: "RSVP",
    eyebrow: "Planning is easier when humans tell us they are coming.",
    featureImage: "",
    html: `
      <p>Come join us at the Western Dual Power Gathering. Attendance is free, but donations are appreciated.</p>
      <p>There are camping and non-camping options. RSVPing helps organizers plan for food, space, accessibility, and follow-up needs.</p>
      <p>Please RSVP and expect a follow-up email with more detailed questions about needs and logistics.</p>
      <p><a href="/?app=dpg#/signin">Organizer sign in</a> is for internal coordination only. Public RSVP workflow can be refined further in the next phase.</p>
    `,
  },
};

export function getDpgPublicPage(slug) {
  const key = String(slug || "").trim().toLowerCase();
  return DPG_PUBLIC_PAGES[key] || null;
}
