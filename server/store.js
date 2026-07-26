import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { existsSync, readFileSync, renameSync } from "fs";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production (Render), DATA_DIR points at a mounted persistent disk so
// the database survives restarts/redeploys. Locally, it just defaults to
// server/data.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "app.db");
const LEGACY_JSON_FILE = path.join(DATA_DIR, "programs.json");

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    title TEXT NOT NULL,
    week_label TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    program_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    program_id TEXT NOT NULL,
    key TEXT NOT NULL,
    text TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (program_id, key)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    client_id TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS benchmarks (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
  );
`);

// Additive-only schema change on a live database: check before altering
// rather than assuming a fresh table, since this DB already has real data.
function ensureColumn(table, column, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
ensureColumn("programs", "client_id", "TEXT");

function describeWeeks(program) {
  const numbers = (program?.weeks || [])
    .map((w) => w.weekNumber)
    .filter((n) => typeof n === "number");
  if (numbers.length === 0) return "Untitled program";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return min === max ? `Week ${min}` : `Weeks ${min}-${max}`;
}

// One-time migration from the old plain-JSON-file store (pre-database).
// Renames the old file after a successful import so this only ever runs once.
function migrateLegacyJsonIfPresent() {
  if (!existsSync(LEGACY_JSON_FILE)) return;

  const legacy = JSON.parse(readFileSync(LEGACY_JSON_FILE, "utf-8"));
  const insertProgram = db.prepare(`
    INSERT OR IGNORE INTO programs (id, client_name, title, week_label, saved_at, program_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertComment = db.prepare(`
    INSERT OR IGNORE INTO comments (program_id, key, text, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const entry of Object.values(legacy)) {
    const weekLabel = describeWeeks(entry.program);
    insertProgram.run(
      entry.id,
      "Unassigned",
      entry.title || weekLabel,
      weekLabel,
      entry.savedAt,
      JSON.stringify(entry.program)
    );
    for (const [key, comment] of Object.entries(entry.comments || {})) {
      insertComment.run(entry.id, key, comment.text, comment.updatedAt);
    }
  }

  renameSync(LEGACY_JSON_FILE, LEGACY_JSON_FILE + ".migrated");
  console.log(
    `Migrated ${Object.keys(legacy).length} program(s) from programs.json into app.db (client set to "Unassigned" - edit later if needed).`
  );
}
migrateLegacyJsonIfPresent();

function slugifyUsername(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "client";
  let candidate = base;
  let n = 1;
  while (db.prepare(`SELECT 1 FROM clients WHERE username = ?`).get(candidate)) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

// One-time backfill: every program saved before clients existed (M4's free-
// text client_name) gets a real client record, without login credentials
// until the coach sets one via resetClientPassword. Only touches rows that
// don't have a client_id yet, so this is safe to run on every startup.
function backfillClientsFromLegacyNames() {
  const orphanNames = db
    .prepare(`SELECT DISTINCT client_name FROM programs WHERE client_id IS NULL`)
    .all();

  for (const { client_name } of orphanNames) {
    const clientId = randomUUID();
    const username = slugifyUsername(client_name);
    db.prepare(
      `INSERT INTO clients (id, name, username, password_hash, created_at) VALUES (?, ?, ?, NULL, ?)`
    ).run(clientId, client_name, username, new Date().toISOString());
    db.prepare(`UPDATE programs SET client_id = ? WHERE client_name = ? AND client_id IS NULL`).run(
      clientId,
      client_name
    );
  }

  if (orphanNames.length > 0) {
    console.log(
      `Created ${orphanNames.length} client record(s) from legacy program data (no password set yet).`
    );
  }
}
backfillClientsFromLegacyNames();

/* ---------------- Password hashing ---------------- */

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

const PASSWORD_WORDS = [
  "tiger", "comet", "maple", "river", "stone", "cedar", "amber", "coral",
  "pearl", "ridge", "storm", "ember", "frost", "canyon", "willow", "ocean",
  "summit", "harbor", "meadow", "falcon", "otter", "birch", "dune", "glacier",
  "lagoon", "marsh", "orbit", "panther", "quartz", "raven", "sable", "talon",
  "umber", "vault", "wren", "yonder", "zephyr", "brook", "clover", "delta",
];

function generatePassword() {
  const w1 = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  const w2 = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)];
  const num = randomInt(10, 100);
  return `${w1}-${w2}-${num}`;
}

/* ---------------- Clients ---------------- */

export function createClient(name) {
  const id = randomUUID();
  const username = slugifyUsername(name);
  const password = generatePassword();
  db.prepare(
    `INSERT INTO clients (id, name, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name.trim(), username, hashPassword(password), new Date().toISOString());
  return { id, name: name.trim(), username, password };
}

export function resetClientPassword(clientId) {
  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(clientId);
  if (!client) return null;
  const password = generatePassword();
  db.prepare(`UPDATE clients SET password_hash = ? WHERE id = ?`).run(hashPassword(password), clientId);
  return { id: client.id, name: client.name, username: client.username, password };
}

export function listClients() {
  const rows = db
    .prepare(`SELECT id, name, username, password_hash, created_at FROM clients ORDER BY name COLLATE NOCASE ASC`)
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    hasPassword: !!r.password_hash,
    createdAt: r.created_at,
  }));
}

