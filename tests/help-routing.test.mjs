import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_TOPICS, guessTopicIdFromPath } from '../src/help/helpContent.js';

test('every workspace page resolves to its own supported guide', () => {
  const pages = {
    overview: 'getting-started', attendees: 'attendees', people: 'people',
    inventory: 'inventory', needs: 'needs', meetings: 'meetings',
    'meetings/123': 'meetings', settings: 'invites', 'site-editor': 'site-editor',
    drive: 'drive', studio: 'studio', sessions: 'sessions', videos: 'videos',
    public: 'public-page', chat: 'chat', 'guard/keys': 'security',
  };
  for (const [page, expected] of Object.entries(pages)) {
    assert.equal(guessTopicIdFromPath(`/org/real-org/${page}`), expected);
    assert.ok(HELP_TOPICS.some(({ id }) => id === expected));
  }
  assert.equal(guessTopicIdFromPath('/org/real-org'), 'getting-started');
});

test('settings query selects help without a pathname change', () => {
  for (const tab of ['invites', 'members', 'profile', 'security', 'newsletter']) {
    assert.equal(guessTopicIdFromPath('/org/123/settings', `?tab=${tab}`), tab);
  }
  assert.equal(guessTopicIdFromPath('/org/123/settings?tab=newsletter'), 'newsletter');
  // These retired panels are not reachable in Settings.jsx.
  for (const tab of ['org', 'public', 'public-inbox', 'pledges', 'unknown']) {
    assert.equal(guessTopicIdFromPath('/org/123/settings', `?tab=${tab}`), 'invites');
  }
});

test('organization IDs and public slugs cannot hijack the page topic', () => {
  assert.equal(guessTopicIdFromPath('/org/security-chat/drive'), 'drive');
  assert.equal(guessTopicIdFromPath('/bulletin/security-news'), 'bulletin');
  assert.equal(guessTopicIdFromPath('/p/meetings'), 'public-page');
  assert.equal(guessTopicIdFromPath('/dpg/app/attendees'), 'attendees');
  assert.equal(guessTopicIdFromPath('/signin'), 'sign-in');
  assert.equal(guessTopicIdFromPath('/orgs'), 'getting-started');
  assert.equal(guessTopicIdFromPath('/demo'), 'demo-mode');
});

test('all contextual topics exist and topic IDs are unique', () => {
  const ids = HELP_TOPICS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['forms', 'sheets', 'studio', 'studio-text', 'studio-images', 'studio-assets', 'studio-mobile']) {
    assert.ok(ids.includes(id));
  }
  for (const topic of HELP_TOPICS) {
    assert.ok(topic.title && topic.blurb && topic.sections.length);
    for (const section of topic.sections) assert.ok(section.h && section.p.every(Boolean));
  }
});
