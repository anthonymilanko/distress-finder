import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ColumnMap, ColumnMapping, ImportLog, Lien, Note, Property, PropertyFilters, ScoreResult } from "@/lib/types";
import { applyFilters, applyFiltersCounted, type Repo, type SpendDay } from "./repo";

interface DbFile {
  properties: Property[];
  liens: Lien[];
  notes: Note[];
  importLogs: ImportLog[];
  scoreCache: Record<string, ScoreResult>;
  aiSpend: Record<string, SpendDay>;
  lookupCache: Record<string, { payload: unknown; fetchedAt: string }>;
  columnMaps?: Record<string, ColumnMap>;
}

// Your data lives in ~/DistressFinder (override with DF_DATA_DIR), NOT inside the
// app folder, so replacing the app folder with a new version never touches it.
export const DATA_DIR = process.env.DF_DATA_DIR ?? path.join(os.homedir(), "DistressFinder");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SAMPLE_PATH = path.join(process.cwd(), "data", "sample-properties.json");
const LEGACY_DB_PATH = path.join(process.cwd(), "data", "db.json");

/**
 * Zero-setup store: one JSON file. Fine for a single user on one machine
 * (and for the Phase 1 demo). Swap to Supabase by setting env vars.
 */
export class LocalRepo implements Repo {
  private cache: DbFile | null = null;
  private writing: Promise<void> = Promise.resolve();

  private async load(): Promise<DbFile> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await fs.readFile(DB_PATH, "utf8")) as DbFile;
      return this.cache;
    } catch {
      /* not there yet */
    }
    // One-time move from the old location (data/db.json inside the app folder).
    try {
      const legacy = JSON.parse(await fs.readFile(LEGACY_DB_PATH, "utf8")) as DbFile;
      this.cache = legacy;
      await this.save();
      await fs.rename(LEGACY_DB_PATH, LEGACY_DB_PATH + ".migrated").catch(() => {});
      return this.cache;
    } catch {
      /* no legacy file either */
    }
    {
      // First run: seed with clearly-fake sample rows so the map isn't empty.
      let sample: Property[] = [];
      try {
        sample = JSON.parse(await fs.readFile(SAMPLE_PATH, "utf8")) as Property[];
      } catch {
        sample = [];
      }
      this.cache = {
        properties: sample,
        liens: [],
        notes: [],
        importLogs: [],
        scoreCache: {},
        aiSpend: {},
        lookupCache: {},
      };
      await this.save();
    }
    return this.cache;
  }

  private async save(): Promise<void> {
    const db = this.cache;
    if (!db) return;
    this.writing = this.writing.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = DB_PATH + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.rename(tmp, DB_PATH);
    });
    return this.writing;
  }

  async listProperties(filters: PropertyFilters): Promise<Property[]> {
    const db = await this.load();
    return applyFilters(db.properties, filters);
  }
  async countProperties(filters: PropertyFilters): Promise<number> {
    const db = await this.load();
    return applyFiltersCounted(db.properties, filters).total;
  }
  async getProperty(id: string) {
    const db = await this.load();
    return db.properties.find((p) => p.id === id) ?? null;
  }
  async findByDedupeKey(key: string) {
    const db = await this.load();
    return db.properties.find((p) => p.dedupeKey === key) ?? null;
  }
  async upsertProperty(p: Property) {
    const db = await this.load();
    const i = db.properties.findIndex((x) => x.id === p.id || x.dedupeKey === p.dedupeKey);
    if (i >= 0) db.properties[i] = p;
    else db.properties.push(p);
    await this.save();
    return p;
  }
  async updateProperty(id: string, patch: Partial<Property>) {
    const db = await this.load();
    const i = db.properties.findIndex((x) => x.id === id);
    if (i < 0) return null;
    db.properties[i] = { ...db.properties[i], ...patch, id, updatedAt: new Date().toISOString() };
    await this.save();
    return db.properties[i];
  }
  async updateMany(patches: Array<{ id: string; patch: Partial<Property> }>) {
    const db = await this.load();
    const idx = new Map(db.properties.map((p, i) => [p.id, i]));
    const now = new Date().toISOString();
    let n = 0;
    for (const { id, patch } of patches) {
      const i = idx.get(id);
      if (i === undefined) continue;
      db.properties[i] = { ...db.properties[i], ...patch, id, updatedAt: now };
      n++;
    }
    if (n) await this.save();
    return n;
  }
  private isUngeocoded(p: Property) {
    return (p.lat == null || p.lng == null) && p.geocodeStatus !== "no_match" && Boolean(p.address);
  }
  async listUngeocoded(limit: number) {
    const db = await this.load();
    return db.properties.filter((p) => this.isUngeocoded(p)).slice(0, limit);
  }
  async countUngeocoded() {
    const db = await this.load();
    return db.properties.filter((p) => this.isUngeocoded(p)).length;
  }
  async countNoMatch() {
    const db = await this.load();
    return db.properties.filter((p) => p.geocodeStatus === "no_match").length;
  }
  async resetNoMatch() {
    const db = await this.load();
    let n = 0;
    for (const p of db.properties) if (p.geocodeStatus === "no_match") { p.geocodeStatus = "pending"; n++; }
    if (n) await this.save();
    return n;
  }
  async getColumnMap(signature: string) {
    const db = await this.load();
    return db.columnMaps?.[signature] ?? null;
  }
  async putColumnMap(signature: string, headers: string[], mapping: ColumnMapping) {
    const db = await this.load();
    db.columnMaps ??= {};
    db.columnMaps[signature] = { signature, headers, mapping, savedAt: new Date().toISOString() };
    await this.save();
  }
  async listLiens(propertyId: string) {
    const db = await this.load();
    return db.liens.filter((l) => l.propertyId === propertyId);
  }
  async addLiens(liens: Lien[]) {
    const db = await this.load();
    db.liens.push(...liens);
    await this.save();
    return liens;
  }
  async listNotes(propertyId: string) {
    const db = await this.load();
    return db.notes.filter((n) => n.propertyId === propertyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async addNote(note: Note) {
    const db = await this.load();
    db.notes.push(note);
    await this.save();
    return note;
  }
  async addImportLog(log: ImportLog) {
    const db = await this.load();
    db.importLogs.push(log);
    await this.save();
    return log;
  }
  async listImportLogs() {
    const db = await this.load();
    return [...db.importLogs].reverse();
  }
  async getScore(cacheKey: string) {
    const db = await this.load();
    return db.scoreCache[cacheKey] ?? null;
  }
  async putScore(cacheKey: string, result: ScoreResult) {
    const db = await this.load();
    db.scoreCache[cacheKey] = result;
    await this.save();
  }
  async getSpend(day: string) {
    const db = await this.load();
    return db.aiSpend[day] ?? { day, scans: 0, costUsd: 0 };
  }
  async addSpend(day: string, scans: number, costUsd: number) {
    const db = await this.load();
    const cur = db.aiSpend[day] ?? { day, scans: 0, costUsd: 0 };
    cur.scans += scans;
    cur.costUsd = Math.round((cur.costUsd + costUsd) * 1e6) / 1e6;
    db.aiSpend[day] = cur;
    await this.save();
    return cur;
  }
  async getLookup<T>(cacheKey: string) {
    const db = await this.load();
    return (db.lookupCache[cacheKey]?.payload as T) ?? null;
  }
  async putLookup<T>(cacheKey: string, payload: T) {
    const db = await this.load();
    db.lookupCache[cacheKey] = { payload, fetchedAt: new Date().toISOString() };
    await this.save();
  }
}
