import { LocalRepo } from "./local";
import { SupabaseRepo } from "./supabase";
import type { Repo } from "./repo";

declare global {
  // Survive Next.js dev hot-reloads without re-opening the store.
  var __dfRepo: Repo | undefined;
}

export function getRepo(): Repo {
  if (globalThis.__dfRepo) return globalThis.__dfRepo;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repo: Repo = url && key ? new SupabaseRepo(url, key) : new LocalRepo();
  globalThis.__dfRepo = repo;
  return repo;
}

export function storageMode(): "supabase" | "local" {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
}

export type { Repo } from "./repo";
