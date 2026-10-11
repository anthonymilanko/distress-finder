import { promises as fs } from "node:fs";
import path from "node:path";
import type { ImportLog, Lien, Note, Property, PropertyFilters, ScoreResult } from "@/lib/types";
import { applyFilters, type Repo, type SpendDay } from "./repo";

interface DbFile {
  properties: Property[];
  liens: Lien[];
  notes: Note[];
  importLogs: ImportLog[];
  scoreCache: Record<string, ScoreResult>;
  aiSpend: Record<string, SpendDay>;
  lookupCache: Record<string, { payload: unknown; fetchedAt: string }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SAMPLE_PATH = path.join(DATA_DIR, "sample-properties.json");

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
    } catch {
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
