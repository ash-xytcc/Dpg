// In-memory edit history. Saving does not clear it; changing documents does.
export function createDocumentHistory(limit = 200) {
  let key;
  let entries = [];
  let index = -1;
  const same = (a, b) => a?.title === b?.title && a?.content === b?.content;
  return {
    record(documentKey, snapshot) {
      if (key !== documentKey) {
        key = documentKey;
        entries = [snapshot];
        index = 0;
      } else if (!same(entries[index], snapshot)) {
        entries = [...entries.slice(0, index + 1), snapshot].slice(-limit);
        index = entries.length - 1;
      }
    },
    undo() { return index > 0 ? entries[--index] : null; },
    redo() { return index < entries.length - 1 ? entries[++index] : null; },
    get canUndo() { return index > 0; },
    get canRedo() { return index < entries.length - 1; },
  };
}

export function historyShortcut(event) {
  if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return null;
  const key = String(event.key).toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  return null;
}
