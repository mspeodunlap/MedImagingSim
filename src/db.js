import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { canUseWorkspace, roles } from "./roles.js";
import { ageAtToday } from "./intake.js";
import { exams } from "./exams.js";
import { defaultTimeZone, futureOrder, localAppointment } from "./scheduling.js";

const sessionDurationMs = 8 * 60 * 60 * 1000;
const sessionDigest = token => createHash("sha256").update(token).digest("hex");
const deriveKey = promisify(scrypt);
export const localInstitutionId = 1;

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

function migrateInstitutions(db) {
  if (db.prepare("PRAGMA user_version").get().user_version >= 2) return;

  // SQLite requires foreign key enforcement to be off while adding populated reference columns.
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN IMMEDIATE");
    if (db.prepare("PRAGMA user_version").get().user_version === 1) {
      db.exec(`
        CREATE TABLE institutions (
          id INTEGER PRIMARY KEY,
          slug TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL
        ) STRICT;
        INSERT INTO institutions (id, slug, name) VALUES (${localInstitutionId}, 'local', 'Local practice');

        CREATE TABLE institution_memberships (
          institution_id INTEGER NOT NULL REFERENCES institutions (id),
          user_id INTEGER NOT NULL REFERENCES users (id),
          role TEXT NOT NULL CHECK (role IN (${roles.map(role => `'${role}'`).join(", ")})),
          PRIMARY KEY (institution_id, user_id)
        ) STRICT;
        INSERT INTO institution_memberships (institution_id, user_id, role)
          SELECT ${localInstitutionId}, id, role FROM users;

        ALTER TABLE sessions ADD COLUMN institution_id INTEGER NOT NULL
          DEFAULT ${localInstitutionId} REFERENCES institutions (id);
        ALTER TABLE orders ADD COLUMN institution_id INTEGER NOT NULL
          DEFAULT ${localInstitutionId} REFERENCES institutions (id);
        UPDATE orders SET launch_key = institution_id || ':' || launch_key;
        CREATE INDEX orders_institution ON orders (institution_id, id);
        CREATE INDEX orders_institution_student ON orders (institution_id, student_id, id);
        CREATE INDEX sessions_expiry ON sessions (expires_at);
      `);
      if (db.prepare("PRAGMA foreign_key_check").get()) throw new Error("Institution migration would invalidate references.");
      db.exec("PRAGMA user_version = 2");
    }
    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

function migrateAppointments(db) {
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!db.prepare("PRAGMA table_info(institutions)").all().some(column => column.name === "time_zone")) {
      db.exec(`ALTER TABLE institutions ADD COLUMN time_zone TEXT NOT NULL DEFAULT '${defaultTimeZone}'`);
    }
    if (!db.prepare("PRAGMA table_info(orders)").all().some(column => column.name === "appointment_date")) {
      db.exec(`ALTER TABLE orders ADD COLUMN appointment_date TEXT;
        ALTER TABLE orders ADD COLUMN appointment_time TEXT;
        ALTER TABLE orders ADD COLUMN schedule_revision INTEGER NOT NULL DEFAULT 0;`);
      const update = db.prepare("UPDATE orders SET appointment_date = ?, appointment_time = ? WHERE id = ?");
      for (const order of db.prepare(`SELECT o.id, o.created_at, i.time_zone FROM orders o
        JOIN institutions i ON i.id = o.institution_id`).all()) {
        const appointment = localAppointment(new Date(order.created_at.replace(" ", "T") + "Z"), order.time_zone);
        update.run(appointment.date, appointment.time, order.id);
      }
    }
    db.exec(`CREATE INDEX IF NOT EXISTS orders_appointment ON orders(institution_id, appointment_date, appointment_time);
      CREATE INDEX IF NOT EXISTS orders_student_appointment ON orders(institution_id, student_id, appointment_date, appointment_time);
      CREATE TABLE IF NOT EXISTS appointment_changes (
        id INTEGER PRIMARY KEY,
        accession TEXT NOT NULL REFERENCES orders(accession),
        actor_id INTEGER NOT NULL REFERENCES users(id),
        previous_date TEXT, previous_time TEXT,
        appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) STRICT;
      CREATE INDEX IF NOT EXISTS appointment_changes_order ON appointment_changes(accession, id);`);
    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function institutionTimeZone(db, institutionId) {
  return db.prepare("SELECT time_zone FROM institutions WHERE id = ?").get(institutionId).time_zone;
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

    CREATE TABLE IF NOT EXISTS acquisitions (
      id INTEGER PRIMARY KEY,
      accession TEXT NOT NULL REFERENCES orders (accession),
      scan_key TEXT NOT NULL,
      operator_id INTEGER NOT NULL REFERENCES users (id),
      source_version TEXT NOT NULL,
      engine_version TEXT NOT NULL,
      geometry TEXT NOT NULL,
      parameters TEXT NOT NULL,
      pixels BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (accession, scan_key),
      UNIQUE (accession, id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS pacs_selections (
      accession TEXT PRIMARY KEY,
      acquisition_id INTEGER NOT NULL,
      window_width INTEGER NOT NULL CHECK (window_width BETWEEN 1 AND 255),
      window_level INTEGER NOT NULL CHECK (window_level BETWEEN 0 AND 255),
      FOREIGN KEY (accession, acquisition_id) REFERENCES acquisitions (accession, id)
    ) STRICT;
    `);
    migrateInstitutions(db);
    migrateAppointments(db);
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_requests (
        id INTEGER PRIMARY KEY,
        institution_id INTEGER NOT NULL REFERENCES institutions(id),
        creator_id INTEGER NOT NULL REFERENCES users(id),
        request_key TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('manual', 'quick', 'scenario')),
        original_details TEXT NOT NULL,
        details TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        accession TEXT UNIQUE REFERENCES orders(accession),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        scheduled_at TEXT,
        UNIQUE(institution_id, creator_id, request_key)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS requests_queue ON order_requests(institution_id, creator_id, accession, id);
      CREATE TABLE IF NOT EXISTS order_reviews (
        id INTEGER PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES order_requests(id),
        reviewer_id INTEGER NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        checks TEXT NOT NULL,
        missing TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) STRICT;
      CREATE INDEX IF NOT EXISTS reviews_request ON order_reviews(request_id, id);
    `);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function createUser(db, username, role, password, institutionId = localInstitutionId) {
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
    throw new Error("Use a lowercase username with 3 to 40 letters, numbers, dots, underscores, or hyphens.");
  }
  if (!roles.includes(role)) throw new Error("Choose student, instructor, or admin.");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64);
  db.exec("SAVEPOINT create_user");
  try {
    const { lastInsertRowid } = db.prepare("INSERT INTO users (username, role, salt, password_hash) VALUES (?, ?, ?, ?)")
      .run(username, role, salt, hash);
    db.prepare("INSERT INTO institution_memberships (institution_id, user_id, role) VALUES (?, ?, ?)")
      .run(institutionId, lastInsertRowid, role);
    db.exec("RELEASE create_user");
  } catch (error) {
    db.exec("ROLLBACK TO create_user; RELEASE create_user;");
    throw error;
  }
}

export async function authenticate(db, username, password) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  const hash = await deriveKey(password, user?.salt ?? "00000000000000000000000000000000", 64);
  if (user && timingSafeEqual(hash, user.password_hash)) return user.id;
  return null;
}

