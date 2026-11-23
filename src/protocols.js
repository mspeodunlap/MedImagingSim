import { defaultPlan, presets, readPlan } from "./mr.js";
import { futureOrder } from "./scheduling.js";
import { recordExamEvent } from "./lifecycle.js";
import { dictionaryVersion, teachingStarter } from "./mri-dictionary.js";

export const sequenceLimit = 32;
const cleanName = value => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const nameValid = name => name.length > 0 && name.length <= 120;
export const sequenceFromPlan = plan => ({ name: presets[plan.preset].label, plan });

export function validateProtocol(value) {
  if (!value || !Array.isArray(value.sequences) || !value.sequences.length || value.sequences.length > sequenceLimit) return null;
  const sequences = [];
  for (const sequence of value.sequences) {
    const name = cleanName(sequence?.name);
    if (!nameValid(name) || !sequence.plan || typeof sequence.plan !== "object") return null;
    const form = new URLSearchParams();
    for (const key of Object.keys(defaultPlan)) {
      const v = sequence.plan[key];
      if (v !== undefined && v !== null) form.set(key, String(v));
    }
    const plan = readPlan(form);
    if (!plan) return null;
    sequences.push({ name, plan });
  }
  // Historical provenance remains valid after a later dictionary revision. It is
  // descriptive metadata, never authorization to load an unsupported sequence.
  if (value.origin && (typeof value.origin.id !== "string" || !/^[a-z0-9-]{1,80}$/.test(value.origin.id) ||
    typeof value.origin.version !== "string" || !/^\d{4}-\d{2}-\d{2}\.\d{1,4}$/.test(value.origin.version))) return null;
  return { sequences, ...(value.origin ? { origin: { id: value.origin.id, version: value.origin.version } } : {}) };
}

