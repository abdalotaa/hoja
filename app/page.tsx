import { Suspense } from "react";
import { redirect } from "next/navigation";
import Canvas from "@/components/Canvas";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

async function SignedIn() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <Canvas userEmail={user.email ?? "cuenta"} />;
}

export default function Home() {
  if (!authEnabled) return <Canvas />;
  return (
    <Suspense fallback={<div className="app canvas" aria-busy="true" />}>
      <SignedIn />
    </Suspense>
  );
}
