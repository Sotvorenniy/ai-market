// Per-browser preferences in localStorage. Every access is guarded: private windows and blocked storage
// must not break the page, they only lose the saved value.

const PREFIX = 'ai-market:';

export function load(key, fallback) {
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable; keep working without persistence.
  }
}

/** Plugin names selected for "My stack". */
export function createStack(onChange) {
  let names = load('stack', []);
  if (!Array.isArray(names)) names = [];
  return {
    get names() {
      return [...names];
    },
    has: (name) => names.includes(name),
    toggle(name) {
      names = names.includes(name) ? names.filter((n) => n !== name) : [...names, name];
      save('stack', names);
      onChange(names);
      return names.includes(name);
    },
    set(next) {
      names = [...new Set(next)];
      save('stack', names);
      onChange(names);
    },
    /** Drops names that are no longer in the catalog. */
    prune(known) {
      const kept = names.filter((n) => known.has(n));
      if (kept.length !== names.length) this.set(kept);
    },
  };
}
