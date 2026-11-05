import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import Admin from "@/components/Admin";
import { loadAdmin } from "@/lib/admin";
import { authEnabled } from "@/lib/supabase/env";
import { getServerClient, getUser } from "@/lib/supabase/server";

export const metadata = { title: "Panel — Hoja", robots: { index: false, follow: false } };

async function Gate() {
  await connection();
  if (!(await getUser())) redirect("/login");
  // The database decides who is an admin; anyone else gets a plain 404 so the page doesn't reveal itself.
  const data = await loadAdmin(await getServerClient());
  if (!data) notFound();
  return <Admin metrics={data.metrics} suggestions={data.suggestions} />;
}

export default function AdminPage() {
  if (!authEnabled) notFound();
  return (
    <Suspense fallback={<main className="adm" aria-busy="true" />}>
      <Gate />
    </Suspense>
  );
}