export function startSession(db, userId, institutionId = localInstitutionId) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  const { changes } = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, institution_id)
    SELECT ?, user_id, ?, institution_id FROM institution_memberships WHERE user_id = ? AND institution_id = ?
  `).run(sessionDigest(token), now + sessionDurationMs, userId, institutionId);
  return changes ? token : null;
}

export function sessionUser(db, token) {
  if (!token) return undefined;
  return db.prepare(`
    SELECT users.id, users.username, memberships.role, sessions.institution_id AS institutionId FROM users
    JOIN sessions ON sessions.user_id = users.id
    JOIN institution_memberships AS memberships ON memberships.user_id = sessions.user_id
      AND memberships.institution_id = sessions.institution_id
    WHERE token_hash = ? AND expires_at > ?
  `).get(sessionDigest(token), Date.now());
}

export function endSession(db, token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sessionDigest(token));
}

export function launchOrder(db, user, scenario, exam, launchKey, appointment = localAppointment(new Date(), institutionTimeZone(db, user.institutionId))) {
  const { id: studentId, institutionId } = user;
  const scopedKey = `${institutionId}:${launchKey}`;
  const accession = `SIM-${randomBytes(8).toString("hex").toUpperCase()}`;
  db.prepare(`
    INSERT INTO orders (accession, student_id, exam_key, modality, exam_name, patient_name,
                        patient_age, indication, history, launch_key, institution_id, appointment_date, appointment_time)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM institution_memberships
    WHERE institution_id = ? AND user_id = ? AND role IN ('student', 'instructor', 'admin')
    ON CONFLICT (student_id, launch_key) DO NOTHING
  `).run(accession, studentId, scenario.examKey, exam.modality, exam.examName, scenario.patient,
    scenario.age, scenario.indication, scenario.history, scopedKey, institutionId, appointment.date, appointment.time, institutionId, studentId);
  return db.prepare("SELECT accession FROM orders WHERE institution_id = ? AND student_id = ? AND launch_key = ?")
    .get(institutionId, studentId, scopedKey)?.accession;
}

export function visibleOrders(db, user, date = localAppointment(new Date(), institutionTimeZone(db, user.institutionId)).date) {
  return db.prepare(`SELECT o.*, u.username AS owner,
    (SELECT id FROM order_requests WHERE accession = o.accession) AS intake_id
    FROM orders o JOIN users u ON u.id = o.student_id
    WHERE o.institution_id = ? AND (? <> 'student' OR o.student_id = ?) AND o.appointment_date = ?
    ORDER BY o.appointment_time, o.id
  `).all(user.institutionId, user.role, user.id, date);
}

export function accessibleOrder(db, user, accession) {
  if (!canUseWorkspace(user, "student")) return undefined;
  if (user.role === "admin") {
    return db.prepare(`
      SELECT o.*, (SELECT time_zone FROM institutions WHERE id = o.institution_id) AS time_zone,
        r.details AS intake_details, r.id AS intake_id FROM orders o
      LEFT JOIN order_requests r ON r.accession = o.accession
      WHERE o.institution_id = ? AND o.accession = ?
    `).get(user.institutionId, accession);
  }
  return db.prepare(`
    SELECT o.*, (SELECT time_zone FROM institutions WHERE id = o.institution_id) AS time_zone,
        r.details AS intake_details, r.id AS intake_id FROM orders o
    LEFT JOIN order_requests r ON r.accession = o.accession
    WHERE o.institution_id = ? AND o.student_id = ? AND o.accession = ?
  `)
    .get(user.institutionId, user.id, accession);
}

export function saveScreening(db, order, screening) {
  if (futureOrder(order)) return { changes: 0 };
  return db.prepare(`
    UPDATE orders SET status = ?, answers = ?, screened_at = CURRENT_TIMESTAMP
    WHERE institution_id = ? AND accession = ? AND status = 'ordered'
  `).run(screening.status, JSON.stringify(screening.answers), order.institution_id, order.accession);
}

export function listAcquisitions(db, institutionId, accession) {
  return db.prepare(`
    SELECT a.id, a.source_version, a.engine_version, a.geometry, a.parameters, a.created_at
    FROM acquisitions AS a JOIN orders AS o ON o.accession = a.accession
    WHERE o.institution_id = ? AND a.accession = ? ORDER BY a.id DESC
  `).all(institutionId, accession);
}

export function acquisitionDetails(db, institutionId, accession, id) {
  return db.prepare(`
    SELECT a.id, a.geometry, a.parameters
    FROM acquisitions AS a JOIN orders AS o ON o.accession = a.accession
    WHERE o.institution_id = ? AND a.accession = ? AND a.id = ?
  `).get(institutionId, accession, id);
}

export function findScan(db, institutionId, accession, scanKey) {
  return db.prepare(`
    SELECT a.id FROM acquisitions AS a JOIN orders AS o ON o.accession = a.accession
    WHERE o.institution_id = ? AND a.accession = ? AND a.scan_key = ?
  `).get(institutionId, accession, scanKey);
}

export function saveAcquisition(db, user, accession, scanKey, acquisition) {
  const current = accessibleOrder(db, user, accession);
  if (!current || futureOrder(current)) return undefined;
  db.prepare(`
    INSERT INTO acquisitions (accession, scan_key, operator_id, source_version, engine_version,
                              geometry, parameters, pixels)
    SELECT o.accession, ?, m.user_id, ?, ?, ?, ?, ?
    FROM orders AS o JOIN institution_memberships AS m ON m.institution_id = o.institution_id
    WHERE o.institution_id = ? AND o.accession = ? AND o.status = 'ready' AND m.user_id = ?
      AND (m.role = 'admin' OR (m.role = 'student' AND m.user_id = o.student_id))
    ON CONFLICT (accession, scan_key) DO NOTHING
  `).run(scanKey, acquisition.sourceVersion, acquisition.engineVersion,
    JSON.stringify(acquisition.geometry), JSON.stringify(acquisition.parameters), acquisition.pixels,
    user.institutionId, accession, user.id);
  return findScan(db, user.institutionId, accession, scanKey)?.id;
}

export function acquisitionPixels(db, institutionId, accession, id) {
  return db.prepare(`
    SELECT a.pixels FROM acquisitions AS a JOIN orders AS o ON o.accession = a.accession
    WHERE o.institution_id = ? AND a.accession = ? AND a.id = ?
  `).get(institutionId, accession, id)?.pixels;
}

export function pacsSelection(db, institutionId, accession) {
  return db.prepare(`
    SELECT s.acquisition_id AS id, s.window_width AS width, s.window_level AS level
    FROM pacs_selections AS s JOIN orders AS o ON o.accession = s.accession
    WHERE o.institution_id = ? AND s.accession = ?
  `).get(institutionId, accession);
}

export function savePacsSelection(db, institutionId, accession, id, { width, level }) {
  return db.prepare(`
    INSERT INTO pacs_selections (accession, acquisition_id, window_width, window_level)
    SELECT a.accession, a.id, ?, ?
    FROM acquisitions AS a JOIN orders AS o ON o.accession = a.accession
    WHERE o.institution_id = ? AND a.accession = ? AND a.id = ?
    ON CONFLICT (accession) DO UPDATE SET acquisition_id = excluded.acquisition_id,
      window_width = excluded.window_width, window_level = excluded.window_level
  `).run(width, level, institutionId, accession, id).changes > 0;
}

export function createOrderRequest(db, user, details, key, source) {
  const payload = JSON.stringify(details);
  db.prepare(`
    INSERT INTO order_requests (institution_id, creator_id, request_key, source, original_details, details)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(institution_id, creator_id, request_key) DO NOTHING
  `).run(user.institutionId, user.id, key, source, payload, payload);
  return db.prepare("SELECT id FROM order_requests WHERE institution_id = ? AND creator_id = ? AND request_key = ?")
    .get(user.institutionId, user.id, key).id;
}

export function visibleRequests(db, user) {
  return db.prepare(`
    SELECT r.*, u.username AS owner,
      (SELECT action FROM order_reviews WHERE request_id = r.id ORDER BY id DESC LIMIT 1) AS last_action
    FROM order_requests r JOIN users u ON u.id = r.creator_id
    WHERE r.institution_id = ? AND r.accession IS NULL AND (? <> 'student' OR r.creator_id = ?)
    ORDER BY r.id DESC
  `).all(user.institutionId, user.role, user.id);
}

export function accessibleRequest(db, user, id) {
  return db.prepare(`
    SELECT *,
      (SELECT appointment_date FROM orders WHERE orders.accession = order_requests.accession) AS appointment_date,
      (SELECT appointment_time FROM orders WHERE orders.accession = order_requests.accession) AS appointment_time
    FROM order_requests WHERE institution_id = ? AND id = ? AND (? <> 'student' OR creator_id = ?)
  `).get(user.institutionId, id, user.role, user.id);
}

export function requestReviews(db, requestId) {
  return db.prepare(`
    SELECT r.*, u.username FROM order_reviews r JOIN users u ON u.id = r.reviewer_id
    WHERE r.request_id = ? ORDER BY r.id DESC
  `).all(requestId);
}

export function reviewOrderRequest(db, user, id, revision, details, checks, missing, action, appointment) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const request = accessibleRequest(db, user, id);
    if (request?.accession && action === "schedule") {
      db.exec("ROLLBACK");
      return { accession: request.accession, result: "scheduled" };
    }
    if (!request || request.accession || request.revision !== revision) {
      db.exec("ROLLBACK");
      return null;
    }
    let accession = null;
    let result = action;
    if (action === "schedule") {
      result = appointment && missing.length === 0 && Object.values(checks).every(Boolean) ? "scheduled" : "schedule_blocked";
    }
    if (result === "scheduled") {
      const owner = { ...user, id: request.creator_id };
      const exam = exams[details.examKey];
      accession = launchOrder(db, owner, {
        examKey: details.examKey, patient: details.patientName, age: ageAtToday(details.dob),
        indication: details.indication, history: details.history,
      }, exam, `intake:${id}`, appointment);
      if (!accession) throw new Error("Order owner no longer has an eligible membership.");
      db.prepare(`INSERT INTO appointment_changes (accession, actor_id, appointment_date, appointment_time, time_zone)
        VALUES (?, ?, ?, ?, ?)`).run(accession, user.id, appointment.date, appointment.time, institutionTimeZone(db, user.institutionId));
    }
    db.prepare(`
      UPDATE order_requests SET details = ?, revision = revision + 1, accession = ?,
        scheduled_at = CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?
    `).run(JSON.stringify(details), accession, accession, id);
    db.prepare(`
      INSERT INTO order_reviews (request_id, reviewer_id, action, details, checks, missing)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, user.id, result, JSON.stringify({ ...details, ...(appointment ? { appointment: { ...appointment, timeZone: institutionTimeZone(db, user.institutionId) } } : {}) }),
      JSON.stringify(checks), JSON.stringify(action === "schedule" && !appointment ? [...missing, "appointment"] : missing));
    db.exec("COMMIT");
    return { accession, result };
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function appointmentHistory(db, accession) {
  return db.prepare(`SELECT a.*, u.username FROM appointment_changes a
    JOIN users u ON u.id = a.actor_id WHERE a.accession = ? ORDER BY a.id DESC`).all(accession);
}

export function rescheduleOrder(db, user, accession, revision, appointment) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = accessibleOrder(db, user, accession);
    if (!order || order.schedule_revision !== revision || order.status !== "ordered" || order.answers !== null ||
        db.prepare("SELECT 1 FROM acquisitions WHERE accession = ? LIMIT 1").get(accession)) {
      db.exec("ROLLBACK");
      return false;
    }
    db.prepare(`UPDATE orders SET appointment_date = ?, appointment_time = ?, schedule_revision = schedule_revision + 1
      WHERE accession = ?`).run(appointment.date, appointment.time, accession);
    db.prepare(`INSERT INTO appointment_changes (accession, actor_id, previous_date, previous_time, appointment_date, appointment_time, time_zone)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(accession, user.id, order.appointment_date, order.appointment_time,
        appointment.date, appointment.time, order.time_zone);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}
