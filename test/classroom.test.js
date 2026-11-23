import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { backup, DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createRequestHandler } from "../src/app.js";
import { createUser, openDatabase, startSession } from "../src/db.js";
import { defaultPlan } from "../src/mr.js";
import { localAppointment } from "../src/scheduling.js";
import { readScanLimits } from "../src/runtime-limits.js";
import { requestThrough } from "../test-support/request.js";

const percentile = values => Math.round([...values].sort((a, b) => a - b)[Math.ceil(values.length * .95) - 1]);
const key = () => randomBytes(16).toString("hex");

test("scan configuration defaults fit a classroom and reject invalid or unbounded settings", () => {
  assert.deepEqual(readScanLimits({}, 1), { workers: 1, waiting: 64 });
  assert.deepEqual(readScanLimits({}, 32), { workers: 4, waiting: 64 });
  assert.deepEqual(readScanLimits({ MEDSIM_SCAN_WORKERS: "2", MEDSIM_SCAN_QUEUE_LIMIT: "96" }, 4), { workers: 2, waiting: 96 });
  for (const [name, bad] of [["MEDSIM_SCAN_WORKERS", "9"], ["MEDSIM_SCAN_QUEUE_LIMIT", "257"]]) {
    for (const value of ["", "0", "-1", "1.5", "Infinity", "2e1", bad]) {
      assert.throws(() => readScanLimits({ [name]: value }, 4), new RegExp(name));
    }
  }
});

