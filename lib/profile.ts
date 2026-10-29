/** The display name lives in the Supabase user's metadata, so it needs no database change. */
export const MAX_NAME = 60;

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

export function displayName(meta: unknown): string {
  const name = (meta as { name?: unknown } | null | undefined)?.name;
  return typeof name === "string" ? cleanName(name) : "";
}
