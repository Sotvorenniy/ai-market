// Hash routes (GitHub Pages has no server-side rewrites). See catalog/docs/spec.md §6.
//   #/                                   home
//   #/search?q=&kind=skill,agent&kw=&author=&sort=
//   #/plugin/<name>                      plugin page
//   #/item/<plugin>/<type>/<name>        artifact page (#/item/<plugin> redirects to the plugin page)
//   #/whats-new  #/get-started

export const SORTS = ['relevance', 'name', 'updated'];
export const SEARCH_DEFAULTS = { q: '', kinds: [], keywords: [], author: null, sort: 'relevance' };

const list = (value) => (value ? value.split(',').map((v) => v.trim()).filter(Boolean) : []);

/** @returns {{ view: string, params: URLSearchParams, name?: string, itemId?: string }} */
export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const queryStart = raw.indexOf('?');
  const path = queryStart === -1 ? raw : raw.slice(0, queryStart);
  const params = new URLSearchParams(queryStart === -1 ? '' : raw.slice(queryStart + 1));
  let segments;
  try {
    segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { view: 'home', params: new URLSearchParams() };
  }
  const [first, ...rest] = segments;
  if (!first) return { view: 'home', params };
  if (first === 'search' && !rest.length) return { view: 'search', params };
  if (first === 'plugin' && rest.length === 1) return { view: 'plugin', params, name: rest[0] };
  if (first === 'item' && rest.length === 1) return { view: 'plugin', params, name: rest[0] };
  if (first === 'item' && rest.length === 3) return { view: 'artifact', params, itemId: rest.join('/') };
  if ((first === 'whats-new' || first === 'get-started') && !rest.length) return { view: first, params };
  return { view: 'home', params: new URLSearchParams() };
}

/** Search state from URL params; unknown kinds and sorts are dropped. */
export function searchState(params, kinds) {
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    kinds: list(params.get('kind')).filter((k) => kinds.includes(k)),
    keywords: list(params.get('kw')),
    author: params.get('author') || null,
    sort: SORTS.includes(sort) ? sort : 'relevance',
  };
}

export function searchHash(state) {
  const params = new URLSearchParams();
  if (state.q?.trim()) params.set('q', state.q.trim());
  if (state.kinds?.length) params.set('kind', state.kinds.join(','));
  if (state.keywords?.length) params.set('kw', state.keywords.join(','));
  if (state.author) params.set('author', state.author);
  if (state.sort && state.sort !== 'relevance') params.set('sort', state.sort);
  const query = params.toString().replace(/%2C/g, ',');
  return query ? `#/search?${query}` : '#/search';
}

export const pluginHash = (name) => `#/plugin/${encodeURIComponent(name)}`;

/** Link for any catalog item: plugins get the plugin page, everything else the artifact page. */
export function itemHash(id) {
  return id.includes('/') ? `#/item/${id.split('/').map(encodeURIComponent).join('/')}` : pluginHash(id);
}