test("WAL permits a snapshot reader alongside classroom writes and produces a consistent online backup", async () => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-wal-"));
  const filename = join(directory, "classroom.sqlite");
  const db = openDatabase(filename);
  const reader = new DatabaseSync(filename, { readOnly: true });
  let copy;
  try {
    assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    assert.equal(db.prepare("PRAGMA synchronous").get().synchronous, 2); // FULL durability.
    reader.exec("BEGIN");
    assert.equal(reader.prepare("SELECT count(*) AS n FROM users").get().n, 0);
    createUser(db, "wal-student", "student", "fixture-only-password");
    assert.equal(reader.prepare("SELECT count(*) AS n FROM users").get().n, 0);
    reader.exec("COMMIT");
    assert.equal(reader.prepare("SELECT count(*) AS n FROM users").get().n, 1);
    const snapshot = join(directory, "backup.sqlite");
    await backup(reader, snapshot);
    copy = openDatabase(snapshot);
    assert.equal(copy.prepare("SELECT username FROM users").get().username, "wal-student");
    assert.equal(copy.prepare("PRAGMA quick_check").get().quick_check, "ok");
    assert.deepEqual(copy.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    copy?.close(); reader.close(); db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const transport of ["handler", "http"]) test(`60 independently signed-in students complete isolated workflows over ${transport}`, async t => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-classroom-"));
  const filename = join(directory, "classroom.sqlite");
  let db = openDatabase(filename);
  const options = transport === "handler" ? { publicOrigin: "https://classroom.test" } : undefined;
  let handle = createRequestHandler(db, options);
  let server;
  let origin = "https://classroom.test";
  const users = Array.from({ length: 60 }, (_, index) => ({
    username: `class-student-${index}`, institutionId: 1,
    name: `Fictional Learner ${index}`, mrn: `CLASS-${index}`, requestKey: key(), scanKey: key(),
  }));
  const metrics = {};
  const request = async (path, user, fields) => {
    if (transport === "handler") return requestThrough(handle, path, {
      cookie: user?.cookie, fields, host: "classroom.test", origin,
    });
    const response = await fetch(origin + path, { redirect: "manual", method: fields ? "POST" : "GET",
      headers: { ...(user?.cookie ? { Cookie: user.cookie } : {}), ...(fields ? { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" } : {}) },
      body: fields ? new URLSearchParams(fields) : undefined,
    });
    // Consume each network body so all connections remain reusable under the classroom workload.
    return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
  };
  const wave = async (label, action) => {
    const times = [];
    const result = await Promise.all(users.map(async (user, index) => {
      const start = performance.now();
      const value = await action(user, index);
      times.push(performance.now() - start);
      return value;
    }));
    metrics[label] = { requests: times.length, p95_ms: percentile(times), max_ms: Math.round(Math.max(...times)) };
    return result;
  };
  try {
    if (transport === "http") {
      server = createServer((req, res) => handle(req, res));
      try {
        await new Promise((resolve, reject) => {
          server.once("error", reject);
          server.listen(0, "127.0.0.1", resolve);
        });
      } catch (error) {
        if (!["EPERM", "EACCES"].includes(error.code)) throw error;
        t.skip(`Local HTTP listener is restricted: ${error.code}; handler coverage still runs.`);
        return;
      }
      origin = `http://127.0.0.1:${server.address().port}`;
    }
    db.exec("INSERT INTO institutions (slug, name) VALUES ('second-class', 'Second class')");
    for (const user of users) {
      createUser(db, user.username, "student", "classroom-fixture-only", user.institutionId);
      user.id = db.prepare("SELECT id FROM users WHERE username = ?").get(user.username).id;
    }
    const login = user => request("/sign-in", undefined, { username: user.username, password: "classroom-fixture-only" });
    createUser(db, "other-school", "student", "classroom-fixture-only", 2);
    const outsiderId = db.prepare("SELECT id FROM users WHERE username = 'other-school'").get().id;
    const outsider = { cookie: `medsim_session=${startSession(db, outsiderId, 2)}` };
    await wave("sign_in", async user => {
      const response = await login(user);
      assert.equal(response.status, 303);
      const setCookie = response.headers.get("Set-Cookie");
      assert.ok(setCookie.includes(`HttpOnly; SameSite=Lax; Max-Age=28800${transport === "handler" ? "; Secure" : ""}`));
      user.cookie = setCookie.split(";")[0];
    });
    assert.equal(new Set(users.map(u => u.cookie)).size, 60);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sessions").get().n, 61);
    const date = localAppointment().date;
    await wave("create_schedule_begin", async (user, index) => {
      user.details = { firstName: "Fictional", lastName: `Learner ${index}`, patientId: user.mrn,
        dob: "1990-01-01", sex: "Unknown", examKey: "mr-brain-v1", indication: "Synthetic classroom exercise", history: "No reported screening concerns." };
      const created = await request("/queue", user, { ...user.details, requestKey: user.requestKey });
      assert.equal(created.status, 303);
      user.path = created.headers.get("Location");
      const scheduled = await request(user.path, user, { ...user.details, revision: 0, action: "schedule",
        appointmentDate: date, appointmentTime: "10:00", check_demographics: "verified", check_exam: "verified", check_indication: "verified" });
      assert.equal(scheduled.status, 303);
      const intake = db.prepare("SELECT accession FROM order_requests WHERE id = ?").get(Number(user.path.split("/").at(-1)));
      user.accession = intake.accession;
      user.exam = `/ris/orders/${user.accession}`;
      user.console = `/console/mr/${user.accession}`;
      assert.equal((await request(user.exam + "/screening", user, { implant: "no", metal: "no", tolerance: "no" })).status, 303);
      assert.equal((await request(user.exam + "/begin", user, { workflowRevision: 1 })).status, 303);
    });
    assert.equal(new Set(users.map(u => u.accession)).size, 60);
    await wave("scans", async user => {
      const fields = { ...Object.fromEntries(Object.entries(defaultPlan).filter(([, value]) => value !== null)), scanKey: user.scanKey };
      const running = request(user.console + "/scan", user, fields);
      const list = await request("/ris", user);
      assert.equal(list.status, 200);
      const html = await list.text();
      assert.ok(html.includes(user.accession));
      for (const peer of users) if (peer.id !== user.id) assert.ok(!html.includes(peer.accession));
      const scan = await running;
      assert.equal(scan.status, 303, "a single scan per student must fit the default classroom queue");
      user.series = Number(new URL(scan.headers.get("Location"), "https://classroom.test").searchParams.get("series"));
      assert.ok(user.series > 0);
      assert.equal((await request(user.console + `/selection/${user.series}`, user, { width: 180, level: 90 })).status, 303);
    });
    await wave("isolation_and_completion", async (user, index) => {
      const peer = users[(index + 1) % users.length];
      for (const other of [peer]) {
        assert.equal((await request(other.path, user)).status, 404);
        assert.equal((await request(other.exam, user)).status, 404);
        assert.equal((await request(other.console + `/pixels/${other.series}`, user)).status, 404);
        assert.equal((await request(other.console + `/selection/${other.series}`, user, { width: 80, level: 40 })).status, 404);
      }
      for (const path of [user.path, user.exam, user.console + `/pixels/${user.series}`]) {
        assert.equal((await request(path, outsider)).status, 404);
      }
      assert.equal((await request(user.console + `/selection/${user.series}`, outsider, { width: 80, level: 40 })).status, 404);
      assert.equal((await request(user.exam + "/end", user, { workflowRevision: 2, performedVerified: "yes", notes: user.mrn })).status, 303);
      assert.equal((await request(user.exam + "/complete", user, { workflowRevision: 3 })).status, 303);
      assert.ok(!(await (await request("/ris", user)).text()).includes(user.accession));
      const recent = await (await request("/ris/recent", user)).text();
      assert.ok(recent.includes(user.accession));
      assert.ok(!recent.includes(peer.accession));
      assert.ok(!(await (await request("/ris/recent", outsider)).text()).includes(user.accession));
    });
    assert.equal(db.prepare("SELECT count(*) AS n FROM acquisitions").get().n, 60);
    assert.equal(db.prepare("SELECT count(*) AS n FROM pacs_selections").get().n, 60);
    assert.equal(db.prepare("SELECT count(*) AS n FROM exam_workflow WHERE state = 'completed'").get().n, 60);
    assert.equal(db.prepare(`SELECT count(*) AS n FROM acquisitions a JOIN orders o ON o.accession = a.accession
      WHERE a.operator_id <> o.student_id`).get().n, 0);
    db.close(); db = openDatabase(filename);
    handle = createRequestHandler(db, options);
    await wave("resume_after_restart", async user => {
      const page = await request(user.exam, user);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.match(html, /Current stage: <strong>Completed/);
      assert.ok(html.includes(user.mrn));
    });
    // A second login for one account is a separate token. Signing out one token leaves the other classroom sessions intact.
    const oldCookie = users[0].cookie;
    const second = await login(users[0]);
    const secondCookie = second.headers.get("Set-Cookie").split(";")[0];
    assert.notEqual(oldCookie, secondCookie);
    assert.equal((await request("/sign-out", users[0], {})).status, 303);
    assert.equal((await request("/ris", users[0])).headers.get("Location"), "/sign-in");
    assert.equal((await request("/ris", { cookie: secondCookie })).status, 200);
    assert.equal((await request(users[1].exam, users[1])).status, 200);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sessions").get().n, 61);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    t.diagnostic(`60-user ${transport} measurements (local development only; not ThinkPad/HTTPS timings): ${JSON.stringify(metrics)}`);
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (db.isOpen) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
