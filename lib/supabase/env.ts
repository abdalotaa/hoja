// NEXT_PUBLIC_* values must be read as literal property accesses so Next can inline them in the browser bundle.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** When Supabase isn't configured, Hoja runs in local mode (notes in this browser only, no login). */
export const authEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
