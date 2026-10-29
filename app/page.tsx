import { Suspense } from "react";
import PageShell from "@/components/PageShell";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Canvas from "@/components/Canvas";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

async function SignedIn() {
  // Reading the session involves time-based token checks, so this must render per request.
  await connection();
  const user = await getUser();
  if (!user) redirect("/login");
  return <Canvas userEmail={user.email ?? "cuenta"} userId={user.id} />;
}

export default function Home() {
  if (!authEnabled) return <Canvas />;
  return (
    <Suspense fallback={<PageShell current="lienzo" />}>
      <SignedIn />
    </Suspense>
  );
}
