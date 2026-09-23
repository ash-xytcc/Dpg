import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentHistory, historyShortcut } from '../src/components/drive/documentHistory.js';
const snapshot = (content, title = 'Note') => ({ title, content });

test('typing, cut/paste, formatting and template insertion can be undone and redone', () => {
  const h = createDocumentHistory();
  const edits = ['hello', 'hello world', 'hello ', 'hello pasted', '**hello pasted**', '**hello pasted**\nMeeting template'];
  for (const edit of edits) h.record('org:note:one', snapshot(edit));
  for (const edit of edits.slice(0, -1).reverse()) {
    const restored = h.undo();
    assert.equal(restored.content, edit);
    h.record('org:note:one', restored); // React applies the restored state; autosave follows.
  }
  assert.equal(h.undo(), null);
  for (const edit of edits.slice(1)) {
    const restored = h.redo();
    assert.equal(restored.content, edit);
    h.record('org:note:one', restored);
  }
  assert.equal(h.redo(), null);
});

test('saving unchanged content preserves redo; a new edit discards redo', () => {
  const h = createDocumentHistory();
  h.record('one', snapshot('a'));
  h.record('one', snapshot('b'));
  const restored = h.undo();
  h.record('one', { ...restored });
  assert.equal(h.canRedo, true);
  h.record('one', snapshot('c'));
  assert.equal(h.canRedo, false);
  assert.equal(h.undo().content, 'a');
});

test('title and structured document edits are restored together', () => {
  const h = createDocumentHistory();
  const before = snapshot('{"cells":{"A1":1}}', 'Budget');
  const after = snapshot('{"cells":{"A1":2}}', 'Budget revised');
  h.record('sheet', before);
  h.record('sheet', after);
  assert.deepEqual(h.undo(), before);
  assert.deepEqual(h.redo(), after);
});

test('history cannot cross a document or organization boundary', () => {
  const h = createDocumentHistory();
  h.record('org1:note:one', snapshot('private first'));
  h.record('org1:note:one', snapshot('edited first'));
  h.record('org1:file:two', snapshot('second'));
  assert.equal(h.undo(), null);
  h.record('org2:file:two', snapshot('another organization'));
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), null);
});

test('history has a bounded number of snapshots', () => {
  const h = createDocumentHistory(3);
  for (const value of ['a', 'b', 'c', 'd']) h.record('one', snapshot(value));
  assert.equal(h.undo().content, 'c');
  assert.equal(h.undo().content, 'b');
  assert.equal(h.undo(), null);
});

test('Windows/Linux and Mac undo/redo bindings leave native clipboard shortcuts alone', () => {
  assert.equal(historyShortcut({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(historyShortcut({ key: 'z', metaKey: true }), 'undo');
  assert.equal(historyShortcut({ key: 'y', ctrlKey: true }), 'redo');
  assert.equal(historyShortcut({ key: 'Z', metaKey: true, shiftKey: true }), 'redo');
  assert.equal(historyShortcut({ key: 'Z', ctrlKey: true, shiftKey: true }), 'redo');
  for (const key of ['x', 'c', 'v', 'a']) {
    assert.equal(historyShortcut({ key, ctrlKey: true }), null);
    assert.equal(historyShortcut({ key, metaKey: true }), null);
  }
  for (const flag of ['isComposing', 'altKey', 'defaultPrevented']) {
    assert.equal(historyShortcut({ key: 'z', ctrlKey: true, [flag]: true }), null);
  }
  assert.equal(historyShortcut({ key: 'z' }), null);
});
