import { LocalRepo } from "./local";
import { SupabaseRepo } from "./supabase";
import type { Repo } from "./repo";

declare global {
  // Survive Next.js dev hot-reloads without re-opening the store.
  var __dfRepo: Repo | undefined;
}

/** Accepts the project URL in any of the forms the Supabase dashboard shows (with /rest/v1 etc.) and keeps only the origin. */
function supabaseOrigin(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return undefined;
  }
}

export function getRepo(): Repo {
  if (globalThis.__dfRepo) return globalThis.__dfRepo;
  const url = supabaseOrigin(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const repo: Repo = url && key ? new SupabaseRepo(url, key) : new LocalRepo();
  globalThis.__dfRepo = repo;
  return repo;
}

export function storageMode(): "supabase" | "local" {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
}

export type { Repo } from "./repo";
