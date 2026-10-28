import { getBrowserClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/notes";

interface Row {
  id: string;
  title: string;
  text: string;
  tone: Note["tone"];
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  updated_at: number;
}

const toRow = (n: Note): Row => ({
  id: n.id,
  title: n.title,
  text: n.text,
  tone: n.tone,
  x: Math.round(n.x),
  y: Math.round(n.y),
  w: Math.round(n.w),
  h: Math.round(n.h),
  z: n.z,
  updated_at: n.updatedAt,
});

const fromRow = (r: Row): Note => ({
  id: r.id,
  title: r.title,
  text: r.text,
  tone: r.tone,
  x: r.x,
  y: r.y,
  w: r.w,
  h: r.h,
  z: r.z,
  updatedAt: r.updated_at,
});

export async function loadCloudNotes(): Promise<Note[]> {
  const { data, error } = await getBrowserClient().from("notes").select("*").order("z");
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function saveCloudNotes(notes: Note[]): Promise<void> {
  if (notes.length === 0) return;
  const { error } = await getBrowserClient().from("notes").upsert(notes.map(toRow));
  if (error) throw error;
}

export async function deleteCloudNote(id: string): Promise<void> {
  const { error } = await getBrowserClient().from("notes").delete().eq("id", id);
  if (error) throw error;
}
