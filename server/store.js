import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "crypto";
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
`);

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

export function saveProgram(program, title, clientName) {
  const id = randomUUID();
  const weekLabel = describeWeeks(program);
  db.prepare(
    `INSERT INTO programs (id, client_name, title, week_label, saved_at, program_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    clientName.trim(),
    (title || "").trim() || weekLabel,
    weekLabel,
    new Date().toISOString(),
    JSON.stringify(program)
  );
  return id;
}

export function getProgram(id) {
  const row = db.prepare(`SELECT * FROM programs WHERE id = ?`).get(id);
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
    clientName: row.client_name,
    title: row.title,
    savedAt: row.saved_at,
    program: JSON.parse(row.program_json),
    comments,
  };
}

export function listPrograms() {
  const rows = db
    .prepare(
      `SELECT id, client_name, title, week_label, saved_at FROM programs
       ORDER BY client_name COLLATE NOCASE ASC, saved_at DESC`
    )
    .all();

  return rows.map((row) => ({
    id: row.id,
    clientName: row.client_name,
    title: row.title,
    weekLabel: row.week_label,
    savedAt: row.saved_at,
  }));
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
