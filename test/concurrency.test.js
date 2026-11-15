import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestHandler } from "../src/app.js";
import { createUser, openDatabase } from "../src/db.js";
import { defaultPlan } from "../src/mr.js";
import { generateMr, ScanQueueFull } from "../src/mr-executor.js";
import { requestThrough } from "../test-support/request.js";

test("a classroom sign-in burst fits the local limit while repeated sign-ins to one account are throttled", async () => {
  const db = openDatabase(":memory:");
  const handle = createRequestHandler(db);
  const password = "only-used-for-this-test";
  const usernames = Array.from({ length: 30 }, (_, index) => `student-${index}`);
  const login = username => requestThrough(handle, "/sign-in", { fields: { username, password } });
  try {
    for (const username of usernames) createUser(db, username, "student", password);
    const burst = await Promise.all(usernames.map(login));
    assert.ok(burst.every(response => response.status === 303));
    const repeat = await Promise.all(Array.from({ length: 20 }, () => login(usernames[0])));
    assert.equal(repeat.filter(response => response.status === 429).length, 1);
  } finally {
    db.close();
  }
});

test("MRI workers bound the scan backlog and accept more work after draining", async () => {
  const plan = { ...defaultPlan, slices: 1 };
  const burst = await Promise.allSettled(Array.from({ length: 40 }, () => generateMr(plan)));
  const completed = burst.filter(task => task.status === "fulfilled");
  const rejected = burst.filter(task => task.status === "rejected");
  assert.ok(completed.length >= 33 && completed.length <= 36);
  assert.ok(rejected.every(task => task.reason instanceof ScanQueueFull));
  assert.ok(completed.every(task => task.value.pixels.length === plan.matrix ** 2));
  assert.equal((await generateMr(plan)).pixels.length, plan.matrix ** 2);
});
