import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import LoginForm from "@/components/LoginForm";
import { authEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  await connection();
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  return <LoginForm linkError={error === "link"} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!authEnabled) redirect("/");
  return (
    <Suspense fallback={<main className="login canvas" aria-busy="true" />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}
