import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRequestHandler } from "../src/app.js";
import { createUser, openDatabase, startSession } from "../src/db.js";
import { missingIntake, quickOrder } from "../src/intake.js";
import { requestThrough } from "../test-support/request.js";

const complete = {
  patientName: "Jamie Example", patientId: "SIM-12345", dob: "1990-03-04", sex: "Female",
  examKey: "mr-brain-v1", indication: "Fictional headache exercise", history: "No reported devices.",
};
const verified = { check_demographics: "verified", check_exam: "verified", check_indication: "verified" };
const key = () => randomBytes(16).toString("hex");

test("intake requires completeness review, keeps an assessment trail, and schedules once across retries", async () => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-intake-"));
  const filename = join(directory, "test.sqlite");
  let db = openDatabase(filename);
  let handle = createRequestHandler(db);
  const request = (path, cookie, fields) => requestThrough(handle, path, { cookie, fields });
  function account(name, role, institutionId = 1) {
    createUser(db, name, role, "intake-test-only", institutionId);
    const { id } = db.prepare("SELECT id FROM users WHERE username = ?").get(name);
    return `medsim_session=${startSession(db, id, institutionId)}`;
  }
  try {
    const student = account("student", "student");
    const other = account("other", "student");
    const instructor = account("instructor", "instructor");
    const admin = account("admin", "admin");
    db.prepare("INSERT INTO institutions (slug, name) VALUES ('second', 'Second school')").run();
    const foreign = account("foreign-admin", "admin", 2);
    assert.equal((await request("/", student)).headers.get("location"), "/queue");
    assert.match(await (await request("/queue", instructor)).text(), /<h1>Order queue/);

    const incomplete = { ...complete, patientId: "", examKey: "", indication: "" };
    const fields = { ...incomplete, requestKey: key() };
    const creates = await Promise.all([request("/queue", student, fields), request("/queue", student, fields)]);
    const path = creates[0].headers.get("location");
    assert.equal(creates[0].status, 303);
    assert.equal(creates[1].headers.get("location"), path);
    const id = Number(path.split("/").at(-1));
    assert.equal(db.prepare("SELECT count(*) AS n FROM order_requests").get().n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM orders").get().n, 0);
    assert.equal((await request(path, other)).status, 404);
    assert.equal((await request(path, foreign)).status, 404);
    assert.equal((await request(path, instructor)).status, 200);
    assert.ok(!(await (await request("/ris", student)).text()).includes(complete.patientName));

    const attempt = { ...incomplete, ...verified, action: "schedule", revision: 0 };
    const blocked = await request(path, student, attempt);
    assert.equal(blocked.status, 400);
    assert.match(await blocked.text(), /Required information is missing/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM orders").get().n, 0);
    const review = db.prepare("SELECT * FROM order_reviews WHERE request_id = ?").get(id);
    assert.equal(review.action, "schedule_blocked");
    assert.deepEqual(JSON.parse(review.missing), ["patientId", "examKey", "indication"]);

    assert.equal((await request(path, student, { ...complete, action: "save", revision: 0 })).status, 409);
    assert.equal((await request(path, student, { ...incomplete, action: "needs_information", revision: 1 })).status, 200);
    assert.match(await (await request("/queue", student)).text(), /Needs information/);
    const unchecked = await request(path, student, { ...complete, action: "schedule", revision: 2 });
    assert.equal(unchecked.status, 400);
    assert.match(await unchecked.text(), /Verify all three/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM orders").get().n, 0);

    const schedule = { ...complete, ...verified, action: "schedule", revision: 3 };
    assert.equal((await request(path, foreign, schedule)).status, 404);
    const scheduled = await Promise.all([
      request(path, instructor, schedule), request(path, admin, schedule),
    ]);
    assert.ok(scheduled.every(response => response.status === 303));
    const order = db.prepare("SELECT * FROM orders").get();
    assert.equal(order.status, "ordered");
    assert.equal(order.patient_name, complete.patientName);
    assert.equal(db.prepare("SELECT count(*) AS n FROM orders").get().n, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM order_reviews WHERE action = 'scheduled'").get().n, 1);
    const intake = db.prepare("SELECT * FROM order_requests WHERE id = ?").get(id);
    assert.deepEqual(JSON.parse(intake.original_details), incomplete);
    assert.deepEqual(JSON.parse(intake.details), complete);
    assert.equal(intake.accession, order.accession);
    assert.ok(!(await (await request("/queue", student)).text()).includes(`href="${path}"`));
    assert.ok((await (await request("/ris", student)).text()).includes(order.accession));
    assert.equal((await request(`/ris/orders/${order.accession}`, student)).status, 200);
    assert.equal((await request(`/console/mr/${order.accession}`, student)).status, 404);
    assert.equal((await request(path, student, { ...complete, action: "save", revision: 4 })).status, 409);

    for (const cookie of [student, instructor, admin]) {
      const quickKey = key();
      const first = await request("/queue/quick", cookie, { requestKey: quickKey });
      assert.equal(first.status, 303);
      const retry = await request("/queue/quick", cookie, { requestKey: quickKey });
      assert.equal(retry.headers.get("location"), first.headers.get("location"));
    }
    // Instructors can create, review, and schedule their own orders.
    const instructorCreated = await request("/queue", instructor, { ...complete, requestKey: key() });
    const instructorPath = instructorCreated.headers.get("location");
    assert.equal((await request(instructorPath, instructor, { ...complete, ...verified, action: "schedule", revision: 0 })).status, 303);
    const instructorWorklist = await (await request("/ris", instructor)).text();
    assert.match(instructorWorklist, /View|Jamie Example/);

    db.close();
    db = openDatabase(filename);
    handle = createRequestHandler(db);
    assert.ok((await (await request("/ris", student)).text()).includes(order.accession));
    assert.match(await (await request(path, instructor)).text(), /Original order as received/);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal((await request("/queue", student, { ...complete, dob: "2026-02-30", requestKey: key() })).status, 400);
    assert.equal((await request("/queue", student, { ...complete, examKey: "invalid", requestKey: key() })).status, 400);
  } finally {
    if (db.isOpen) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("quick orders use an 80% complete and 20% incomplete probability", () => {
  let missing = 0;
  let full = 0;
  // Exercise each equally likely probability draw without relying on a random sample.
  for (let draw = 0; draw < 100; draw++) {
    const randomInteger = (min, max) => {
      if (max === undefined && min === 100) return draw;
      return max === undefined ? 0 : min;
    };
    const details = quickOrder(randomInteger);
    const absent = missingIntake(details);
    if (absent.length) missing++;
    else full++;
    assert.ok(absent.length <= 3);
    assert.ok(details.history.includes("Fictional"));
  }
  assert.equal(missing, 20);
  assert.equal(full, 80);
});
