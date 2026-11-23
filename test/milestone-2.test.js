import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { localizerSize } from "../public/mr-geometry.js";
import { createRequestHandler } from "../src/app.js";
import { createUser, launchOrder, listAcquisitions, localInstitutionId, openDatabase, pacsSelection, startSession } from "../src/db.js";
import { exams, scenarios } from "../src/exams.js";
import { acquireMr, defaultPlan, planFromAcquisition, presets, readPlan } from "../src/mr.js";
import { requestThrough } from "../test-support/request.js";

function scanFields(page, overrides = {}) {
  const scanKey = page.match(/name="scanKey" value="([a-f0-9]+)"/)[1];
  const plan = Object.fromEntries(Object.entries(defaultPlan).filter(([, value]) => value !== null));
  return { ...plan, scanKey, ...overrides };
}

test("a screened order retains repeat scan bytes, geometry and the PACS selection after reopening", async () => {
  const directory = mkdtempSync(join(tmpdir(), "medsim-mr-test-"));
  const filename = join(directory, "test.sqlite");
  let db = openDatabase(filename);
  let handle = createRequestHandler(db);
  const request = (path, cookie, fields) => requestThrough(handle, path, { cookie, fields });

  function account(username, role, institutionId = localInstitutionId) {
    createUser(db, username, role, "only-used-in-this-test", institutionId);
    const { id } = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    return { id, institutionId, cookie: `medsim_session=${startSession(db, id, institutionId)}` };
  }

  try {
    const student = account("student", "student");
    const other = account("other-student", "student");
    const admin = account("admin", "admin");
    const instructor = account("instructor", "instructor");
    const { lastInsertRowid: secondInstitutionId } = db.prepare(
      "INSERT INTO institutions (slug, name) VALUES ('second-school', 'Second school')").run();
    const secondAdmin = account("second-admin", "admin", secondInstitutionId);
    assert.equal(startSession(db, secondAdmin.id), null);
    db.prepare("INSERT INTO institution_memberships VALUES (?, ?, 'instructor')")
      .run(secondInstitutionId, admin.id);
    const adminAtSecondSchool = `medsim_session=${startSession(db, admin.id, secondInstitutionId)}`;
    const launch = (user, scenario, key) =>
      launchOrder(db, user, scenario, exams[scenario.examKey], key);
    const accession = launch(student, scenarios["routine-brain"], "one");
    const held = launch(student, scenarios["implant-review"], "two");
    const differentAccession = launch(student, scenarios["routine-brain"], "three");
    const secondSchoolAccession = launch(secondAdmin, scenarios["routine-brain"], "one");
    const order = `/ris/orders/${accession}`;
    const consolePath = `/console/mr/${accession}`;
    const heldConsole = `/console/mr/${held}`;
    const differentConsole = `/console/mr/${differentAccession}`;
    const clear = { implant: "no", metal: "no", tolerance: "no" };

    assert.equal((await request(consolePath, student.cookie)).status, 404);
    assert.doesNotMatch(await (await request(order, student.cookie)).text(), /Open MRI console/);
    assert.equal((await request(order + "/screening", student.cookie, clear)).status, 303);
    assert.equal((await request(`/ris/orders/${held}/screening`, student.cookie, { ...clear, implant: "yes" })).status, 303);
    assert.equal((await request(`/ris/orders/${differentAccession}/screening`, student.cookie, clear)).status, 303);
    assert.equal((await request(order + "/begin", student.cookie, { workflowRevision: 1 })).status, 303);
    assert.equal((await request(`/ris/orders/${differentAccession}/begin`, student.cookie, { workflowRevision: 1 })).status, 303);
    assert.ok((await (await request(order, student.cookie)).text()).includes(`href="${consolePath}"`));
    assert.doesNotMatch(await (await request(`/ris/orders/${held}`, student.cookie)).text(), /Open MRI console/);
    assert.equal((await request(heldConsole, admin.cookie)).status, 404);
    assert.equal((await request(consolePath, instructor.cookie)).status, 404);
    assert.equal((await request(consolePath, other.cookie)).status, 404);
    assert.equal((await request(consolePath, admin.cookie)).status, 200);
    assert.equal((await request(consolePath, secondAdmin.cookie)).status, 404);
    assert.equal((await request(order, secondAdmin.cookie)).status, 404);
    assert.equal((await request("/ris", adminAtSecondSchool)).status, 200);
    assert.equal((await request("/instructor", adminAtSecondSchool)).status, 200);
    const secondWorklist = await (await request("/ris", secondAdmin.cookie)).text();
    assert.ok(secondWorklist.includes(secondSchoolAccession));
    assert.ok(!secondWorklist.includes(accession));
    assert.ok(!(await (await request("/ris", admin.cookie)).text()).includes(secondSchoolAccession));

    const page = await (await request(consolePath, student.cookie)).text();
    assert.match(page, /src="\/mr-console.js"/);
    assert.match(page, /Patient and exam[\s\S]*Morgan Ellis[\s\S]*Persistent headaches/);
    assert.match(page, /Protocol and sequences[\s\S]*Positioning localizers[\s\S]*Scan parameters[\s\S]*name="preset" form="mr-plan"[\s\S]*Series preview/);
    assert.deepEqual([...page.matchAll(/data-plane="([a-z]+)"/g)].map(match => match[1]), ["axial", "coronal", "sagittal"]);
    const localizers = await request(consolePath + "/localizers", student.cookie);
    const localizerBytes = new Uint8Array(await localizers.arrayBuffer());
    assert.equal(localizerBytes.byteLength, 3 * localizerSize ** 2);
    assert.ok(localizerBytes.some(value => value > 100));
    assert.equal((await request(heldConsole + "/localizers", admin.cookie)).status, 404);

    const fields = scanFields(page);
    assert.equal((await request(heldConsole + "/scan", admin.cookie, fields)).status, 404);
    assert.equal((await request(consolePath + "/scan", other.cookie, fields)).status, 404);
    assert.equal((await request(consolePath + "/scan", student.cookie, { ...fields, slices: 24, thickness: 12 })).status, 400);
    assert.equal((await request(consolePath + "/scan", student.cookie, { ...fields, preset: "ir" })).status, 400);
    assert.equal(listAcquisitions(db, localInstitutionId, accession).length, 0);

    const [first, retry] = await Promise.all([
      request(consolePath + "/scan", student.cookie, fields),
      request(consolePath + "/scan", student.cookie, fields),
    ]);
    assert.equal(first.status, 303);
    const firstLocation = first.headers.get("location");
    assert.equal(firstLocation, retry.headers.get("location"));
    const firstId = Number(new URL(firstLocation, "http://localhost").searchParams.get("series"));
    const firstView = await (await request(firstLocation, student.cookie)).text();
    assert.match(firstView, /T1 spin echo/);
    assert.equal(listAcquisitions(db, localInstitutionId, accession).length, 1);

    async function pixels(path, id, cookie = student.cookie) {
      const response = await request(`${path}/pixels/${id}`, cookie);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/octet-stream");
      return Buffer.from(await response.arrayBuffer());
    }

    const original = await pixels(consolePath, firstId);
    assert.equal(original.length, defaultPlan.slices * defaultPlan.matrix ** 2);
    const repeat = await request(consolePath + "/scan", student.cookie, scanFields(firstView, {
      preset: "t2", tr: 3500, te: 95, plane: "coronal", angle: 20, slices: 13, gap: 2, fov: 210,
    }));
    assert.equal(repeat.status, 303);
    const [second, firstRecord] = listAcquisitions(db, localInstitutionId, accession);
    assert.equal(firstRecord.id, firstId);
    const geometry = JSON.parse(second.geometry);
    assert.equal(geometry.centersMm.length, 13);
    assert.equal(geometry.coverage, 89);
    assert.equal(geometry.angle, 20);
    assert.equal(geometry.plane, "coronal");
    assert.equal(JSON.parse(second.parameters).te, 95);
    assert.equal(firstRecord.source_version, "synthetic-brain-v1");
    assert.equal(firstRecord.engine_version, "analytic-mr-v2");
    assert.equal((await pixels(consolePath, second.id, admin.cookie)).length, 13 * 128 ** 2);
    assert.deepEqual(await pixels(consolePath, firstId), original);
    assert.equal((await request(`${consolePath}/pixels/${firstId}`, other.cookie)).status, 404);
    assert.equal((await request(`${consolePath}/pixels/${firstId}`, secondAdmin.cookie)).status, 404);
    assert.deepEqual(listAcquisitions(db, secondInstitutionId, accession), []);
    assert.equal((await request(`${differentConsole}/pixels/${firstId}`, student.cookie)).status, 404);

    const presentation = { width: 120, level: 76 };
    assert.equal((await request(`${consolePath}/selection/${firstId}`, student.cookie, { ...presentation, width: 0 })).status, 400);
    assert.equal((await request(`${differentConsole}/selection/${firstId}`, student.cookie, presentation)).status, 404);
    assert.equal((await request(`${consolePath}/selection/${firstId}`, other.cookie, presentation)).status, 404);
    assert.equal((await request(`${consolePath}/selection/${firstId}`, secondAdmin.cookie, presentation)).status, 404);
    assert.equal((await request(`${consolePath}/selection/${firstId}`, student.cookie, presentation)).status, 303);

    db.close();
    db = openDatabase(filename);
    handle = createRequestHandler(db);
    const reopened = await (await request(consolePath, student.cookie)).text();
    assert.match(reopened, new RegExp(`Selected for PACS · Series ${firstId} · W 120 / L 76`));
    assert.ok(reopened.includes(`data-pixels="${consolePath}/pixels/${second.id}"`));
    assert.match(reopened, new RegExp(`draggable="true" data-series="${firstId}"`));
    const previewResponse = await request(`${consolePath}/preview/${firstId}`, student.cookie);
    assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.text();
    assert.ok(preview.includes(`data-pixels="${consolePath}/pixels/${firstId}"`));
    assert.ok(preview.includes(`action="${consolePath}/selection/${firstId}"`));
    assert.match(preview, /name="width"[^>]*\s+value="120"/);
    assert.match(preview, /name="level"[^>]*\s+value="76"/);
    assert.doesNotMatch(preview, /id="mr-plan"/);
    assert.equal((await request(`${consolePath}/preview/${firstId}`, secondAdmin.cookie)).status, 404);
    assert.equal((await request(`${differentConsole}/preview/${firstId}`, student.cookie)).status, 404);
    assert.deepEqual({ ...pacsSelection(db, localInstitutionId, accession) }, { id: firstId, ...presentation });
    assert.deepEqual(await pixels(consolePath, firstId), original);
    assert.equal(listAcquisitions(db, localInstitutionId, accession).length, 2);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.prepare("DELETE FROM institution_memberships WHERE institution_id = ? AND user_id = ?")
      .run(secondInstitutionId, admin.id);
    assert.equal((await request("/instructor", adminAtSecondSchool)).headers.get("location"), "/sign-in");
  } finally {
    if (db.isOpen) db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("TR, TE, and TI change simulated fluid contrast at the same slice geometry", () => {
  const plan = { ...defaultPlan, slices: 1, offset: 22 };
  const sample = (x, y) => {
    const spacing = plan.fov / plan.matrix;
    return Math.floor((y + plan.fov / 2) / spacing) * plan.matrix + Math.floor((x + plan.fov / 2) / spacing);
  };
  const fluid = sample(12, 6);
  const whiteMatter = sample(37, -18);
  const first = acquireMr(plan).pixels;
  const longTr = acquireMr({ ...plan, tr: presets.t2.tr }).pixels;
  const t2 = acquireMr({ ...plan, tr: presets.t2.tr, te: presets.t2.te }).pixels;
  const inversion = acquireMr({ ...plan, preset: "ir", tr: presets.ir.tr, te: presets.ir.te, ti: presets.ir.ti }).pixels;
  assert.ok(first[fluid] < first[whiteMatter]);
  assert.ok(longTr[fluid] > first[fluid]);
  assert.ok(t2[fluid] > t2[whiteMatter]);
  assert.ok(t2[whiteMatter] < longTr[whiteMatter]);
  assert.ok(inversion[fluid] < inversion[whiteMatter]);
});

test("MRI sampling controls change geometry, phase wrap, noise and estimated acquisition time", () => {
  const plan = { ...defaultPlan, slices: 1, offset: 22, fov: 260 };
  const phaseVertical = acquireMr({ ...plan, phaseMatrix: 64, phaseFov: 60 });
  const phaseHorizontal = acquireMr({ ...plan, phaseMatrix: 64, phaseFov: 60, phaseDirection: "horizontal" });
  assert.deepEqual([phaseVertical.geometry.columns, phaseVertical.geometry.rows], [128, 64]);
  assert.deepEqual([phaseHorizontal.geometry.columns, phaseHorizontal.geometry.rows], [64, 128]);
  assert.equal(phaseHorizontal.geometry.widthMm, 156);
  assert.equal(phaseHorizontal.parameters.frequencyDirection, "vertical");

  const wrapped = acquireMr({ ...plan, phaseFov: 50 });
  const oversampled = acquireMr({ ...plan, phaseFov: 50, oversampling: 100 });
  assert.equal(wrapped.pixels.length, oversampled.pixels.length);
  assert.ok(wrapped.pixels.filter((value, index) => value > oversampled.pixels[index] + 20).length > 250);
  assert.equal(oversampled.parameters.durationSeconds, 2 * wrapped.parameters.durationSeconds);

  const noisy = acquireMr({ ...plan, bandwidth: 800 });
  const lowerBandwidth = acquireMr({ ...plan, bandwidth: 80 });
  const averaged = acquireMr({ ...plan, bandwidth: 800, averages: 4 });
  const airNoise = scan => scan.pixels.slice(0, 128).reduce((sum, value) => sum + value ** 2, 0);
  assert.ok(airNoise(noisy) > airNoise(lowerBandwidth));
  assert.ok(airNoise(noisy) > airNoise(averaged));
  assert.equal(averaged.parameters.durationSeconds, 4 * noisy.parameters.durationSeconds);
});

test("GRE flip, spatial saturation, 3D partitions and fast spin echo operate under sequence-specific rules", () => {
  const plan = { ...defaultPlan, slices: 4, offset: 22 };
  const gre = { ...plan, ...presets.gre, preset: "gre", gap: 0 };
  const plain = acquireMr(gre);
  const flipped = acquireMr({ ...gre, flip: 70 });
  assert.notDeepEqual(plain.pixels, flipped.pixels);

  const saturated = acquireMr({ ...gre, satAxis: "u", satOffset: 20, satWidth: 20 });
  const sampleInBand = 64 * 128 + 75;
  assert.ok(plain.pixels[sampleInBand] > saturated.pixels[sampleInBand]);
  assert.equal(plain.pixels[64 * 128 + 45], saturated.pixels[64 * 128 + 45]);

  const threeD = acquireMr({ ...gre, acquisition: "3D" });
  assert.equal(threeD.parameters.acquisition, "3D");
  assert.equal(threeD.parameters.durationSeconds, gre.slices * plain.parameters.durationSeconds);
  assert.equal(threeD.geometry.centersMm.length, gre.slices);
  assert.equal(threeD.geometry.coverage, gre.slices * gre.thickness);
  const express = { ...plan, ...presets.tse, preset: "tse" };
  assert.ok(acquireMr(express).parameters.durationSeconds < acquireMr({ ...express, echoTrain: 2 }).parameters.durationSeconds);

  const fields = candidate => new URLSearchParams(Object.entries(candidate).filter(([, value]) => value !== null));
  assert.ok(readPlan(fields({ ...gre, acquisition: "3D" })));
  assert.equal(readPlan(fields({ ...gre, acquisition: "3D", gap: 1 })), null);
  assert.equal(readPlan(fields({ ...plan, acquisition: "3D", gap: 0 })), null);
  assert.equal(readPlan(fields({ ...gre, flip: null })), null);
  assert.equal(readPlan(fields({ ...plan, satAxis: "u", satWidth: -1 })), null);
  const legacyPlan = planFromAcquisition({ geometry: "{}", parameters: JSON.stringify({ preset: "t1", tr: 550, te: 12, ti: null }) });
  assert.equal(legacyPlan.bandwidth, defaultPlan.bandwidth);
  assert.equal(legacyPlan.phaseFov, 100);
});
