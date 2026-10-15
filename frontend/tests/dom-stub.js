// Minimal browser-storage stub for the headless render check. It is imported first so the
// demo service reads and writes its own keys instead of logging storage failures under Node.
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(String(key)) ? store.get(String(key)) : null),
  setItem: (key, value) => { store.set(String(key), String(value)); },
  removeItem: key => { store.delete(String(key)); },
  clear: () => store.clear(),
  get length() { return store.size; },
  key: index => [...store.keys()][index] ?? null
};
export default globalThis.localStorage;
