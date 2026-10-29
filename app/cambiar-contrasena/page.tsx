import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import PasswordForm from "@/components/PasswordForm";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Nueva contraseña — Hoja" };

async function Gate() {
  await connection();
  const user = await getUser();
  if (!user) redirect("/login");
  return <PasswordForm email={user.email ?? ""} />;
}

export default function ChangePasswordPage() {
  if (!authEnabled) redirect("/");
  return (
    <Suspense fallback={<main className="login canvas" aria-busy="true" />}>
      <Gate />
    </Suspense>
  );
}
