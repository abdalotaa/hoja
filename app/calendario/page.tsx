import { Suspense } from "react";
import PageShell from "@/components/PageShell";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Calendar from "@/components/Calendar";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Calendario — Hoja" };

async function SignedIn() {
  await connection();
  const user = await getUser();
  if (!user) redirect("/login");
  return <Calendar userEmail={user.email ?? "cuenta"} />;
}

export default function CalendarPage() {
  if (!authEnabled) return <Calendar />;
  return (
    <Suspense fallback={<PageShell current="calendario" />}>
      <SignedIn />
    </Suspense>
  );
}
