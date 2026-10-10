export const GROCERY_CATEGORIES = ['Groente', 'Fruit', 'Brood & wraps', 'Zuivel & vega', 'Vlees & vis', 'Diepvries', 'Voorraadkast', 'Kruiden & sauzen', 'Drinken', 'Schoonmaak', 'Overig'];

export function normalizeProductKey(title) {
  return String(title || '').toLowerCase().replace(/^[✓✔]\s*/, '').replace(/\s+/g, ' ').trim();
}

const RULES = [
  ['Schoonmaak', ['afwasmiddel', 'wasmiddel', 'vaatwastablet', 'schoonmaak', 'allesreiniger', 'bleek', 'spons', 'vuilniszak']],
  ['Drinken', ['koffie', 'thee', 'sap', 'frisdrank', 'water', 'bier', 'wijn', 'drinken']],
  ['Diepvries', ['diepvries', 'frozen', 'gyoza', 'ijs', 'doperwten']],
  ['Vlees & vis', ['kipfilet', 'kippen', 'kip', 'chicken', 'rund', 'gehakt', 'vlees', 'vis', 'zalm', 'tonijn', 'worst']],
  ['Zuivel & vega', ['melk', 'kaas', 'parmezaan', 'boter', 'yoghurt', 'room', 'eieren', 'ei', 'vegan ranch', 'vega', 'tofu', 'tempeh']],
  ['Brood & wraps', ['brood', 'lavash', 'tortilla', 'wrap', 'bolletje', 'stokbrood', 'cracker']],
  ['Kruiden & sauzen', ['zout', 'salt', 'peper', 'pepper', 'olie', 'oil', 'saus', 'sauce', 'sojasaus', 'gochujang', 'tomatenpuree', 'pindakaas', 'seasoning', 'kruid', 'bouillon', 'maple syrup']],
  ['Fruit', ['limoen', 'citroen', 'appel', 'peer', 'banaan', 'sinaasappel', 'mango', 'fruit', 'aardbei', 'druif']],
  ['Groente', ['spinazie', 'paksoi', 'courgette', 'ui', 'onion', 'knoflook', 'garlic', 'champignon', 'gember', 'bosui', 'tomaat', 'tomato', 'lettuce', 'sla', 'paprika', 'komkommer', 'wortel', 'groente', 'prei', 'kool', 'broccoli']],
  ['Voorraadkast', ['rijst', 'risotto', 'pasta', 'noedel', 'udon', 'meel', 'suiker', 'pinda', 'noten', 'kokosmelk', 'kikkererwt', 'chickpea', 'blik', 'can ']]
];

export function categorizeProduct(title) {
  const value = String(title || '').toLowerCase();
  const hasKeyword = keyword => (keyword.trim().length <= 3
    ? new RegExp(`(^|[^a-zà-ÿ])${keyword.trim()}([^a-zà-ÿ]|$)`, 'i').test(value)
    : value.includes(keyword));
  return RULES.find(([, keywords]) => keywords.some(hasKeyword))?.[0] || 'Overig';
}

/** Tekst (✓ = afgevinkt) of JSON-lijst naar boodschappen {name, done, category}. */
export function parseGroceryText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  if (/^[[{]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : parsed.groceries;
      if (Array.isArray(items)) {
        return items.map(item => (typeof item === 'string' ? { title: item } : item))
          .filter(item => item && (item.title || item.name))
          .map(item => {
            const name = String(item.title || item.name).trim();
            return { name, done: Boolean(item.done), category: item.category || categorizeProduct(name) };
          });
      }
    } catch { /* val terug op regels */ }
  }
  return trimmed.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !/^grocery list$/i.test(line))
    .map(line => {
      const done = /^[✓✔]\s*/.test(line);
      const name = line.replace(/^[✓✔]\s*/, '').replace(/^[-•]\s*/, '').trim();
      return { name, done, category: categorizeProduct(name) };
    }).filter(item => item.name);
}

/** Voegt toe zonder dubbelen; bestaande items worden nooit overschreven (behalve afvinken/categorie aanvullen). */
export function mergeGroceries(existing, incoming, makeId) {
  const list = existing.slice();
  let added = 0, updated = 0;
  incoming.forEach(item => {
    const key = normalizeProductKey(item.name);
    const found = list.find(candidate => normalizeProductKey(candidate.name) === key);
    if (found) {
      if (item.done && !found.done) { found.done = true; updated += 1; }
      if (!found.category || found.category === 'Overig') found.category = item.category;
      return;
    }
    list.push({ id: makeId(), name: item.name, quantity: item.quantity || '', done: Boolean(item.done), category: item.category || categorizeProduct(item.name) });
    added += 1;
  });
  return { list, added, updated };
}

export function groupGroceries(items) {
  return GROCERY_CATEGORIES.map(category => ({
    category,
    items: items.filter(item => (GROCERY_CATEGORIES.includes(item.category) ? item.category : categorizeProduct(item.name)) === category)
  })).filter(group => group.items.length);
}
