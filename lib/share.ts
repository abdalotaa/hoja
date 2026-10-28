import type { Link } from "./model";
import type { Note } from "./notes";
import { getBrowserClient } from "./supabase/client";

function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Saves a read-only snapshot of the canvas and returns its public URL. */
export async function createShare(notes: Note[], links: Link[], title: string): Promise<string> {
  const t = token();
  const snapshot = {
    notes: notes.map(({ id, title, text, tone, kind, x, y, w, h, z }) => ({ id, title, text, tone, kind: kind ?? "note", x, y, w, h, z })),
    links: links.map(({ id, from, to }) => ({ id, from, to })),
  };
  const { error } = await getBrowserClient().from("shares").insert({ token: t, title: title.slice(0, 200), snapshot });
  if (error) throw error;
  return `${window.location.origin}/s/${t}`;
}

export async function stopSharing(): Promise<void> {
  const db = getBrowserClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return;
  const { error } = await db.from("shares").delete().eq("user_id", user.user.id);
  if (error) throw error;
}