export function migrateProtocols(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS mri_protocols (
    id INTEGER PRIMARY KEY,
    institution_id INTEGER NOT NULL REFERENCES institutions(id),
    owner_id INTEGER REFERENCES users(id),
    kind TEXT NOT NULL CHECK(kind IN ('default','personal')),
    name TEXT NOT NULL,
    CHECK((kind = 'default' AND owner_id IS NULL) OR (kind = 'personal' AND owner_id IS NOT NULL))
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS mri_defaults_name ON mri_protocols(institution_id, name COLLATE NOCASE) WHERE kind = 'default';
  CREATE UNIQUE INDEX IF NOT EXISTS mri_personal_name ON mri_protocols(institution_id, owner_id, name COLLATE NOCASE) WHERE kind = 'personal';
  CREATE TABLE IF NOT EXISTS mri_protocol_versions (
    id INTEGER PRIMARY KEY,
    protocol_id INTEGER NOT NULL REFERENCES mri_protocols(id),
    version INTEGER NOT NULL,
    source_version_id INTEGER REFERENCES mri_protocol_versions(id),
    payload TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(protocol_id, version)
  ) STRICT;
  CREATE TRIGGER IF NOT EXISTS mri_versions_no_update BEFORE UPDATE ON mri_protocol_versions
    BEGIN SELECT RAISE(ABORT, 'Saved protocol versions are immutable.'); END;
  CREATE TRIGGER IF NOT EXISTS mri_versions_no_delete BEFORE DELETE ON mri_protocol_versions
    BEGIN SELECT RAISE(ABORT, 'Saved protocol versions are immutable.'); END;
  CREATE TABLE IF NOT EXISTS mri_exam_protocols (
    accession TEXT PRIMARY KEY REFERENCES orders(accession),
    source_version_id INTEGER REFERENCES mri_protocol_versions(id),
    payload TEXT NOT NULL,
    selected_sequence INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL
  ) STRICT;`);
}

function membership(db, user) {
  return db.prepare("SELECT role FROM institution_memberships WHERE institution_id = ? AND user_id = ?")
    .get(user.institutionId, user.id);
}

export function protocolVersions(db, user) {
  return db.prepare(`SELECT v.id, v.protocol_id, v.version, v.created_by, v.created_at, p.name, p.kind, p.owner_id FROM mri_protocol_versions v
    JOIN mri_protocols p ON p.id = v.protocol_id
    WHERE p.institution_id = ? AND (p.kind = 'default' OR p.owner_id = ?)
    ORDER BY p.kind, p.name COLLATE NOCASE, v.version DESC`).all(user.institutionId, user.id);
}

export function accessibleProtocol(db, user, id) {
  return db.prepare(`SELECT v.*, p.name, p.kind, p.owner_id FROM mri_protocol_versions v
    JOIN mri_protocols p ON p.id = v.protocol_id
    WHERE v.id = ? AND p.institution_id = ? AND (p.kind = 'default' OR p.owner_id = ?)`)
    .get(id, user.institutionId, user.id);
}

// Called inside a transaction by both the library editor and the exam-copy saver.
function appendVersion(db, user, kind, name, document, sourceId) {
  const member = membership(db, user);
  if (!member || (kind === "default" && !["instructor", "admin"].includes(member.role))) return { error: "forbidden" };
  if (!["default", "personal"].includes(kind) || !nameValid(name)) return { error: "invalid" };
  const source = sourceId ? accessibleProtocol(db, user, sourceId) : null;
  if (sourceId && !source) return { error: "forbidden" };
  let header = db.prepare(`SELECT * FROM mri_protocols WHERE institution_id = ? AND kind = ?
    AND name = ? COLLATE NOCASE AND (kind = 'default' OR owner_id = ?)`)
    .get(user.institutionId, kind, name, user.id);
  let previous = 0;
  if (header) {
    const latest = db.prepare("SELECT id, version FROM mri_protocol_versions WHERE protocol_id = ? ORDER BY version DESC LIMIT 1").get(header.id);
    if (source?.id !== latest?.id) return { error: "conflict" };
    previous = latest.version;
  } else {
    const inserted = db.prepare("INSERT INTO mri_protocols (institution_id, owner_id, kind, name) VALUES (?, ?, ?, ?)")
      .run(user.institutionId, kind === "personal" ? user.id : null, kind, name);
    header = { id: Number(inserted.lastInsertRowid) };
  }
  const inserted = db.prepare(`INSERT INTO mri_protocol_versions (protocol_id, version, source_version_id, payload, created_by)
    VALUES (?, ?, ?, ?, ?)`).run(header.id, previous + 1, source?.id ?? null, JSON.stringify(document), user.id);
  return { id: Number(inserted.lastInsertRowid), version: previous + 1 };
}

export function saveProtocolVersion(db, user, kind, name, document, sourceId = null) {
  const valid = validateProtocol(document);
  if (!valid) return { error: "invalid" };
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = appendVersion(db, user, kind, cleanName(name), valid, sourceId);
    db.exec(result.error ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
}

export function examProtocol(db, institutionId, accession) {
  const copy = db.prepare(`SELECT e.*, p.name AS protocol_name, v.version AS source_version, p.kind AS source_kind
    FROM mri_exam_protocols e JOIN orders o ON o.accession = e.accession
    LEFT JOIN mri_protocol_versions v ON v.id = e.source_version_id
    LEFT JOIN mri_protocols p ON p.id = v.protocol_id
    WHERE o.institution_id = ? AND e.accession = ?`).get(institutionId, accession);
  if (copy && !copy.protocol_name) copy.protocol_name = teachingStarter(JSON.parse(copy.payload).origin?.id)?.name ?? null;
  return copy;
}

export function changeExamProtocol(db, user, accession, revision, action, { versionId, starterId, selected, plan, name } = {}) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = db.prepare(`SELECT o.*, w.state, w.locked_by, w.correction_cycle, m.role, i.time_zone FROM orders o
      JOIN exam_workflow w ON w.accession = o.accession
      JOIN institutions i ON i.id = o.institution_id
      JOIN institution_memberships m ON m.institution_id = o.institution_id AND m.user_id = ?
      WHERE o.institution_id = ? AND o.accession = ? AND (m.role <> 'student' OR o.student_id = m.user_id)`)
      .get(user.id, user.institutionId, accession);
    const current = examProtocol(db, user.institutionId, accession);
    if (!order || futureOrder(order) || order.locked_by || order.state !== "exam_begin" || order.status !== "ready" ||
      (order.role === "instructor" && !order.correction_cycle)) {
      db.exec("ROLLBACK"); return { error: "forbidden" };
    }
    if ((current?.revision ?? 0) !== revision) { db.exec("ROLLBACK"); return { error: "conflict" }; }
    let document, sourceId = current?.source_version_id ?? null, sequence = current?.selected_sequence ?? 0;
    if (action === "load") {
      const starter = starterId ? teachingStarter(starterId) : null;
      const version = starterId ? null : accessibleProtocol(db, user, versionId);
      if (!starter && !version) { db.exec("ROLLBACK"); return { error: "forbidden" }; }
      document = starter ? { sequences: starter.sequences, origin: { id: starter.id, version: dictionaryVersion } } : JSON.parse(version.payload);
      sourceId = version?.id ?? null; sequence = 0;
    } else {
      document = current ? JSON.parse(current.payload) : { sequences: [sequenceFromPlan(plan ?? defaultPlan)] };
      if (!plan) { db.exec("ROLLBACK"); return { error: "invalid" }; }
      document.sequences[sequence].plan = plan;
      if (action === "select") {
        if (!Number.isInteger(selected) || selected < 0 || selected >= document.sequences.length) {
          db.exec("ROLLBACK"); return { error: "invalid" };
        }
        sequence = selected;
      } else if (action === "save") {
        const saved = appendVersion(db, user, "personal", cleanName(name), document, sourceId);
        if (saved.error) { db.exec("ROLLBACK"); return saved; }
        sourceId = saved.id;
      } else if (action !== "update") { db.exec("ROLLBACK"); return { error: "invalid" }; }
    }
    const valid = validateProtocol(document);
    if (!valid) { db.exec("ROLLBACK"); return { error: "invalid" }; }
    db.prepare(`INSERT INTO mri_exam_protocols (accession, source_version_id, payload, selected_sequence, revision)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(accession) DO UPDATE SET source_version_id = excluded.source_version_id,
        payload = excluded.payload, selected_sequence = excluded.selected_sequence, revision = excluded.revision`)
      .run(accession, sourceId, JSON.stringify(valid), sequence, revision + 1);
    recordExamEvent(db, accession, user.id, `protocol_${action}`, "exam_begin", "exam_begin", { sourceVersion: sourceId, selectedSequence: sequence + 1 });
    db.exec("COMMIT"); return { revision: revision + 1 };
  } catch (error) { if (db.isTransaction) db.exec("ROLLBACK"); throw error; }
}
