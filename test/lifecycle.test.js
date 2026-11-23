import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRequestHandler } from "../src/app.js";
import { accessibleOrder, createOrderRequest, createUser, launchOrder, openDatabase, saveAcquisition, savePacsSelection, startSession } from "../src/db.js";
import { exams, scenarios } from "../src/exams.js";
import { examHistory, transitionExam } from "../src/lifecycle.js";
import { acquireMr, defaultPlan } from "../src/mr.js";
import { localAppointment } from "../src/scheduling.js";
import { requestThrough } from "../test-support/request.js";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "medsim-lifecycle-"));
  const filename = join(directory, "test.sqlite");
  let db = openDatabase(filename);
  let handle = createRequestHandler(db);
  function account(username, role, institutionId = 1) {
    createUser(db, username, role, "lifecycle-test-only", institutionId);
    const { id } = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    return { id, role, institutionId, cookie: `medsim_session=${startSession(db, id, institutionId)}` };
  }
  const student = account("student", "student");
  const peer = account("peer", "student");
  const instructor = account("instructor", "instructor");
  const admin = account("admin", "admin");
  db.exec("INSERT INTO institutions (slug, name) VALUES ('other', 'Other school')");
  const foreign = account("foreign", "instructor", 2);
  const launch = (key, owner = student) => launchOrder(db, owner, scenarios["routine-brain"], exams["mr-brain-v1"], key);
  const request = (path, user = student, fields) => requestThrough(handle, path, { cookie: user.cookie, fields });
  const state = accession => accessibleOrder(db, student, accession);
  const action = (accession, action, user = student, details = {}) => request(`/ris/orders/${accession}/${action}`, user,
    { workflowRevision: state(accession)?.workflow_revision ?? 0, ...details });
  const screen = accession => request(`/ris/orders/${accession}/screening`, student, { implant: "no", metal: "no", tolerance: "no" });
  return { get db() { return db; }, student, peer, instructor, admin, foreign, launch, request, state, action, screen,
    restart() { db.close(); db = openDatabase(filename); handle = createRequestHandler(db); },
    close() { db.close(); rmSync(directory, { recursive: true, force: true }); } };
}

