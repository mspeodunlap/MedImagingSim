import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRequestHandler } from "../src/app.js";
import { accessibleOrder, createUser, launchOrder, openDatabase, saveScreening, startSession } from "../src/db.js";
import { defaultPlan } from "../src/mr.js";
import { exams, scenarios } from "../src/exams.js";
import { transitionExam } from "../src/lifecycle.js";
import { examProtocol, validateProtocol } from "../src/protocols.js";
import { requestThrough } from "../test-support/request.js";
import { dictionary, dictionaryVersion, teachingStarter, teachingStarters } from "../src/mri-dictionary.js";

const document = { sequences: [
  { name: "Axial T1", plan: { ...defaultPlan } },
  { name: "Coronal T2", plan: { ...defaultPlan, plane: "coronal", preset: "t2", tr: 3500, te: 95, matrix: 96, phaseMatrix: 64, phaseDirection: "horizontal", phaseFov: 90, oversampling: 20, averages: 2, bandwidth: 300 } },
  { name: "Sagittal GRE", plan: { ...defaultPlan, plane: "sagittal", preset: "gre", tr: 35, te: 8, flip: 25, acquisition: "3D", gap: 0, satAxis: "v", satOffset: 10, satWidth: 30 } },
] };
function fields(value = document, name = "Brain teaching protocol", source = "", kind = "default") {
  const out = { name, sourceVersion: String(source), sequenceCount: value.sequences.length, kind };
  value.sequences.forEach((s, index) => {
    out[`${index}.name`] = s.name;
    for (const [key, v] of Object.entries(s.plan)) if (v !== null) out[`${index}.${key}`] = v;
  });
  return out;
}
const versionId = response => Number(new URL(response.headers.get("Location"), "http://localhost").searchParams.get("version"));
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "medsim-protocols-")), path = join(dir, "test.sqlite");
  let db = openDatabase(path), handler = createRequestHandler(db);
  function account(name, role, institutionId = 1) {
    createUser(db, name, role, "protocol-test-only", institutionId);
    const id = db.prepare("SELECT id FROM users WHERE username = ?").get(name).id;
    return { id, role, institutionId, cookie: `medsim_session=${startSession(db, id, institutionId)}` };
  }
  const instructor = account("instructor", "instructor"), admin = account("admin", "admin"), student = account("student", "student"), peer = account("peer", "student");
  db.exec("INSERT INTO institutions(slug,name) VALUES ('other', 'Other')");
  const foreign = account("foreign", "instructor", 2);
  const request = (path, user = student, data) => requestThrough(handler, path, { cookie: user.cookie, fields: data });
  const launch = (user = student, begin = true) => {
    const accession = launchOrder(db, user, scenarios["routine-brain"], exams["mr-brain-v1"], randomBytes(16).toString("hex"));
    if (begin) {
      saveScreening(db, accessibleOrder(db, user, accession), { status: "ready", answers: { implant: "no", metal: "no", tolerance: "no" } });
      assert.ok(transitionExam(db, user, accession, 1, "begin"));
    }
    return accession;
  };
  return { get db() { return db; }, instructor, admin, student, peer, foreign, request, launch,
    restart() { db.close(); db = openDatabase(path); handler = createRequestHandler(db); },
    close() { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test("staff publish immutable institution protocol revisions; students cannot overwrite them or see others' private versions", async () => {
  const f = setup();
  try {
    assert.equal((await f.request("/protocols/mr", f.instructor)).status, 200);
    const saved = await f.request("/protocols/mr/save", f.instructor, fields());
    assert.equal(saved.status, 303); const first = versionId(saved);
    const original = f.db.prepare("SELECT * FROM mri_protocol_versions WHERE id = ?").get(first);
    assert.deepEqual(JSON.parse(original.payload), document);
    const studentPage = await (await f.request(`/protocols/mr?version=${first}`)).text();
    assert.match(studentPage, /Coronal T2/);
    assert.match(studentPage, /name="2.acquisition"/);
    assert.doesNotMatch(studentPage, /<button name="kind" value="default">/);
    assert.equal((await f.request("/protocols/mr/save", f.student, fields(document, "Brain teaching protocol", first))).status, 403);
    const personal = await f.request("/protocols/mr/save", f.student, fields(document, "Brain teaching protocol", first, "personal"));
    assert.equal(personal.status, 303); const personalId = versionId(personal);
    assert.equal((await f.request(`/protocols/mr?version=${personalId}`, f.peer)).status, 404);
    assert.equal((await f.request(`/protocols/mr?version=${personalId}`, f.instructor)).status, 404);
    assert.equal((await f.request(`/protocols/mr?version=${first}`, f.foreign)).status, 404);
    assert.equal((await f.request("/protocols/mr/save", f.foreign, fields(document, "Stolen", first))).status, 404);
    const revised = structuredClone(document); revised.sequences[0].plan.tr = 700;
    const race = await Promise.all([
      f.request("/protocols/mr/save", f.instructor, fields(revised, "Brain teaching protocol", first)),
      f.request("/protocols/mr/save", f.admin, fields(revised, "Brain teaching protocol", first)),
    ]);
    assert.deepEqual(race.map(r => r.status).sort(), [303, 409]);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM mri_protocol_versions WHERE protocol_id = ?").get(original.protocol_id).n, 2);
    assert.deepEqual(f.db.prepare("SELECT * FROM mri_protocol_versions WHERE id = ?").get(first), original);
    assert.throws(() => f.db.prepare("UPDATE mri_protocol_versions SET payload = '{}' WHERE id = ?").run(first), /immutable/);
    assert.throws(() => f.db.prepare("DELETE FROM mri_protocol_versions WHERE id = ?").run(first), /immutable/);
    const malicious = fields(revised, "Bad", first); malicious["1.te"] = 5000;
    assert.equal((await f.request("/protocols/mr/save", f.admin, malicious)).status, 400);
    f.db.prepare("UPDATE institution_memberships SET role = 'student' WHERE user_id = ?").run(f.instructor.id);
    assert.equal((await f.request("/protocols/mr/save", f.instructor, fields(document, "No longer authorized"))).status, 403);
    f.restart();
    assert.deepEqual(f.db.prepare("SELECT * FROM mri_protocol_versions WHERE id = ?").get(first), original);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("a case loads a multi-sequence copy and saves personal versions while defaults and other student copies stay unchanged", async () => {
  const f = setup();
  try {
    const saved = await f.request("/protocols/mr/save", f.admin, fields()); const first = versionId(saved);
    const original = f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id = ?").get(first).payload;
    const accession = f.launch(), peerCase = f.launch(f.peer), notBegun = f.launch(f.student, false);
    const base = `/console/mr/${accession}`, endpoint = base + "/protocol";
    const load = { protocolAction: "load", protocolRevision: 0, protocolVersion: first };
    assert.equal((await f.request(`/console/mr/${notBegun}/protocol`, f.student, load)).status, 404);
    assert.equal((await f.request(endpoint, f.peer, load)).status, 404);
    assert.equal((await f.request(endpoint, f.student, load)).status, 303);
    assert.equal((await f.request(`/console/mr/${peerCase}/protocol`, f.peer, load)).status, 303);
    assert.equal((await f.request(endpoint, f.student, load)).status, 409);
    let copy = examProtocol(f.db, 1, accession);
    assert.deepEqual(JSON.parse(copy.payload), document);
    const changedT1 = { ...defaultPlan, tr: 650 };
    const formPlan = p => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null));
    assert.equal((await f.request(endpoint, f.student, { ...formPlan(changedT1), protocolRevision: 1, protocolAction: "select:1" })).status, 303);
    copy = examProtocol(f.db, 1, accession);
    assert.equal(copy.selected_sequence, 1);
    assert.equal(JSON.parse(copy.payload).sequences[0].plan.tr, 650);
    let consolePage = await (await f.request(base)).text();
    assert.match(consolePage, /name="tr"[\s\S]*?value="3500"/);
    const changedT2 = { ...document.sequences[1].plan, te: 110 };
    assert.equal((await f.request(endpoint, f.student, { ...formPlan(changedT2), protocolRevision: 2, protocolAction: "save", protocolName: "My brain protocol" })).status, 303);
    copy = examProtocol(f.db, 1, accession); const personalV1 = copy.source_version_id;
    const privatePayload = JSON.parse(f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id = ?").get(personalV1).payload);
    assert.equal(privatePayload.sequences.length, 3);
    assert.equal(privatePayload.sequences[0].plan.tr, 650);
    assert.equal(privatePayload.sequences[1].plan.te, 110);
    assert.deepEqual(privatePayload.sequences[2], document.sequences[2]);
    assert.equal((await f.request(endpoint, f.student, { ...formPlan({ ...changedT2, te: 115 }), protocolRevision: 3, protocolAction: "save", protocolName: "My brain protocol" })).status, 303);
    const personalV2 = examProtocol(f.db, 1, accession).source_version_id;
    assert.equal(f.db.prepare("SELECT version FROM mri_protocol_versions WHERE id = ?").get(personalV2).version, 2);
    assert.deepEqual(JSON.parse(f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id = ?").get(personalV1).payload), privatePayload);
    assert.equal(f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id = ?").get(first).payload, original);
    assert.equal(examProtocol(f.db, 1, peerCase).payload, original);
    assert.equal((await f.request(`/console/mr/${peerCase}/protocol`, f.peer, { ...load, protocolRevision: 1, protocolVersion: personalV1 })).status, 403);
    const newDefault = structuredClone(document); newDefault.sequences[0].plan.tr = 900;
    assert.equal((await f.request("/protocols/mr/save", f.instructor, fields(newDefault, "Brain teaching protocol", first))).status, 303);
    assert.equal(JSON.parse(examProtocol(f.db, 1, accession).payload).sequences[0].plan.tr, 650);
    f.restart();
    assert.equal(examProtocol(f.db, 1, accession).source_version_id, personalV2);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM acquisitions").get().n, 0, "library load/save never acquires images");
    consolePage = await (await f.request(base)).text();
    assert.match(consolePage, /My brain protocol/);
    assert.match(consolePage, /Sequence 2 of 3/);
    assert.equal((await f.request(`/protocols/mr?exam=${accession}`, f.peer)).status, 404);
    const scan = await f.request(base + "/scan", f.student, { ...formPlan({ ...changedT2, te: 120 }), scanKey: randomBytes(16).toString("hex") });
    assert.equal(scan.status, 303);
    assert.equal(JSON.parse(examProtocol(f.db, 1, accession).payload).sequences[1].plan.te, 120);
    assert.equal(JSON.parse(f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id = ?").get(personalV2).payload).sequences[1].plan.te, 115);
    assert.ok(transitionExam(f.db, f.student, accession, 2, "end", { performedVerified: true, notes: "Checked" }));
    assert.equal((await f.request(`/ris/orders/${accession}`, f.instructor)).status, 200);
    assert.equal((await f.request(endpoint, f.student, { ...load, protocolRevision: 5 })).status, 404);
  } finally { f.close(); }
});

test("the full editor adds, reorders and removes valid sequences, retains invalid edits, and validates every sequence", async () => {
  const f = setup();
  try {
    const edit = async action => f.request("/protocols/mr/edit", f.instructor, { ...fields(), editAction: action });
    const added = await edit("add"); assert.equal(added.status, 200);
    assert.match(await added.text(), /name="sequenceCount" value="4"/);
    const moved = await edit("up:1"); assert.equal(moved.status, 200);
    const html = await moved.text();
    assert.ok(html.indexOf('value="Coronal T2"') < html.indexOf('value="Axial T1"'));
    assert.equal((await edit("remove:0")).status, 200);
    assert.equal((await edit("down:2")).status, 400);
    const invalid = fields(); invalid["2.tr"] = "6"; invalid.editAction = "add";
    const rejected = await f.request("/protocols/mr/edit", f.instructor, invalid);
    assert.equal(rejected.status, 400);
    assert.match(await rejected.text(), /name="2.tr"[^>]*value="6"/);
    assert.equal(validateProtocol({ sequences: [] }), null);
    assert.equal(validateProtocol({ sequences: Array(33).fill(document.sequences[0]) }), null);
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM mri_protocol_versions").get().n, 0);
  } finally { f.close(); }
});

test("30 students save independent personal versions from one shared default concurrently", async () => {
  const f = setup();
  try {
    const first = versionId(await f.request("/protocols/mr/save", f.instructor, fields()));
    const before = f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id = ?").get(first).payload;
    const users = Array.from({ length: 30 }, (_, index) => {
      const username = `protocol-learner-${index}`;
      createUser(f.db, username, "student", "protocol-test-only");
      const id = f.db.prepare("SELECT id FROM users WHERE username = ?").get(username).id;
      const user = { id, institutionId: 1, role: "student", cookie: `medsim_session=${startSession(f.db, id)}` };
      return { user, accession: f.launch(user), tr: 550 + index };
    });
    await Promise.all(users.map(async ({ user, accession, tr }) => {
      const endpoint = `/console/mr/${accession}/protocol`;
      assert.equal((await f.request(endpoint, user, { protocolRevision: 0, protocolAction: "load", protocolVersion: first })).status, 303);
      assert.equal((await f.request(endpoint, user, { ...Object.fromEntries(Object.entries({ ...defaultPlan, tr }).filter(([,v]) => v !== null)),
        protocolRevision: 1, protocolAction: "save", protocolName: "My classroom version" })).status, 303);
    }));
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM mri_protocols WHERE kind = 'personal'").get().n, 30);
    for (const [index, { accession, tr }] of users.entries()) {
      const copy = examProtocol(f.db, 1, accession);
      assert.equal(JSON.parse(copy.payload).sequences[0].plan.tr, tr);
      const other = users[(index + 1) % users.length];
      assert.equal((await f.request(`/protocols/mr?version=${copy.source_version_id}`, other.user)).status, 404);
    }
    assert.equal(f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id = ?").get(first).payload, before);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("MRI dictionary cross-references are complete and only validated brain starters are runnable", () => {
  for (const list of [dictionary.categories, dictionary.regions, dictionary.families, dictionary.profiles, dictionary.examRecipes, dictionary.sources, teachingStarters]) {
    assert.equal(new Set(list.map(v => v.id)).size, list.length);
  }
  const has = (list, id) => list.some(v => v.id === id);
  for (const item of [...dictionary.families, ...dictionary.profiles, ...dictionary.examRecipes]) {
    assert.ok(item.sources.length);
    for (const id of item.sources) assert.ok(has(dictionary.sources, id), `${item.id}: missing ${id}`);
  }
  for (const recipe of dictionary.examRecipes) {
    assert.equal(recipe.status, "reference");
    assert.ok(!teachingStarter(recipe.id), "Clinical recipes must never be cast to runnable plans");
    assert.ok(has(dictionary.categories, recipe.category));
    assert.ok(dictionary.regions.some(r => r.category === recipe.category && r.name === recipe.region));
    for (const id of recipe.sequences) assert.ok(has(dictionary.families, id));
    for (const id of recipe.profiles) assert.ok(has(dictionary.profiles, id));
  }
  for (const p of dictionary.profiles) assert.ok(has(dictionary.families, p.family));
  for (const id of ["t2fs", "stir", "dwi", "adc", "tof", "t1-3d", "cine"]) assert.equal(dictionary.families.find(f => f.id === id).preset, null);
  for (const starter of teachingStarters) {
    assert.deepEqual(validateProtocol(starter).sequences, starter.sequences);
    const cloned = teachingStarter(starter.id);
    cloned.sequences[0].plan.tr++;
    assert.notEqual(cloned.sequences[0].plan.tr, starter.sequences[0].plan.tr);
  }
  assert.equal(validateProtocol({ ...document, origin: { id: "retired-teaching-starter", version: "2025-01-01.1" } }).origin.version, "2025-01-01.1");
});

test("dictionary routes expose sourced references and filters without changing institution data", async () => {
  const f = setup();
  try {
    const before = f.db.prepare("SELECT count(*) n FROM mri_protocol_versions").get().n;
    for (const user of [f.student, f.instructor, f.admin]) {
      for (const tab of ["exams", "anatomy", "sequences", "sources", "starters"]) {
        const response = await f.request(`/protocols/mr/dictionary?tab=${tab}`, user);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /MRI anatomy and protocol dictionary/);
        assert.equal(html.includes("<button>Install teaching starters"), tab === "starters" && user.role !== "student");
      }
    }
    const filtered = await (await f.request("/protocols/mr/dictionary?category=msk&strength=1.5T&q=knee")).text();
    assert.match(filtered, /Knee sagittal PD at 1.5T/);
    assert.ok(!filtered.includes("Knee sagittal PD at 3T"));
    assert.ok(!filtered.includes("Shoulder rotator cuff survey"));
    assert.match(await (await f.request("/protocols/mr/dictionary?q=xyz-nothing")).text(), /No matching exams/);
    const xss = await (await f.request("/protocols/mr/dictionary?q=%3Cscript%3E")).text();
    assert.ok(!xss.includes("<script>"));
    assert.match(xss, /&lt;script&gt;/);
    for (const suffix of ["?tab=bad", "?category=nope", "?strength=7T", "?tab=exams&tab=sources", `?q=${"x".repeat(201)}`]) assert.equal((await f.request(`/protocols/mr/dictionary${suffix}`)).status, 400);
    const json = await f.request("/protocols/mr/dictionary.json");
    assert.match(json.headers.get("Content-Type"), /application\/json/);
    assert.match(json.headers.get("Content-Disposition"), /attachment; filename="mri-dictionary-/);
    assert.equal(JSON.parse(await json.text()).version, dictionaryVersion);
    assert.equal((await f.request("/protocols/mr?starter=brain-stroke")).status, 404);
    assert.equal((await f.request("/protocols/mr?starter=brain-core&version=1")).status, 400);
    assert.equal(f.db.prepare("SELECT count(*) n FROM mri_protocol_versions").get().n, before);
  } finally { f.close(); }
});

test("staff install starter snapshots once per institution, preserving collisions and student ownership", async () => {
  const f = setup();
  try {
    // A local custom default with the same name must survive initial installation.
    const existing = versionId(await f.request("/protocols/mr/save", f.instructor, fields(document, teachingStarters[0].name)));
    assert.equal((await f.request("/protocols/mr/install-starters", f.student, {})).status, 403);
    const first = await f.request("/protocols/mr/install-starters", f.instructor, {});
    assert.equal(first.status, 303);
    assert.match(first.headers.get("Location"), /installed=6&skipped=1/);
    assert.equal(f.db.prepare("SELECT count(*) n FROM mri_protocol_versions").get().n, 7);
    assert.deepEqual(JSON.parse(f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id=?").get(existing).payload), document);
    assert.match((await f.request("/protocols/mr/install-starters", f.admin, {})).headers.get("Location"), /installed=0&skipped=7/);
    const theirs = await f.request("/protocols/mr/install-starters", f.foreign, {});
    assert.match(theirs.headers.get("Location"), /installed=7&skipped=0/);
    const otherId = f.db.prepare("SELECT v.id FROM mri_protocol_versions v JOIN mri_protocols p ON p.id=v.protocol_id WHERE p.institution_id=2 LIMIT 1").get().id;
    assert.equal((await f.request(`/protocols/mr?version=${otherId}`, f.student)).status, 404);
    const starter = teachingStarter("brain-weighting");
    const data = fields(starter, "My weighting lesson", "", "personal");
    data.catalogOrigin = starter.id; data.catalogVersion = dictionaryVersion;
    assert.equal((await f.request("/protocols/mr/save", f.student, { ...data, kind: "default" })).status, 403);
    const personal = versionId(await f.request("/protocols/mr/save", f.student, data));
    assert.equal(JSON.parse(f.db.prepare("SELECT payload FROM mri_protocol_versions WHERE id=?").get(personal).payload).origin.id, starter.id);
    assert.equal((await f.request(`/protocols/mr?version=${personal}`, f.peer)).status, 404);
    f.restart();
    assert.match((await f.request("/protocols/mr/install-starters", f.instructor, {})).headers.get("Location"), /installed=0&skipped=7/);
  } finally { f.close(); }
});

test("built-in starters load as independent case copies and cannot bypass reference or review-lock restrictions", async () => {
  const f = setup();
  try {
    const accession = f.launch(), endpoint = `/console/mr/${accession}/protocol`;
    assert.equal((await f.request(endpoint, f.student, { protocolRevision: 0, protocolAction: "load", protocolVersion: "starter:brain-stroke" })).status, 400);
    assert.equal((await f.request(endpoint, f.peer, { protocolRevision: 0, protocolAction: "load", protocolVersion: "starter:brain-core" })).status, 404);
    assert.equal((await f.request(endpoint, f.student, { protocolRevision: 0, protocolAction: "load", protocolVersion: "starter:brain-core" })).status, 303);
    const copy = examProtocol(f.db, 1, accession);
    assert.equal(copy.protocol_name, teachingStarter("brain-core").name);
    assert.equal(copy.source_version_id, null);
    assert.deepEqual(JSON.parse(copy.payload).sequences, teachingStarter("brain-core").sequences);
    const plan = teachingStarter("brain-core").sequences[0].plan;
    const form = { ...Object.fromEntries(Object.entries({ ...plan, tr: 650 }).filter(([,v]) => v !== null)), protocolRevision: 1, protocolAction: "save", protocolName: "My starter edits" };
    assert.equal((await f.request(endpoint, f.student, form)).status, 303);
    assert.equal(teachingStarter("brain-core").sequences[0].plan.tr, 550);
    assert.equal(JSON.parse(examProtocol(f.db, 1, accession).payload).sequences[0].plan.tr, 650);
    f.db.prepare("UPDATE exam_workflow SET locked_by=? WHERE accession=?").run(f.instructor.id, accession);
    assert.equal((await f.request(endpoint, f.student, { protocolRevision: 2, protocolAction: "load", protocolVersion: "starter:brain-fluid" })).status, 404);
    assert.equal(JSON.parse(examProtocol(f.db, 1, accession).payload).sequences[0].plan.tr, 650);
  } finally { f.close(); }
});
