import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { consoleHandoff, createRequestHandler } from "../src/app.js";
import { createUser, launchOrder, openDatabase, saveAcquisition, startSession } from "../src/db.js";
import { exams, scenarios } from "../src/exams.js";
import { acquireMr, defaultPlan } from "../src/mr.js";
import { futureOrder, localAppointment, readAppointment } from "../src/scheduling.js";
import { requestThrough } from "../test-support/request.js";

const key = () => randomBytes(16).toString("hex");
const complete = { firstName: "Jamie", lastName: "Example", patientId: "SIM-1234", dob: "1990-03-04",
  sex: "Female", examKey: "mr-brain-v1", indication: "Headache", history: "No devices reported." };
const verified = { check_demographics: "verified", check_exam: "verified", check_indication: "verified" };
const clear = { implant: "no", metal: "no", tolerance: "no" };
const dayOffset = (date, days) => new Date(new Date(date + "T12:00:00Z").valueOf() + days * 86400000).toISOString().slice(0, 10);

test("appointment validation and future restrictions follow the institution calendar across midnight and DST", () => {
  assert.equal(localAppointment(new Date("2026-11-22T03:00:00Z")).date, "2026-11-21");
  assert.equal(localAppointment(new Date("2026-11-22T03:00:00Z"), "Asia/Tokyo").date, "2026-11-22");
  assert.deepEqual(localAppointment(new Date("2026-03-08T07:00:00Z")), { date: "2026-03-08", time: "03:00" });
  assert.deepEqual(localAppointment(new Date("2026-11-01T06:30:00Z")), { date: "2026-11-01", time: "01:30" });
  const fields = { appointmentDate: "2028-02-29", appointmentTime: "23:59" };
  assert.deepEqual(readAppointment(new URLSearchParams(fields)), { date: fields.appointmentDate, time: fields.appointmentTime });
  for (const changes of [{ appointmentDate: "2026-02-29" }, { appointmentTime: "24:00" },
    { appointmentTime: "9:30" }, { appointmentTime: "" }, { appointmentDate: "" }]) {
    assert.equal(readAppointment(new URLSearchParams({ ...fields, ...changes })), null);
  }
  const duplicate = new URLSearchParams(fields);
  duplicate.append("appointmentDate", "2028-03-01");
  assert.equal(readAppointment(duplicate), null);
  const now = new Date("2026-11-22T03:00:00Z");
  assert.equal(futureOrder({ appointment_date: "2026-11-22", time_zone: "America/New_York" }, now), true);
  assert.equal(futureOrder({ appointment_date: "2026-11-22", time_zone: "Asia/Tokyo" }, now), false);
  // The restriction is on future dates. Later appointment times today may be taken today.
  assert.equal(futureOrder({ appointment_date: "2026-11-21", appointment_time: "23:59" }, now), false);
});

