// Catalog search: plain-language queries over catalog items. Pure functions, no DOM access.
// Algorithm and weights: catalog/docs/spec.md §5. Tunables live in search-config.json.

const FIELDS = ['name', 'tags', 'description', 'plugin', 'body'];

/** Lowercases and splits text into words on anything that is not a-z or 0-9. */
export function words(text) {
  return String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Strips a plural "s" from words longer than 3 letters ("tests" → "test", but not "class"). */
export function stem(word) {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

export function tokens(text) {
  return words(text).map(stem);
}

/**
 * Edit distance where a swap of two neighbouring letters counts as one edit ("reveiw" → "review").
 * Returns 2 early when the lengths alone rule out a distance of 0 or 1.
 */
export function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** How well one query term matches one indexed token: 1 exact, 0.75/0.6 prefix, 0.55 one typo, 0 none. */
export function termMatch(term, token) {
  if (term === token) return 1;
  if (term.length >= 3 && token.startsWith(term)) return 0.75;
  if (token.length >= 4 && term.startsWith(token)) return 0.6;
  if (term.length >= 5 && token.length >= 5 && editDistance(term, token) <= 1) return 0.55;
  return 0;
}

/** Normalizes search-config.json: stems synonym keys and values, builds lookup sets. */
export function prepareConfig(raw) {
  const synonyms = new Map();
  for (const [key, values] of Object.entries(raw.synonyms ?? {})) {
    const list = synonyms.get(stem(key)) ?? [];
    for (const value of values.flatMap(tokens)) if (!list.includes(value)) list.push(value);
    synonyms.set(stem(key), list);
  }
  return {
    fieldWeights: { name: 5, tags: 4, description: 2.5, plugin: 1.5, body: 1, ...raw.fieldWeights },
    relatedWeight: raw.relatedWeight ?? 0.4,
    typeBoost: raw.typeBoost ?? 1.6,
    minScore: raw.minScore ?? 1,
    typeWords: new Map(Object.entries(raw.typeWords ?? {})),
    stopWords: new Set(raw.stopWords ?? []),
    synonyms,
    examples: raw.examples ?? [],
  };
}

/**
 * Builds the search index once after catalog.json loads.
 * The vocabulary maps every distinct token to the items and fields it occurs in, so a query term is
 * compared with each distinct token once instead of with every token of every item.
 */
export function createIndex(items, config) {
  const vocabulary = new Map();
  items.forEach((item, index) => {
    const fields = {
      name: tokens(item.name),
      tags: tokens((item.tags ?? []).join(' ')),
      description: tokens(item.description),
      plugin: tokens(item.plugin),
      body: tokens(item.body),
    };
    for (const field of FIELDS) {
      for (const token of new Set(fields[field])) {
        if (!vocabulary.has(token)) vocabulary.set(token, []);
        vocabulary.get(token).push(index, field);
      }
    }
  });
  return { items, vocabulary, config };
}

/**
 * Splits a query into search terms, related terms from synonyms and an optional type hint.
 * "I need a skill to review pull requests" → terms [review, pull, request], typeHint "skill".
 */
export function parseQuery(query, config) {
  const terms = [];
  let typeHint = null;
  for (const word of words(query)) {
    if (config.typeWords.has(word)) {
      typeHint = config.typeWords.get(word);
      continue;
    }
    if (config.stopWords.has(word)) continue;
    const term = stem(word);
    if (!terms.includes(term)) terms.push(term);
  }
  const related = [];
  for (const term of terms) {
    for (const synonym of config.synonyms.get(term) ?? []) {
      if (!terms.includes(synonym) && !related.includes(synonym)) related.push(synonym);
    }
  }
  return { terms, related, typeHint };
}

// For one term: Map<itemIndex, weighted score over fields> using the best match per field.
function scoreTerm(index, term) {
  const { vocabulary, config } = index;
  const best = new Map();
  for (const [token, postings] of vocabulary) {
    const match = termMatch(term, token);
    if (!match) continue;
    for (let i = 0; i < postings.length; i += 2) {
      const key = `${postings[i]}:${postings[i + 1]}`;
      if ((best.get(key) ?? 0) < match) best.set(key, match);
    }
  }
  const perItem = new Map();
  for (const [key, match] of best) {
    const [itemIndex, field] = key.split(':');
    const i = Number(itemIndex);
    perItem.set(i, (perItem.get(i) ?? 0) + config.fieldWeights[field] * match);
  }
  return perItem;
}

const byName = (a, b) => a.item.name.localeCompare(b.item.name) || a.item.id.localeCompare(b.item.id);

/**
 * Runs a query. Returns the parsed query and results sorted best first.
 * Empty query: every item (or every item of the hinted type) with score 0, sorted by name.
 * @returns {{ parsed: ReturnType<typeof parseQuery>, results: { item: object, score: number }[] }}
 */
export function search(index, query) {
  const { items, config } = index;
  const parsed = parseQuery(query, config);

  if (!parsed.terms.length) {
    const results = items
      .filter((item) => !parsed.typeHint || item.type === parsed.typeHint)
      .map((item) => ({ item, score: 0 }))
      .sort(byName);
    return { parsed, results };
  }

  const scores = new Map();
  const matched = new Map();
  for (const term of parsed.terms) {
    for (const [i, score] of scoreTerm(index, term)) {
      scores.set(i, (scores.get(i) ?? 0) + score);
      matched.set(i, (matched.get(i) ?? 0) + 1);
    }
  }
  for (const term of parsed.related) {
    for (const [i, score] of scoreTerm(index, term)) {
      scores.set(i, (scores.get(i) ?? 0) + config.relatedWeight * score);
    }
  }

  const results = [];
  for (const [i, raw] of scores) {
    const item = items[i];
    let score = raw * (0.4 + 0.6 * ((matched.get(i) ?? 0) / parsed.terms.length));
    if (parsed.typeHint && item.type === parsed.typeHint) score *= config.typeBoost;
    if (score >= config.minScore) results.push({ item, score });
  }
  results.sort((a, b) => b.score - a.score
    || (b.item.type === 'plugin') - (a.item.type === 'plugin')
    || byName(a, b));
  return { parsed, results };
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Returns HTML with words that start with any of the terms wrapped in <mark>.
 * Matching runs on the raw text and every segment is escaped, so markup in the text can never be injected
 * and terms never match inside escaped entities.
 */
export function highlight(text, terms) {
  const source = String(text ?? '');
  const list = [...new Set(terms)].filter((t) => /^[a-z0-9]{2,}$/.test(t)).sort((a, b) => b.length - a.length);
  if (!list.length) return escapeHtml(source);
  const pattern = new RegExp(`(?<![a-z0-9])(?:${list.join('|')})[a-z0-9]*`, 'gi');
  let html = '';
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    html += `${escapeHtml(source.slice(last, match.index))}<mark>${escapeHtml(match[0])}</mark>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(last));
}
