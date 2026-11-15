import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canUseWorkspace, roles } from "./roles.js";

const sessionDurationMs = 8 * 60 * 60 * 1000;
const sessionDigest = token => createHash("sha256").update(token).digest("hex");

const usersTable = name => `
  CREATE TABLE ${name} (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN (${roles.map(role => `'${role}'`).join(", ")})),
    salt TEXT NOT NULL,
    password_hash BLOB NOT NULL
  ) STRICT;
`;

function migrateUsers(db) {
  if (db.prepare("PRAGMA user_version").get().user_version >= 1) return;

  // Preserve the user IDs referenced by existing orders and sessions during the table rebuild.
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN IMMEDIATE");
    if (db.prepare("PRAGMA user_version").get().user_version === 0) {
      if (db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'users'").get()) {
        db.exec(usersTable("users_migration"));
        db.exec(`
          INSERT INTO users_migration (id, username, role, salt, password_hash)
          SELECT id, username, role, salt, password_hash FROM users;
          DROP TABLE users;
          ALTER TABLE users_migration RENAME TO users;
        `);
      } else {
        db.exec(usersTable("users"));
      }
      if (db.prepare("PRAGMA foreign_key_check").get()) throw new Error("User migration would invalidate references.");
      db.exec("PRAGMA user_version = 1");
    }
    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

export function openDatabase(filename = process.env.MEDSIM_DB ?? "data/medimagingsim.sqlite") {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
    migrateUsers(db);
    db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users (id),
      expires_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      accession TEXT NOT NULL UNIQUE,
      student_id INTEGER NOT NULL REFERENCES users (id),
      exam_key TEXT NOT NULL,
      modality TEXT NOT NULL,
      exam_name TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      patient_age INTEGER NOT NULL,
      indication TEXT NOT NULL,
      history TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'held', 'ready')),
      answers TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      screened_at TEXT,
      launch_key TEXT NOT NULL,
      UNIQUE (student_id, launch_key)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS orders_student ON orders (student_id, id);
    `);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function createUser(db, username, role, password) {
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
    throw new Error("Use a lowercase username with 3 to 40 letters, numbers, dots, underscores, or hyphens.");
  }
  if (!roles.includes(role)) throw new Error("Choose student, instructor, or admin.");
  const salt = randomBytes(16).toString("hex");
  db.prepare("INSERT INTO users (username, role, salt, password_hash) VALUES (?, ?, ?, ?)")
    .run(username, role, salt, scryptSync(password, salt, 64));
}

export function authenticate(db, username, password) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  const hash = scryptSync(password, user?.salt ?? "00000000000000000000000000000000", 64);
  if (user && timingSafeEqual(hash, user.password_hash)) return user.id;
  return null;
}

export function startSession(db, userId) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(sessionDigest(token), userId, now + sessionDurationMs);
  return token;
}

export function sessionUser(db, token) {
  if (!token) return undefined;
  return db.prepare(`
    SELECT users.id, username, role FROM users
    JOIN sessions ON sessions.user_id = users.id
    WHERE token_hash = ? AND expires_at > ?
  `).get(sessionDigest(token), Date.now());
}

export function endSession(db, token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sessionDigest(token));
}

export function launchOrder(db, studentId, scenario, exam, launchKey) {
  const accession = `SIM-${randomBytes(8).toString("hex").toUpperCase()}`;
  db.prepare(`
    INSERT INTO orders (accession, student_id, exam_key, modality, exam_name, patient_name,
                        patient_age, indication, history, launch_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (student_id, launch_key) DO NOTHING
  `).run(accession, studentId, scenario.examKey, exam.modality, exam.examName, scenario.patient,
    scenario.age, scenario.indication, scenario.history, launchKey);
  return db.prepare("SELECT accession FROM orders WHERE student_id = ? AND launch_key = ?")
    .get(studentId, launchKey).accession;
}

export function visibleOrders(db, user) {
  if (user.role === "admin") {
    return db.prepare(`
      SELECT orders.*, users.username AS owner FROM orders
      JOIN users ON users.id = orders.student_id ORDER BY orders.id DESC
    `).all();
  }
  return db.prepare("SELECT * FROM orders WHERE student_id = ? ORDER BY id DESC").all(user.id);
}

export function accessibleOrder(db, user, accession) {
  if (!canUseWorkspace(user, "student")) return undefined;
  if (user.role === "admin") {
    return db.prepare("SELECT * FROM orders WHERE accession = ?").get(accession);
  }
  return db.prepare("SELECT * FROM orders WHERE student_id = ? AND accession = ?").get(user.id, accession);
}

export function saveScreening(db, studentId, accession, screening) {
  return db.prepare(`
    UPDATE orders SET status = ?, answers = ?, screened_at = CURRENT_TIMESTAMP
    WHERE student_id = ? AND accession = ? AND status = 'ordered'
  `).run(screening.status, JSON.stringify(screening.answers), studentId, accession);
}
