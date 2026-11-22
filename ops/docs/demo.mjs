// Disposable documentation fixtures. Refuse existing databases to protect tester data.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createOrderRequest, createUser, openDatabase, reviewOrderRequest, saveScreening, accessibleOrder } from "../../src/db.js";
import { localAppointment } from "../../src/scheduling.js";
const filename = process.argv[2];
if (!filename || existsSync(resolve(filename))) throw new Error("Supply a new, disposable SQLite filename. Existing files are never reused.");
const db = openDatabase(resolve(filename));
try {
  const accounts = [["demo-student", "student"], ["demo-instructor", "instructor"], ["demo-admin", "admin"], ["demo-classmate", "student"]];
  for (const [name, role] of accounts) createUser(db, name, role, "demo-docs-only");
  const student = { ...db.prepare("SELECT id FROM users WHERE username = 'demo-student'").get(), institutionId: 1, role: "student" };
  const classmate = { ...db.prepare("SELECT id FROM users WHERE username = 'demo-classmate'").get(), institutionId: 1, role: "student" };
  const details = { firstName: "Avery", lastName: "Morgan", patientName: "Avery Morgan", patientId: "SIM-1042", dob: "1990-03-04", sex: "Female", examKey: "mr-brain-v1", indication: "Persistent headaches — fictional training case", history: "Fictional patient reports no implanted devices or metal injury and can tolerate the scan." };
  createOrderRequest(db, student, details, "docs-review", "manual");
  createOrderRequest(db, student, { ...details, firstName: "Casey", lastName: "Rivera", patientName: "Casey Rivera", patientId: "", indication: "" }, "docs-incomplete", "manual");
  const today = localAppointment().date;
  const tomorrow = new Date(new Date(today + "T12:00:00Z").valueOf() + 86400000).toISOString().slice(0, 10);
  function scheduled(owner, name, date, time, held = false) {
    const [firstName, lastName] = name.split(" ");
    const data = { ...details, history: held ? "Fictional patient reports a prior implanted device and cannot confirm its identity." : details.history, firstName, lastName, patientName: name, patientId: `SIM-${time.replace(":", "")}` };
    const id = createOrderRequest(db, owner, data, `docs-${name}`, "manual");
    const { accession } = reviewOrderRequest(db, owner, id, 0, data, { demographics: true, exam: true, indication: true }, [], "schedule", { date, time });
    if (held) saveScreening(db, accessibleOrder(db, owner, accession), { status: "held", answers: { implant: "unsure", metal: "no", tolerance: "no" } });
  }
  scheduled(student, "Jordan Park", tomorrow, "10:30");
  scheduled(student, "Sam Reed", today, "09:00", true);
  scheduled(classmate, "Taylor Quinn", today, "11:00");
  console.log(`Created disposable documentation database: ${resolve(filename)}`);
  console.log(`Appointments use America/New_York: today ${today}; future ${tomorrow}.`);
} finally { db.close(); }
