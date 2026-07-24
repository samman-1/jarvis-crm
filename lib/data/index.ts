import type { DataProvider } from "@/lib/data/provider";
import { MockProvider } from "@/lib/data/mock-provider";

/**
 * The one place a provider is chosen.
 *
 * Phase A runs on the mock provider. When Ehan's Supabase project is ready,
 * add `supabase-provider.ts`, import it here, and set
 * NEXT_PUBLIC_DATA_MODE=supabase. Nothing else in the app changes.
 */
let instance: DataProvider | null = null;

export function getDb(): DataProvider {
  if (!instance) {
    // if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    //   instance = new SupabaseProvider();
    // } else {
    instance = new MockProvider();
    // }
  }
  return instance;
}

/** Convenience for components: `db().listClients()`. */
export const db = getDb;

export type { DataProvider };
