import assert from "node:assert/strict";
import { createHash, scryptSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { requestThrough } from "../test-support/request.js";
import { consoleHandoff, createRequestHandler } from "../src/app.js";
import { authenticate, createUser, openDatabase, sessionUser } from "../src/db.js";

test("superuser exercises both workspaces and ordinary RIS access remains scoped", async () => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-test-"));
  const filename = join(directory, "test.sqlite");
  let db = openDatabase(filename);
  let handle = createRequestHandler(db);
  const password = "only-used-by-the-integration-test";

  const request = (path, options) => requestThrough(handle, path, options);

  async function signIn(username) {
    const response = await request("/sign-in", { fields: { username, password } });
    assert.equal(response.status, 303);
    const setCookie = response.headers.get("Set-Cookie");
    assert.match(setCookie, /HttpOnly; SameSite=Lax/);
    return setCookie.split(";")[0];
  }

  async function launchKey(cookie) {
    const response = await request("/ris", { cookie });
    assert.equal(response.status, 200);
    return (await response.text()).match(/name="launchKey" value="([a-f0-9]+)"/)[1];
  }

  try {
    createUser(db, "student-a", "student", password);
    createUser(db, "student-b", "student", password);
    createUser(db, "instructor", "instructor", password);
    createUser(db, "admin", "admin", password);

    assert.equal((await request("/ris")).headers.get("Location"), "/sign-in");
    assert.equal((await request("/sign-in", { fields: { username: "student-a", password: "wrong" } })).status, 401);
    const student = await signIn("student-a");
    const other = await signIn("student-b");
    const faculty = await signIn("instructor");
    const admin = await signIn("admin");
    assert.equal((await request("/", { cookie: admin })).headers.get("Location"), "/ris");
    assert.match(await (await request("/instructor", { cookie: admin })).text(), /<h1>Instructor home<\/h1>/);
    assert.equal((await request("/instructor", { cookie: student })).status, 403);
    assert.match(await (await request("/", { cookie: faculty })).text(), /Instructor home/);
    assert.equal((await request("/ris", { cookie: faculty })).status, 403);

    const orderFields = { scenario: "routine-brain", launchKey: await launchKey(student) };
    assert.equal((await request("/ris/orders", { cookie: student, fields: orderFields, origin: "http://elsewhere.test" })).status, 403);
    assert.equal((await request("/ris/orders", { cookie: faculty, fields: orderFields })).status, 403);

    const launches = await Promise.all([
      request("/ris/orders", { cookie: student, fields: orderFields }),
      request("/ris/orders", { cookie: student, fields: orderFields }),
    ]);
    assert.equal(launches[0].status, 303);
    const routinePath = launches[0].headers.get("Location");
    assert.match(routinePath, /^\/ris\/orders\/SIM-[A-F0-9]{16}$/);
    assert.equal(launches[1].headers.get("Location"), routinePath);
    assert.match(await (await request(routinePath, { cookie: student })).text(), /Persistent headaches/);
    assert.equal((await request(routinePath, { cookie: faculty })).status, 403);
    assert.equal((await request(routinePath, { cookie: other })).status, 404);

    const routineAccession = routinePath.split("/").at(-1);
    const account = username => db.prepare("SELECT u.id, m.role, m.institution_id AS institutionId FROM users u JOIN institution_memberships m ON m.user_id = u.id WHERE u.username = ?").get(username);
    const owner = account("student-a");
    const otherUser = account("student-b");
    const adminUser = account("admin");
    assert.equal(consoleHandoff(db, owner, routineAccession), null);
    const routineScreen = routinePath + "/screening";
    const clear = { implant: "no", metal: "no", tolerance: "no" };
    assert.equal((await request(routineScreen, { cookie: other, fields: clear })).status, 404);
    assert.equal((await request(routineScreen, { cookie: student, fields: { implant: "no" } })).status, 400);
    const allOrders = await (await request("/ris", { cookie: admin })).text();
    assert.match(allOrders, /href="\/instructor"/);
    assert.match(allOrders, /<td>student-a<\/td>/);
    assert.equal((await request(routinePath, { cookie: admin })).status, 200);
    assert.equal((await request(routineScreen, { cookie: admin, fields: clear })).status, 303);
    const expectedHandoff = {
      accession: routineAccession, examKey: "mr-brain-v1", modality: "MR", consolePath: "/console/mr",
    };
    assert.deepEqual(consoleHandoff(db, owner, routineAccession), expectedHandoff);
    assert.deepEqual(consoleHandoff(db, adminUser, routineAccession), expectedHandoff);
    assert.equal(consoleHandoff(db, otherUser, routineAccession), null);

    const held = await request("/ris/orders", {
      cookie: student, fields: { scenario: "implant-review", launchKey: await launchKey(student) },
    });
    assert.equal(held.status, 303);
    const heldPath = held.headers.get("Location");
    const heldScreen = heldPath + "/screening";
    assert.match(await (await request(heldPath, { cookie: student })).text(), /implanted neurostimulator/);
    assert.equal((await request(heldScreen, { cookie: student, fields: { ...clear, implant: "unsure" } })).status, 303);
    assert.equal((await request(heldScreen, { cookie: student, fields: clear })).status, 409);
    assert.equal(consoleHandoff(db, owner, heldPath.split("/").at(-1)), null);
    assert.equal(consoleHandoff(db, adminUser, heldPath.split("/").at(-1)), null);

    const adminLaunch = await request("/ris/orders", {
      cookie: admin, fields: { scenario: "implant-review", launchKey: await launchKey(admin) },
    });
    assert.equal(adminLaunch.status, 303);
    const adminPath = adminLaunch.headers.get("Location");
    assert.equal((await request(adminPath + "/screening", {
      cookie: admin, fields: { ...clear, implant: "yes" },
    })).status, 303);
    assert.match(await (await request(adminPath, { cookie: admin })).text(), /Screening hold/);
    assert.equal((await request(adminPath, { cookie: student })).status, 404);

    assert.equal((await request("/sign-out", { cookie: student, fields: {} })).status, 303);
    assert.equal((await request("/ris", { cookie: student })).headers.get("Location"), "/sign-in");
    db.close();
    db = openDatabase(filename);
    handle = createRequestHandler(db);

    const resumed = await signIn("student-a");
    const worklist = await (await request("/ris", { cookie: resumed })).text();
    assert.match(worklist, new RegExp(routineAccession));
    assert.match(worklist, /Ready for console/);
    assert.match(worklist, /Screening hold/);
    assert.equal((worklist.match(/Morgan Ellis/g) ?? []).length, 1);
    assert.match(await (await request(heldPath, { cookie: resumed })).text(), /saved-answer">Unsure/);

    assert.equal((await request("/sign-out", { cookie: admin, fields: {} })).status, 303);
    assert.equal((await request("/instructor", { cookie: admin })).headers.get("Location"), "/sign-in");
    const resumedAdmin = await signIn("admin");
    const adminWorklist = await (await request("/ris", { cookie: resumedAdmin })).text();
    assert.ok(adminWorklist.includes(routineAccession));
    assert.ok(adminWorklist.includes(adminPath));
  } finally {
    if (db.isOpen) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy accounts and active sessions survive role and institution migrations", async () => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-legacy-"));
  const filename = join(directory, "legacy.sqlite");
  let db = new DatabaseSync(filename);
  const password = "only-used-by-the-migration-test";

  try {
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
        salt TEXT NOT NULL,
        password_hash BLOB NOT NULL
      ) STRICT;
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users (id),
        expires_at INTEGER NOT NULL
      ) STRICT;
    `);
    const salt = "legacy-test-salt";
    const { lastInsertRowid: id } = db.prepare("INSERT INTO users VALUES (NULL, ?, ?, ?, ?)")
      .run("existing-student", "student", salt, scryptSync(password, salt, 64));
    const token = "legacy-test-token";
    db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
      createHash("sha256").update(token).digest("hex"), id, Date.now() + 60000);
    db.close();

    db = openDatabase(filename);
    assert.equal(await authenticate(db, "existing-student", password), id);
    assert.equal(sessionUser(db, token).role, "student");
    createUser(db, "new-admin", "admin", password);
    assert.ok(await authenticate(db, "new-admin", password));
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    if (db.isOpen) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
