import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestHandler } from "../src/app.js";
import { createUser, openDatabase, startSession } from "../src/db.js";
import { nextVersion, applicationVersion } from "../src/version.js";
import { requestThrough } from "../test-support/request.js";

test("release numbering increments the patch and carries after nine", () => {
  assert.equal(nextVersion("1.0.3"), "1.0.4");
  assert.equal(nextVersion("1.0.8"), "1.0.9");
  assert.equal(nextVersion("1.0.9"), "1.1.0");
  assert.equal(nextVersion("1.1.9"), "1.2.0");
  for (const invalid of ["1.0", "1.0.10", "1.00.3", "anything"]) assert.throws(() => nextVersion(invalid));
});

test("workflow help opens published guides separately, without exposing source files or relaxing app CSP", async () => {
  const db = openDatabase(":memory:");
  try {
    const handle = createRequestHandler(db);
    const request = (path, cookie) => requestThrough(handle, path, { cookie });
    const signin = await request("/sign-in");
    const html = await signin.text();
    assert.ok(html.includes(`V ${applicationVersion}</p>`));
    assert.match(html, /href="\/training\/USER_GUIDE.html#open-the-simulator-and-sign-in" target="_blank" rel="noopener noreferrer"/);
    assert.ok(!signin.headers.get("Content-Security-Policy").includes("unsafe-inline"));
    for (const name of ["USER_GUIDE", "STUDENT", "INSTRUCTOR", "ADMIN"]) {
      const page = await request(`/training/${name}.html`);
      assert.equal(page.status, 200);
      assert.match(page.headers.get("Content-Type"), /text\/html/);
      assert.match(page.headers.get("Content-Security-Policy"), /img-src data:/);
      const content = await page.text();
      assert.match(content, /data:image\/jpeg;base64,/);
      assert.ok(content.includes(`V ${applicationVersion}`));
      assert.ok(!content.includes('href="../'));
    }
    for (const role of ["student", "instructor", "admin"]) {
      createUser(db, role, role, "training-test-only");
      const { id } = db.prepare("SELECT id FROM users WHERE username = ?").get(role);
      const cookie = `medsim_session=${startSession(db, id)}`;
      const queue = await (await request("/queue", cookie)).text();
      assert.ok(queue.includes(`/training/${role.toUpperCase()}.html`));
      assert.ok(queue.includes("/training/USER_GUIDE.html#review-and-schedule-an-incoming-order"));
      const ris = await (await request("/ris", cookie)).text();
      assert.ok(ris.includes("/training/USER_GUIDE.html#find-and-screen-an-exam-in-ris"));
      if (role !== "student") assert.ok((await (await request("/instructor", cookie)).text()).includes("/training/USER_GUIDE.html#instructor-instructions"));
      for (const path of ["/training/../../package.json", "/training/package.json", "/training/Reference%20Docs/Overview%20of%20Radiant.pdf"]) {
        assert.notEqual((await request(path, cookie)).status, 200);
      }
    }
  } finally { db.close(); }
});
