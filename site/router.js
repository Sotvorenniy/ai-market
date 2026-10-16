// Hash routes (GitHub Pages has no server-side rewrites). See docs/specs/catalog-site.md §6.
//   #/                                  browse, with ?q=&type=&category=&sort=
//   #/item/<plugin>                     plugin page
//   #/item/<plugin>/<type>/<name>       artifact page
//   #/stack  #/whats-new  #/get-started

export const PAGES = ['stack', 'whats-new', 'get-started'];
export const BROWSE_DEFAULTS = { q: '', type: 'all', category: 'all', sort: 'relevance' };

/** @returns {{ view: string, params: URLSearchParams, itemId?: string }} */
export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const queryStart = raw.indexOf('?');
  const path = queryStart === -1 ? raw : raw.slice(0, queryStart);
  const params = new URLSearchParams(queryStart === -1 ? '' : raw.slice(queryStart + 1));
  let segments;
  try {
    segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { view: 'browse', params: new URLSearchParams() };
  }
  if (!segments.length) return { view: 'browse', params };
  if (segments[0] === 'item' && (segments.length === 2 || segments.length === 4)) {
    return { view: 'item', params, itemId: segments.slice(1).join('/') };
  }
  if (segments.length === 1 && PAGES.includes(segments[0])) return { view: segments[0], params };
  return { view: 'browse', params: new URLSearchParams() };
}

/** Browse state from URL params, with unknown values replaced by defaults. */
export function browseState(params, { types, categories }) {
  const type = params.get('type');
  const category = params.get('category');
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    type: types.includes(type) ? type : BROWSE_DEFAULTS.type,
    category: categories.includes(category) ? category : BROWSE_DEFAULTS.category,
    sort: ['relevance', 'updated', 'name'].includes(sort) ? sort : BROWSE_DEFAULTS.sort,
  };
}

/** URL for a browse state; default values are left out so plain searches stay short. */
export function browseHash(state) {
  const params = new URLSearchParams();
  for (const key of ['q', 'type', 'category', 'sort']) {
    const value = key === 'q' ? state.q.trim() : state[key];
    if (value && value !== BROWSE_DEFAULTS[key]) params.set(key, value);
  }
  const query = params.toString();
  return query ? `#/?${query}` : '#/';
}

export function itemHash(id) {
  return `#/item/${id.split('/').map(encodeURIComponent).join('/')}`;
}
