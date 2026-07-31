import type { DataProvider } from "@/lib/data/provider";
import { MockProvider } from "@/lib/data/mock-provider";
import { SupabaseProvider } from "@/lib/data/supabase-provider";

/**
 * The one place a provider is chosen.
 *
 *   NEXT_PUBLIC_DATA_MODE=supabase → the shared database, reached through
 *     /api/db. All three members see the same data.
 *   anything else                  → this browser only, for local development
 *     and as a fallback if the database is ever unreachable.
 *
 * Nothing else in the app knows which is in use.
 */
let instance: DataProvider | null = null;

export function getDb(): DataProvider {
  if (!instance) {
    instance =
      process.env.NEXT_PUBLIC_DATA_MODE === "supabase"
        ? new SupabaseProvider()
        : new MockProvider();
  }
  return instance;
}

/** Convenience for components: `db().listClients()`. */
export const db = getDb;

/** True when data is shared with the other members rather than phone-local. */
export const IS_SHARED = process.env.NEXT_PUBLIC_DATA_MODE === "supabase";

export type { DataProvider };
