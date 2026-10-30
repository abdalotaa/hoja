import { Suspense } from "react";
import PageShell from "@/components/PageShell";
import { connection } from "next/server";
import Canvas from "@/components/Canvas";
import Landing from "@/components/Landing";
import { landingMetadata } from "@/lib/landing";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";
import { displayName } from "@/lib/profile";

export const metadata = landingMetadata;

async function SignedIn() {
  // Reading the session involves time-based token checks, so this must render per request.
  await connection();
  const user = await getUser();
  // Visitors without a session see the landing page; signed-in people go straight to their canvas.
  if (!user) return <Landing />;
  return <Canvas userEmail={user.email ?? "cuenta"} userName={displayName(user.user_metadata)} userId={user.id} />;
}

export default function Home() {
  if (!authEnabled) return <Canvas />;
  return (
    <Suspense fallback={<PageShell current="lienzo" />}>
      <SignedIn />
    </Suspense>
  );
}
