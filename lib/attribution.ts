/** Remembers which campaign brought a visitor, so it can be saved with the account they create later. */

const KEY = "hoja:attribution:v1";
const FIELDS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const MAX_LENGTH = 80;

export type Attribution = Partial<Record<(typeof FIELDS)[number], string>>;

/** Reads the utm_* parameters from a query string; empty when there are none. */
export function parseAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  const found: Attribution = {};
  for (const field of FIELDS) {
    const value = params.get(field)?.trim().slice(0, MAX_LENGTH);
    if (value) found[field] = value;
  }
  return found;
}

/** First touch wins: a visit with campaign parameters is stored only if nothing was stored before. */
export function captureAttribution(search: string = window.location.search) {
  try {
    const found = parseAttribution(search);
    if (!Object.keys(found).length || localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, JSON.stringify(found));
  } catch {
    // storage blocked (private mode): the account is still created, just without a campaign
  }
}

export function readAttribution(): Attribution {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseAttribution(new URLSearchParams(JSON.parse(raw)).toString()) : {};
  } catch {
    return {};
  }
}
