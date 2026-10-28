import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Study from "@/components/Study";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Estudio — Hoja" };

async function SignedIn() {
  await connection();
  const user = await getUser();
  if (!user) redirect("/login");
  return <Study userEmail={user.email ?? "cuenta"} />;
}

export default function StudyPage() {
  if (!authEnabled) return <Study />;
  return (
    <Suspense fallback={<div className="app canvas" aria-busy="true" />}>
      <SignedIn />
    </Suspense>
  );
}
