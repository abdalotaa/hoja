import { cleanGlossary } from "./vocabulary";

/** Names and terms the person wants spelled right (people, clients, projects). Kept in this browser. */

const KEY = "hoja.glossary";

export function loadGlossary(): string {
  try {
    return cleanGlossary(localStorage.getItem(KEY));
  } catch {
    return "";
  }
}

export function saveGlossary(value: string): void {
  try {
    localStorage.setItem(KEY, cleanGlossary(value));
  } catch {
    // storage may be blocked; the glossary then only lasts for this session
  }
}
