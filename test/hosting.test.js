import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestHandler } from "../src/app.js";
import { createUser, openDatabase } from "../src/db.js";
import { requestThrough } from "../test-support/request.js";

test("the configured HTTPS proxy origin gets secure cookies and rejects unexpected hosts and origins", async () => {
  const db = openDatabase(":memory:");
  const host = "192.168.1.50:8443";
  const origin = `https://${host}`;
  try {
    createUser(db, "student", "student", "hosting-test-only");
    assert.throws(() => createRequestHandler(db, { publicOrigin: `http://${host}` }), /HTTPS origin/);
    assert.throws(() => createRequestHandler(db, { publicOrigin: `${origin}/extra` }), /HTTPS origin/);
    const handle = createRequestHandler(db, { publicOrigin: origin });
    const fields = { username: "student", password: "hosting-test-only" };
    assert.equal((await requestThrough(handle, "/sign-in", { host })).status, 200);
    assert.equal((await requestThrough(handle, "/sign-in", {
      headers: { "x-forwarded-host": host, "x-forwarded-proto": "https" },
    })).status, 403);
    assert.equal((await requestThrough(handle, "/sign-in", { host, fields, origin: `http://${host}` })).status, 403);
    assert.equal((await requestThrough(handle, "https://elsewhere.test/sign-in", { host })).status, 403);
    const signIn = await requestThrough(handle, "/sign-in", { host, fields, origin });
    assert.equal(signIn.status, 303);
    const session = signIn.headers.get("Set-Cookie");
    assert.match(session, /; Secure/);
    const signOut = await requestThrough(handle, "/sign-out", { host, fields: {}, origin, cookie: session.split(";")[0] });
    assert.equal(signOut.status, 303);
    assert.match(signOut.headers.get("Set-Cookie"), /Max-Age=0; Secure/);
  } finally {
    db.close();
  }
});
