import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import AccountForm from "@/components/AccountForm";
import { isAdmin } from "@/lib/admin";
import { displayName } from "@/lib/profile";
import { authEnabled } from "@/lib/supabase/env";
import { getServerClient, getUser } from "@/lib/supabase/server";

export const metadata = { title: "Mi cuenta — Hoja" };

async function Gate() {
  await connection();
  const user = await getUser();
  if (!user) redirect("/login");
  const admin = await isAdmin(await getServerClient());
  return <AccountForm email={user.email ?? ""} name={displayName(user.user_metadata)} admin={admin} />;
}

export default function AccountPage() {
  if (!authEnabled) redirect("/");
  return (
    <Suspense fallback={<main className="login canvas" aria-busy="true" />}>
      <Gate />
    </Suspense>
  );
}