test("dated scheduling, worklist filters, safe rescheduling, and future exam guards survive restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-appointments-"));
  const filename = join(directory, "test.sqlite");
  let db = openDatabase(filename);
  let handle = createRequestHandler(db);
  const request = (path, user, fields) => requestThrough(handle, path, { cookie: user.cookie, fields });
  function account(username, role, institutionId = 1) {
    createUser(db, username, role, "scheduling-test-only", institutionId);
    const { id } = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    return { id, role, institutionId, cookie: `medsim_session=${startSession(db, id, institutionId)}` };
  }
  try {
    const student = account("student", "student");
    const other = account("other", "student");
    const instructor = account("instructor", "instructor");
    const admin = account("admin", "admin");
    db.prepare("INSERT INTO institutions (slug, name) VALUES ('second', 'Second school')").run();
    const foreign = account("foreign", "admin", 2);
    const today = localAppointment().date;
    const tomorrow = dayOffset(today, 1);
    const yesterday = dayOffset(today, -1);
    const created = await request("/queue", student, { ...complete, requestKey: key() });
    const path = created.headers.get("location");
    const id = Number(path.split("/").at(-1));
    const schedule = { ...complete, ...verified, revision: 0, action: "schedule" };
    const noAppointment = await request(path, student, schedule);
    assert.equal(noAppointment.status, 400);
    assert.match(await noAppointment.text(), /Select a valid appointment date and time/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM orders").get().n, 0);
    assert.deepEqual(JSON.parse(db.prepare("SELECT missing FROM order_reviews").get().missing), ["appointment"]);
    // A blocked schedule records the attempted review and increments its revision.
    const badDate = await request(path, student, { ...schedule, revision: 1, appointmentDate: "2026-02-30", appointmentTime: "09:30" });
    assert.equal(badDate.status, 400);
    const appointment = { appointmentDate: tomorrow, appointmentTime: "13:30" };
    const scheduled = await request(path, instructor, { ...schedule, ...appointment, revision: 2 });
    assert.equal(scheduled.headers.get("location"), "/queue");
    const order = db.prepare("SELECT * FROM orders").get();
    const base = `/ris/orders/${order.accession}`;
    assert.equal(order.appointment_date, tomorrow);
    assert.equal(order.appointment_time, "13:30");
    assert.equal(order.student_id, student.id);
    const originalReview = db.prepare("SELECT details FROM order_reviews WHERE action = 'scheduled'").get();
    assert.deepEqual(JSON.parse(originalReview.details).appointment, { date: tomorrow, time: "13:30", timeZone: "America/New_York" });
    const queue = await (await request("/queue", student)).text();
    assert.ok(!queue.includes(`href="${path}"`));
    assert.ok(!(await (await request("/ris", student)).text()).includes(order.accession));
    const futureList = await (await request(`/ris?date=${tomorrow}`, student)).text();
    assert.ok(futureList.includes(order.accession));
    assert.match(futureList, /13:30/);
    assert.match(futureList, /Future date — cannot start/);
    assert.match(futureList, /Reschedule appointment/);
    for (const date of ["2026-02-30", "not-a-date", ""]) assert.equal((await request(`/ris?date=${date}`, student)).status, 400);
    assert.equal((await request(`/ris?date=${today}&date=${tomorrow}`, student)).status, 400);
    assert.ok(!(await (await request(`/ris?date=${tomorrow}`, other)).text()).includes(order.accession));
    assert.ok(!(await (await request(`/ris?date=${tomorrow}`, foreign)).text()).includes(order.accession));
    assert.ok((await (await request(`/ris?date=${tomorrow}`, instructor)).text()).includes(order.accession));
    const futurePage = await (await request(base, student)).text();
    assert.match(futurePage, /future date and cannot be started/);
    assert.ok(!futurePage.includes("Submit screening"));
    assert.equal((await request(base + "/screening", student, clear)).status, 403);
    const reschedule = { appointmentDate: today, appointmentTime: "10:15", scheduleRevision: 0 };
    assert.equal((await request(base + "/reschedule", other, reschedule)).status, 404);
    assert.equal((await request(base + "/reschedule", foreign, reschedule)).status, 404);
    assert.equal((await request(base + "/reschedule", instructor, reschedule)).status, 403);
    assert.equal((await request(base + "/reschedule", student, { ...reschedule, appointmentTime: "25:00" })).status, 400);
    // Even a previously ready order cannot enter the console, generate a series, or save bytes on a future date.
    db.prepare("UPDATE orders SET status = 'ready' WHERE accession = ?").run(order.accession);
    assert.equal(consoleHandoff(db, student, order.accession), null);
    const consoleBase = `/console/mr/${order.accession}`;
    assert.equal((await request(consoleBase, student)).status, 404);
    assert.equal((await request(consoleBase + "/localizers", student)).status, 404);
    assert.equal((await request(consoleBase + "/scan", student, { scanKey: key() })).status, 404);
    const acquisition = acquireMr(defaultPlan);
    assert.equal(saveAcquisition(db, student, order.accession, key(), acquisition), undefined);
    assert.equal(db.prepare("SELECT count(*) AS n FROM acquisitions").get().n, 0);
    db.prepare("UPDATE orders SET status = 'ordered' WHERE accession = ?").run(order.accession);
    const corrected = await request(base + "/reschedule", student, reschedule);
    assert.equal(corrected.headers.get("location"), `/ris?date=${today}`);
    assert.ok((await (await request("/ris", student)).text()).includes(order.accession));
    assert.ok(!(await (await request(`/ris?date=${tomorrow}`, student)).text()).includes(order.accession));
    assert.equal((await request(base + "/reschedule", admin, { ...reschedule, appointmentDate: yesterday })).status, 409);
    assert.equal(db.prepare("SELECT appointment_date FROM orders").get().appointment_date, today);
    const history = await (await request(base, student)).text();
    assert.match(history, /Appointment history/);
    assert.ok(history.includes(`${tomorrow} 13:30 → ${today} 10:15`));
    assert.match(history, /Submit screening/);
    assert.equal((await request(base + "/screening", student, clear)).status, 303);
    assert.equal((await request(base + "/reschedule", admin, { ...reschedule, scheduleRevision: 1 })).status, 409);
    assert.ok(consoleHandoff(db, student, order.accession));
    db.close();
    db = openDatabase(filename);
    handle = createRequestHandler(db);
    assert.equal(db.prepare("SELECT appointment_date FROM orders").get().appointment_date, today);
    assert.equal(db.prepare("SELECT count(*) AS n FROM appointment_changes").get().n, 2);
    assert.ok((await (await request("/ris", student)).text()).includes(order.accession));
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    // Other-day filters include past exams and allow an admin to correct an unstarted appointment.
    const past = launchOrder(db, student, scenarios["routine-brain"], exams["mr-brain-v1"], key(), { date: yesterday, time: "08:00" });
    assert.ok((await (await request(`/ris?date=${yesterday}`, admin)).text()).includes(past));
    assert.equal((await request(`/ris/orders/${past}/reschedule`, admin, reschedule)).status, 303);
  } finally {
    if (db.isOpen) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("appointment migration preserves existing exam state and backfills creation date in the institution timezone", () => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-appointment-migration-"));
  const filename = join(directory, "test.sqlite");
  let db = openDatabase(filename);
  try {
    createUser(db, "student", "student", "migration-test-only");
    const student = { id: db.prepare("SELECT id FROM users").get().id, institutionId: 1, role: "student" };
    const accession = launchOrder(db, student, scenarios["routine-brain"], exams["mr-brain-v1"], key());
    db.prepare("UPDATE orders SET created_at = '2026-11-22 03:15:00', status = 'ready', answers = ?").run(JSON.stringify(clear));
    const acquisition = acquireMr(defaultPlan);
    const scanId = saveAcquisition(db, student, accession, key(), acquisition);
    assert.ok(scanId);
    const before = db.prepare("SELECT patient_name, answers, status FROM orders").get();
    // Reproduce the previous schema while keeping the saved user, session, order and scan.
    const session = startSession(db, student.id);
    db.exec(`DROP TABLE appointment_changes;
      DROP INDEX orders_appointment; DROP INDEX orders_student_appointment;
      ALTER TABLE orders DROP COLUMN appointment_date;
      ALTER TABLE orders DROP COLUMN appointment_time;
      ALTER TABLE orders DROP COLUMN schedule_revision;
      ALTER TABLE institutions DROP COLUMN time_zone;`);
    db.close();
    db = openDatabase(filename);
    assert.deepEqual(db.prepare("SELECT patient_name, answers, status FROM orders").get(), before);
    const migrated = db.prepare("SELECT appointment_date, appointment_time FROM orders").get();
    assert.deepEqual({ ...migrated }, { appointment_date: "2026-11-21", appointment_time: "22:15" });
    assert.equal(db.prepare("SELECT id FROM acquisitions").get().id, scanId);
    assert.deepEqual(db.prepare("SELECT pixels FROM acquisitions").get().pixels, acquisition.pixels);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sessions").get().n, 1);
    assert.ok(session);
    assert.equal(db.prepare("SELECT time_zone FROM institutions").get().time_zone, "America/New_York");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    if (db.isOpen) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