export function verifyClientLogin(username, password) {
  const row = db.prepare(`SELECT * FROM clients WHERE username = ?`).get((username || "").trim().toLowerCase());
  if (!row || !row.password_hash) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, name: row.name, username: row.username };
}

export function getClientById(id) {
  return db.prepare(`SELECT id, name, username FROM clients WHERE id = ?`).get(id) || null;
}

export function changeClientPassword(clientId, currentPassword, newPassword) {
  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(clientId);
  if (!client) return { ok: false, error: "Client not found." };
  if (!verifyPassword(currentPassword, client.password_hash)) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  db.prepare(`UPDATE clients SET password_hash = ? WHERE id = ?`).run(
    hashPassword(newPassword),
    clientId
  );
  return { ok: true };
}

/* ---------------- Sessions ---------------- */

const SESSION_DAYS = 30;

export function createSession(role, clientId = null) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO sessions (token, role, client_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(token, role, clientId, now.toISOString(), expires.toISOString());
  return token;
}

export function getSession(token) {
  const row = db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    return null;
  }
  return { role: row.role, clientId: row.client_id };
}

export function deleteSession(token) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

/* ---------------- Programs ---------------- */

export function saveProgram(program, title, clientId) {
  const client = getClientById(clientId);
  if (!client) throw new Error("Unknown client.");

  const id = randomUUID();
  const weekLabel = describeWeeks(program);
  db.prepare(
    `INSERT INTO programs (id, client_id, client_name, title, week_label, saved_at, program_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    clientId,
    client.name,
    (title || "").trim() || weekLabel,
    weekLabel,
    new Date().toISOString(),
    JSON.stringify(program)
  );
  return id;
}

export function getProgram(id) {
  const row = db
    .prepare(
      `SELECT p.*, c.name AS client_display_name FROM programs p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = ?`
    )
    .get(id);
  if (!row) return null;

  const commentRows = db
    .prepare(`SELECT key, text, updated_at FROM comments WHERE program_id = ?`)
    .all(id);
  const comments = {};
  for (const c of commentRows) {
    comments[c.key] = { text: c.text, updatedAt: c.updated_at };
  }

  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_display_name || row.client_name,
    title: row.title,
    savedAt: row.saved_at,
    program: JSON.parse(row.program_json),
    comments,
  };
}

// Pass clientId to scope results to just that client's own programs
// (what a logged-in client should see); omit it for the coach's full list.
export function listPrograms(clientId = null) {
  const rows = clientId
    ? db
        .prepare(
          `SELECT p.id, p.client_id, COALESCE(c.name, p.client_name) AS display_name, p.title, p.week_label, p.saved_at
           FROM programs p LEFT JOIN clients c ON c.id = p.client_id
           WHERE p.client_id = ?
           ORDER BY p.saved_at DESC`
        )
        .all(clientId)
    : db
        .prepare(
          `SELECT p.id, p.client_id, COALESCE(c.name, p.client_name) AS display_name, p.title, p.week_label, p.saved_at
           FROM programs p LEFT JOIN clients c ON c.id = p.client_id
           ORDER BY display_name COLLATE NOCASE ASC, p.saved_at DESC`
        )
        .all();

  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: row.display_name,
    title: row.title,
    weekLabel: row.week_label,
    savedAt: row.saved_at,
  }));
}

function* iterateExercises(program) {
  for (const week of program?.weeks || []) {
    for (const day of week.days || []) {
      for (const block of day.blocks || []) {
        for (const exercise of block.exercises || []) {
          yield { week, day, block, exercise };
        }
      }
    }
  }
}

// Every distinct movement name a client has ever had programmed, for an
// autocomplete list rather than requiring an exact free-text match.
export function listExerciseNames(clientId) {
  const rows = db.prepare(`SELECT program_json FROM programs WHERE client_id = ?`).all(clientId);
  const names = new Set();
  for (const row of rows) {
    const program = JSON.parse(row.program_json);
    for (const { exercise } of iterateExercises(program)) {
      if (exercise.name) names.add(exercise.name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

// Every occurrence of a movement (case-insensitive substring match, so it
// also picks up complexes like "Snatch pull + Hang muscle snatch") across
// every program ever saved for this client, oldest first, with whatever
// comment was left on that block.
export function findExerciseHistory(clientId, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];

  const rows = db
    .prepare(
      `SELECT id, title, saved_at, program_json FROM programs WHERE client_id = ? ORDER BY saved_at ASC`
    )
    .all(clientId);

  const results = [];
  for (const row of rows) {
    const program = JSON.parse(row.program_json);
    for (const { week, day, block, exercise } of iterateExercises(program)) {
      if (!exercise.name || !exercise.name.toLowerCase().includes(q)) continue;
      const key = `w${week.weekNumber}-d${day.dayOrder}-b${block.letter}`;
      const commentRow = db
        .prepare(`SELECT text FROM comments WHERE program_id = ? AND key = ?`)
        .get(row.id, key);
      results.push({
        programId: row.id,
        programTitle: row.title,
        programSavedAt: row.saved_at,
        weekNumber: week.weekNumber,
        dayLabel: day.dayLabel,
        exerciseName: exercise.name,
        scheme: exercise.scheme || null,
        reps: exercise.reps || null,
        load: exercise.load || null,
        rest: exercise.rest || null,
        notes: exercise.notes || null,
        comment: commentRow ? commentRow.text : null,
      });
    }
  }
  return results;
}

// Content-only update (exercise/block fields). weekNumber, dayOrder, and
// block letter are the pieces comment keys are built from - the frontend is
// expected to leave those untouched, so existing comments stay attached to
// the right block.
export function updateProgram(id, program) {
  const exists = db.prepare(`SELECT 1 FROM programs WHERE id = ?`).get(id);
  if (!exists) return false;

  const weekLabel = describeWeeks(program);
  db.prepare(`UPDATE programs SET program_json = ?, week_label = ? WHERE id = ?`).run(
    JSON.stringify(program),
    weekLabel,
    id
  );
  return true;
}

export function upsertComment(id, key, text) {
  const exists = db.prepare(`SELECT 1 FROM programs WHERE id = ?`).get(id);
  if (!exists) return null;

  if (text.trim()) {
    db.prepare(
      `INSERT INTO comments (program_id, key, text, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(program_id, key) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`
    ).run(id, key, text, new Date().toISOString());
  } else {
    db.prepare(`DELETE FROM comments WHERE program_id = ? AND key = ?`).run(id, key);
  }

  const commentRows = db
    .prepare(`SELECT key, text, updated_at FROM comments WHERE program_id = ?`)
    .all(id);
  const comments = {};
  for (const c of commentRows) {
    comments[c.key] = { text: c.text, updatedAt: c.updated_at };
  }
  return comments;
}

/* ---------------- Benchmarks (1RMs and named CrossFit benchmarks) ---------------- */

// Curated on purpose - a coach cares about a Back Squat 1RM, nobody needs a
// bicep curl 1RM tracked. A coach can still log a value under any name they
// type; once logged it shows up in that client's list going forward (no
// separate "enabled benchmarks" table needed - the entries ARE the list).
export const DEFAULT_1RM_LIFTS = [
  "Back Squat", "Front Squat", "Overhead Squat", "Deadlift",
  "Snatch", "Clean & Jerk", "Clean", "Jerk",
  "Strict Press", "Push Press", "Bench Press",
];

export const DEFAULT_BENCHMARK_WODS = [
  "Fran", "Grace", "Helen", "Diane", "Annie", "Cindy", "Karen", "Jackie", "Murph", "DT",
];

export const DEFAULT_MONOSTRUCTURAL = [
  "Row - 1km", "Row - 2km", "Row - 5km", "Row - 10km",
  "Run - 100m", "Run - 400m", "Run - 800m", "Run - 1km", "Run - 1 Mile",
  "Run - 5km", "Run - 10km", "Run - Half Marathon", "Run - Marathon",
  "Swim - 50m", "Swim - 100m", "Swim - 200m", "Swim - 500m", "Swim - 1km",
  "Bike - FTP", "Bike - 10km", "Bike - 20km",
  "Echo Bike - 50cal", "Echo Bike - 100cal", "Echo Bike - 20min",
];

function defaultNamesFor(category) {
  if (category === "wod") return DEFAULT_BENCHMARK_WODS;
  if (category === "mono") return DEFAULT_MONOSTRUCTURAL;
  return DEFAULT_1RM_LIFTS;
}

// One row per name: the most recent entry (for the "current PB" list view),
// plus how many entries exist in total.
export function listBenchmarks(clientId, category) {
  const rows = db
    .prepare(
      `SELECT name, value, recorded_at, COUNT(*) OVER (PARTITION BY name) AS entry_count,
              ROW_NUMBER() OVER (PARTITION BY name ORDER BY recorded_at DESC, created_at DESC) AS rn
       FROM benchmarks WHERE client_id = ? AND category = ?`
    )
    .all(clientId, category);

  const latestByName = new Map();
  for (const row of rows) {
    if (row.rn === 1) {
      latestByName.set(row.name, {
        latestValue: row.value,
        latestDate: row.recorded_at,
        entryCount: row.entry_count,
      });
    }
  }

  const names = new Set([...defaultNamesFor(category), ...latestByName.keys()]);
  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({
    name,
    latestValue: latestByName.get(name)?.latestValue ?? null,
    latestDate: latestByName.get(name)?.latestDate ?? null,
    entryCount: latestByName.get(name)?.entryCount ?? 0,
  }));
}

export function getBenchmarkHistory(clientId, category, name) {
  return db
    .prepare(
      `SELECT id, value, recorded_at, notes, created_at FROM benchmarks
       WHERE client_id = ? AND category = ? AND name = ?
       ORDER BY recorded_at DESC, created_at DESC`
    )
    .all(clientId, category, name)
    .map((row) => ({
      id: row.id,
      value: row.value,
      recordedAt: row.recorded_at,
      notes: row.notes,
      createdAt: row.created_at,
    }));
}

export function addBenchmarkEntry(clientId, category, name, value, recordedAt, notes) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO benchmarks (id, client_id, category, name, value, recorded_at, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    clientId,
    category,
    name.trim(),
    value.trim(),
    recordedAt || new Date().toISOString().slice(0, 10),
    notes?.trim() || null,
    new Date().toISOString()
  );
  return id;
}

// clientId is passed in so a client can only ever delete their own entries -
// the caller is responsible for scoping it correctly.
export function deleteBenchmarkEntry(id, clientId) {
  const result = db
    .prepare(`DELETE FROM benchmarks WHERE id = ? AND client_id = ?`)
    .run(id, clientId);
  return result.changes > 0;
}

/* ---------------- Client detail (coach's "click into a client" view) ---------------- */

// A comment's key is "w{weekNumber}-d{dayOrder}-b{letter}" - not human
// readable on its own, so resolve it against the actual program content to
// show what the comment is actually about.
function resolveCommentLabel(program, key) {
  const match = key.match(/^w(\d+)-d(\d+)-b(.+)$/);
  if (!match) return null;
  const [, weekNum, dayNum, letter] = match;
  const week = (program.weeks || []).find((w) => String(w.weekNumber) === weekNum);
  const day = week?.days?.find((d) => String(d.dayOrder) === dayNum);
  const block = day?.blocks?.find((b) => b.letter === letter);
  if (!block) return null;
  return block.blockName || block.exercises?.[0]?.name || `Block ${letter}`;
}

export function getClientDetail(clientId) {
  const client = db
    .prepare(`SELECT id, name, username, password_hash, created_at FROM clients WHERE id = ?`)
    .get(clientId);
  if (!client) return null;

  const programs = listPrograms(clientId);

  const commentRows = db
    .prepare(
      `SELECT c.program_id, c.key, c.text, c.updated_at, p.title, p.program_json
       FROM comments c JOIN programs p ON p.id = c.program_id
       WHERE p.client_id = ?
       ORDER BY c.updated_at DESC LIMIT 15`
    )
    .all(clientId);

  const recentComments = commentRows.map((row) => {
    const program = JSON.parse(row.program_json);
    return {
      programId: row.program_id,
      programTitle: row.title,
      label: resolveCommentLabel(program, row.key) || row.key,
      text: row.text,
      updatedAt: row.updated_at,
    };
  });

  const recentBenchmarks = db
    .prepare(
      `SELECT category, name, value, recorded_at, created_at FROM benchmarks
       WHERE client_id = ? ORDER BY created_at DESC LIMIT 15`
    )
    .all(clientId)
    .map((row) => ({
      category: row.category,
      name: row.name,
      value: row.value,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
    }));

  return {
    client: {
      id: client.id,
      name: client.name,
      username: client.username,
      hasPassword: !!client.password_hash,
      createdAt: client.created_at,
    },
    programs,
    recentComments,
    recentBenchmarks,
  };
}
