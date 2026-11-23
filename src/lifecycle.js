// Exam progress is separate from appointment data and screening readiness.
import { futureOrder } from "./scheduling.js";
export const workflowLabels = {
  scheduled: "Scheduled", screened: "Screened", exam_begin: "Exam Begin",
  exam_end: "Exam End", completed: "Completed",
};
export const endedStates = ["exam_end", "completed"];
export const ended = order => endedStates.includes(order?.workflow_status);
export const canOperate = (user, order) => Boolean(order && !order.locked_by &&
  (user.role === "admin" || (user.role === "student" && user.id === order.student_id) ||
    (user.role === "instructor" && order.correction_cycle > 0)));

export function migrateWorkflow(db) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS exam_workflow (
      accession TEXT PRIMARY KEY REFERENCES orders(accession),
      state TEXT NOT NULL CHECK(state IN ('scheduled','screened','exam_begin','exam_end','completed')),
      revision INTEGER NOT NULL DEFAULT 0,
      begun_at TEXT, ended_at TEXT, completed_at TEXT,
      locked_by INTEGER REFERENCES users(id), locked_at TEXT,
      correction_cycle INTEGER NOT NULL DEFAULT 0,
      performed_verified INTEGER NOT NULL DEFAULT 0 CHECK(performed_verified IN (0,1)),
      notes TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE TABLE IF NOT EXISTS exam_events (
      id INTEGER PRIMARY KEY,
      accession TEXT NOT NULL REFERENCES orders(accession),
      actor_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL, from_state TEXT, to_state TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;
    CREATE INDEX IF NOT EXISTS exam_events_order ON exam_events(accession, id);
    INSERT INTO exam_workflow (accession, state, begun_at)
      SELECT o.accession,
        CASE WHEN o.status = 'ready' THEN CASE WHEN EXISTS
          (SELECT 1 FROM acquisitions a WHERE a.accession = o.accession)
          THEN 'exam_begin' ELSE 'screened' END ELSE 'scheduled' END,
        CASE WHEN o.status = 'ready' THEN
          (SELECT min(created_at) FROM acquisitions a WHERE a.accession = o.accession) END
      FROM orders o WHERE NOT EXISTS (SELECT 1 FROM exam_workflow w WHERE w.accession = o.accession);
    COMMIT;`);
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function examHistory(db, accession) {
  return db.prepare(`SELECT e.*, u.username FROM exam_events e LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.accession = ? ORDER BY e.id DESC`).all(accession);
}

export function recordExamEvent(db, accession, actorId, action, from, to, details = {}) {
  db.prepare(`INSERT INTO exam_events (accession, actor_id, action, from_state, to_state, details)
    VALUES (?, ?, ?, ?, ?, ?)`).run(accession, actorId, action, from, to, JSON.stringify(details));
}

// All mutations reread membership, ownership, revision, lock and prerequisites under a write transaction.
export function transitionExam(db, user, accession, revision, action, details = {}) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = db.prepare(`SELECT o.*, w.state AS workflow_status, w.*,
      i.time_zone, m.role AS actor_role FROM orders o
      JOIN exam_workflow w ON w.accession = o.accession
      JOIN institutions i ON i.id = o.institution_id
      JOIN institution_memberships m ON m.institution_id = o.institution_id AND m.user_id = ?
      WHERE o.accession = ? AND o.institution_id = ?
        AND (m.role <> 'student' OR o.student_id = m.user_id)`)
      .get(user.id, accession, user.institutionId);
    const actor = order && { ...user, role: order.actor_role };
    let next;
    let update = "";
    let params = [];
    if (order && (order.revision === revision || action === "review")) {
      if (action === "begin" && canOperate(actor, order) && order.workflow_status === "screened" && order.status === "ready") {
        next = "exam_begin"; update = ", begun_at = CURRENT_TIMESTAMP";
      } else if (action === "end" && canOperate(actor, order) && order.workflow_status === "exam_begin" &&
        details.performedVerified === true && typeof details.notes === "string" && details.notes.length <= 4000 &&
        db.prepare("SELECT 1 FROM acquisitions WHERE accession = ? LIMIT 1").get(accession)) {
        next = "exam_end"; update = ", ended_at = CURRENT_TIMESTAMP, performed_verified = 1, notes = ?";
        params = [details.notes.trim()];
      } else if (action === "complete" && !order.locked_by && order.workflow_status === "exam_end") {
        next = "completed"; update = ", completed_at = CURRENT_TIMESTAMP";
      } else if (action === "reopen" && !order.locked_by && ended(order)) {
        next = "exam_begin";
        update = ", correction_cycle = correction_cycle + 1, performed_verified = 0";
      } else if (action === "return" && actor.role === "instructor" && order.locked_by && ended(order) &&
        typeof details.reason === "string" && details.reason.trim() && details.reason.length <= 4000) {
        next = "exam_begin";
        update = ", locked_by = NULL, locked_at = NULL, correction_cycle = correction_cycle + 1, performed_verified = 0";
      } else if (action === "review" && actor.role === "instructor" && !order.locked_by && ended(order)) {
        next = order.workflow_status; update = ", locked_by = ?, locked_at = CURRENT_TIMESTAMP";
        params = [actor.id];
      }
    }
    // Calendar restriction applies to beginning and resuming acquisition, not historical review.
    if (next === "exam_begin" && (futureOrder(order) || order.status !== "ready")) next = undefined;
    if (!next) { db.exec("ROLLBACK"); return false; }
    db.prepare(`UPDATE exam_workflow SET state = ?, revision = revision + 1${update} WHERE accession = ?`)
      .run(next, ...params, accession);
    recordExamEvent(db, accession, actor.id, action, order.workflow_status, next, details);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}
