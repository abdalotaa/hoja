import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import SharedBoard from "@/components/SharedBoard";
import type { Link } from "@/lib/model";
import type { Note } from "@/lib/notes";
import { authEnabled } from "@/lib/supabase/env";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Hoja compartida", robots: { index: false, follow: false } };

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

async function Shared({ params }: Pick<PageProps<"/s/[token]">, "params">) {
  await connection();
  const { token } = await params;
  if (!authEnabled || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();

  const { data } = await (await getServerClient()).rpc("get_share", { share_token: token });
  const row = (data as { title: string; snapshot: { notes?: unknown[]; links?: unknown[] } }[] | null)?.[0];
  if (!row) notFound();

  const notes: Note[] = (row.snapshot.notes ?? []).slice(0, 500).map((raw) => {
    const n = raw as Record<string, unknown>;
    return {
      id: String(n.id),
      title: String(n.title ?? ""),
      text: String(n.text ?? ""),
      tone: (["butter", "mint", "rust"].includes(n.tone as string) ? n.tone : "none") as Note["tone"],
      kind: n.kind === "node" ? "node" : "note",
      x: num(n.x, 0),
      y: num(n.y, 0),
      w: num(n.w, 300),
      h: num(n.h, 200),
      z: num(n.z, 1),
      updatedAt: 0,
    };
  });
  const links: Link[] = (row.snapshot.links ?? []).slice(0, 1000).map((raw) => {
    const l = raw as Record<string, unknown>;
    return { id: String(l.id), from: String(l.from), to: String(l.to), updatedAt: 0 };
  });
  return <SharedBoard title={row.title} notes={notes} links={links} />;
}

export default function SharedPage({ params }: PageProps<"/s/[token]">) {
  return (
    <Suspense fallback={<div className="app canvas" aria-busy="true" />}>
      <Shared params={params} />
    </Suspense>
  );
}