test("RIS stages enforce explicit start, end prerequisites, independent completion, and persisted recent review", async () => {
  const f = fixture();
  try {
    createOrderRequest(f.db, f.student, { patientName: "Unscheduled Fictional" }, "pending", "manual");
    for (const role of [f.student, f.instructor, f.admin]) {
      assert.doesNotMatch(await (await f.request("/ris", role)).text(), /Unscheduled Fictional/);
      assert.doesNotMatch(await (await f.request("/ris/recent", role)).text(), /Unscheduled Fictional/);
    }
    const accession = f.launch("normal");
    const path = `/ris/orders/${accession}`;
    const consolePath = `/console/mr/${accession}`;
    assert.match(await (await f.request("/ris")).text(), /class="status scheduled">Scheduled/);
    assert.equal((await f.action(accession, "begin")).status, 409);
    assert.equal((await f.action(accession, "complete")).status, 409);
    assert.equal((await f.screen(accession)).status, 303);
    assert.equal(f.state(accession).workflow_status, "screened");
    assert.equal((await f.request(consolePath)).status, 404);
    assert.equal((await f.action(accession, "begin", f.instructor)).status, 409);
    assert.equal((await f.action(accession, "begin")).status, 303);
    assert.equal((await f.request(path + "/begin", f.student, { workflowRevision: 1 })).status, 409);
    assert.equal((await f.request(consolePath)).status, 200);
    assert.equal((await f.action(accession, "end", f.student, { performedVerified: "yes" })).status, 409);
    const acquisition = acquireMr(defaultPlan);
    const id = saveAcquisition(f.db, f.student, accession, "saved-before-end", acquisition);
    assert.ok(id);
    assert.equal((await f.action(accession, "end")).status, 409);
    assert.equal((await f.action(accession, "end", f.student, { performedVerified: "yes", notes: "n".repeat(4001) })).status, 409);
    assert.equal((await f.action(accession, "end", f.student, { performedVerified: "yes", notes: "Fictional motion repeat <checked>." })).status, 303);
    assert.equal(f.state(accession).workflow_status, "exam_end");
    assert.doesNotMatch(await (await f.request("/ris")).text(), new RegExp(accession));
    const recent = await (await f.request("/ris/recent")).text();
    assert.match(recent, /href="\/training\/USER_GUIDE.html#end-complete-review-and-correct-an-exam" target="_blank" rel="noopener noreferrer"/);
    assert.match(recent, new RegExp(accession));
    assert.match(recent, /Exam End/);
    const review = await (await f.request(consolePath)).text();
    assert.match(review, /Image review only/);
    assert.doesNotMatch(review, /Run scan|Save PACS selection/);
    assert.equal((await f.request(consolePath + `/pixels/${id}`)).status, 200);
    assert.equal((await f.request(consolePath + `/selection/${id}`, f.student, { width: 100, level: 100 })).status, 404);
    assert.equal(savePacsSelection(f.db, 1, accession, id, { width: 100, level: 100 }), false);
    assert.equal(saveAcquisition(f.db, f.student, accession, "worker-finishing-after-end", acquisition), undefined);
    // Completion is explicit RIS progress, with neither a selected series nor a PACS acknowledgment required.
    assert.equal((await f.action(accession, "complete")).status, 303);
    assert.equal(f.state(accession).workflow_status, "completed");
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM pacs_selections").get().n, 0);
    f.restart();
    assert.equal(f.state(accession).workflow_status, "completed");
    const page = await (await f.request(path)).text();
    assert.match(page, /Fictional motion repeat &lt;checked&gt;/);
    assert.ok(f.state(accession).begun_at && f.state(accession).ended_at && f.state(accession).completed_at);
    assert.deepEqual(examHistory(f.db, accession).map(e => e.action), ["complete", "end", "begin", "screening"]);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("all roles can reopen before review, instructor opening locks every correction route, and send-back restores correction", async () => {
  const f = fixture();
  try {
    const acquisition = acquireMr(defaultPlan);
    for (const role of [f.student, f.instructor, f.admin]) {
      const accession = f.launch(role.role);
      await f.screen(accession); await f.action(accession, "begin");
      const id = saveAcquisition(f.db, f.student, accession, "first", acquisition);
      await f.action(accession, "end", f.student, { performedVerified: "yes", notes: "Original note" });
      await f.action(accession, "complete");
      const previous = f.state(accession);
      assert.equal((await f.action(accession, "reopen", role)).status, 303);
      assert.equal(f.state(accession).workflow_status, "exam_begin");
      assert.equal(f.state(accession).notes, "Original note");
      assert.equal(f.state(accession).completed_at, previous.completed_at);
      assert.equal(f.state(accession).correction_cycle, 1);
      assert.equal(saveAcquisition(f.db, f.student, accession, "old-worker", acquisition, previous.workflow_revision), undefined);
      assert.equal((await f.request(`/console/mr/${accession}`, role)).status, 200);
      assert.ok(saveAcquisition(f.db, role, accession, "correction", acquisition));
      await f.action(accession, "end", role, { performedVerified: "yes", notes: "Corrected note" });
      await f.action(accession, "complete", f.student);
      const stale = f.state(accession).workflow_revision;
      assert.equal((await f.request(`/ris/orders/${accession}`, f.instructor)).status, 200);
      assert.equal(f.state(accession).locked_by, f.instructor.id);
      const events = examHistory(f.db, accession).length;
      await f.request(`/ris/orders/${accession}`, f.instructor);
      assert.equal(examHistory(f.db, accession).length, events);
      for (const actor of [f.student, f.admin, f.instructor]) {
        assert.equal((await f.action(accession, "reopen", actor)).status, 409);
        assert.equal((await f.action(accession, "complete", actor)).status, 409);
        assert.equal(saveAcquisition(f.db, actor, accession, "locked", acquisition), undefined);
      }
      assert.equal((await f.request(`/ris/orders/${accession}/reopen`, f.student, { workflowRevision: stale })).status, 409);
      assert.equal((await f.request(`/console/mr/${accession}/pixels/${id}`, f.instructor)).status, 200);
      for (const actor of [f.peer, f.foreign]) {
        assert.equal((await f.request(`/ris/orders/${accession}`, actor)).status, 404);
        assert.equal((await f.action(accession, "reopen", actor)).status, 404);
        assert.equal((await f.action(accession, "return", actor, { reason: "No access" })).status, 404);
        assert.doesNotMatch(await (await f.request("/ris/recent", actor)).text(), new RegExp(accession));
      }
      assert.equal((await f.action(accession, "return", f.admin, { reason: "Admin cannot release review" })).status, 409);
      assert.equal((await f.action(accession, "return", f.instructor, { reason: "  " })).status, 409);
      const lockedRevision = f.state(accession).workflow_revision;
      f.restart();
      assert.equal(f.state(accession).locked_by, f.instructor.id);
      assert.equal((await f.action(accession, "return", f.instructor, { reason: "Please correct the slice coverage." })).status, 303);
      assert.equal(f.state(accession).workflow_status, "exam_begin");
      assert.equal(f.state(accession).locked_by, null);
      assert.equal((await f.request(`/ris/orders/${accession}/return`, f.instructor,
        { workflowRevision: lockedRevision, reason: "Stale return" })).status, 409);
      await f.request(`/ris/orders/${accession}`, f.instructor);
      assert.equal(f.state(accession).locked_by, null); // Active correction is not locked by instructor inspection.
      assert.ok(saveAcquisition(f.db, f.student, accession, "after-return", acquisition));
      await f.action(accession, "end", f.student, { performedVerified: "yes" });
      // A direct image-review URL also locks an ended study, not just the RIS details page.
      assert.equal((await f.request(`/console/mr/${accession}`, f.instructor)).status, 200);
      assert.equal(f.state(accession).locked_by, f.instructor.id);
      assert.match(JSON.stringify(examHistory(f.db, accession)), /Please correct the slice coverage/);
    }
  } finally { f.close(); }
});

test("additive workflow migration retains legacy appointments, screening, acquisitions, selections and subsequent locks", async () => {
  const f = fixture();
  try {
    const pending = f.launch("legacy-pending");
    const held = f.launch("legacy-held");
    const screened = f.launch("legacy-screened");
    const begun = f.launch("legacy-begun");
    await f.screen(screened); await f.screen(begun); await f.action(begun, "begin");
    await f.request(`/ris/orders/${held}/screening`, f.student, { implant: "yes", metal: "no", tolerance: "no" });
    const acquisition = acquireMr(defaultPlan);
    const id = saveAcquisition(f.db, f.student, begun, "legacy-image", acquisition);
    assert.equal(savePacsSelection(f.db, 1, begun, id, { width: 180, level: 90 }), true);
    const original = f.db.prepare("SELECT * FROM orders ORDER BY id").all();
    f.db.exec("DROP TABLE exam_events; DROP TABLE exam_workflow;");
    f.restart();
    assert.deepEqual(f.db.prepare("SELECT * FROM orders ORDER BY id").all(), original);
    assert.equal(f.state(pending).workflow_status, "scheduled");
    assert.equal(f.state(held).status, "held");
    assert.equal(f.state(held).workflow_status, "scheduled");
    assert.equal(f.state(screened).workflow_status, "screened");
    assert.equal(f.state(begun).workflow_status, "exam_begin");
    assert.deepEqual(f.db.prepare("SELECT pixels FROM acquisitions WHERE id = ?").get(id).pixels, acquisition.pixels);
    assert.equal(f.db.prepare("SELECT window_width FROM pacs_selections WHERE accession = ?").get(begun).window_width, 180);
    await f.action(begun, "end", f.student, { performedVerified: "yes" });
    await f.request(`/ris/orders/${begun}`, f.instructor);
    const before = f.state(begun);
    f.restart();
    assert.deepEqual(f.state(begun), before);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM exam_workflow").get().n, 4);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("screening holds, future appointments, and stale transitions cannot bypass exam prerequisites", async () => {
  const f = fixture();
  try {
    const held = f.launch("held");
    await f.request(`/ris/orders/${held}/screening`, f.student, { implant: "unsure", metal: "no", tolerance: "no" });
    assert.equal((await f.action(held, "begin")).status, 409);
    assert.equal(f.state(held).workflow_status, "scheduled");
    const accession = f.launch("future");
    await f.screen(accession);
    const tomorrow = new Date(new Date(localAppointment().date + "T12:00:00Z").valueOf() + 86400000).toISOString().slice(0, 10);
    f.db.prepare("UPDATE orders SET appointment_date = ? WHERE accession = ?").run(tomorrow, accession);
    assert.equal((await f.action(accession, "begin")).status, 409);
    assert.equal((await f.request(`/console/mr/${accession}`)).status, 404);
    f.db.prepare("UPDATE orders SET appointment_date = ? WHERE accession = ?").run(localAppointment().date, accession);
    const revision = f.state(accession).workflow_revision;
    const replies = await Promise.all([f.action(accession, "begin"), f.action(accession, "begin")]);
    assert.deepEqual(replies.map(r => r.status).sort(), [303, 409]);
    assert.equal(transitionExam(f.db, f.foreign, accession, revision, "begin"), false);
    assert.equal((await f.request(`/ris/orders/${accession}/begin`, f.student, {})).status, 400);
  } finally { f.close(); }
});
