import { randomInt } from "node:crypto";
import { exams } from "./exams.js";

export const intakeFields = {
  firstName: ["First name", 100],
  lastName: ["Last name", 100],
  patientId: ["Patient ID / MRN", 40],
  dob: ["Date of birth", 10],
  sex: ["Recorded sex", 20],
  examKey: ["Requested exam", 80],
  indication: ["Reason for exam", 1000],
  history: ["Clinical history", 2000],
};
export const reviewGroups = {
  demographics: "Patient demographics are complete",
  exam: "Requested exam is specified",
  indication: "Reason for exam is documented",
};
export const sexOptions = ["Female", "Male", "Other", "Unknown"];

export function readIntake(form) {
  const values = {};
  for (const [key, [, limit]] of Object.entries(intakeFields)) {
    if (form.getAll(key).length !== 1) return null;
    values[key] = form.get(key).trim();
    if (values[key].length > limit) return null;
  }
  for (const key of ["firstName", "lastName"]) values[key] = values[key].replace(/\s+/g, " ");
  values.patientName = [values.firstName, values.lastName].filter(Boolean).join(" ");
  if (values.examKey && !Object.hasOwn(exams, values.examKey)) return null;
  if (values.sex && !sexOptions.includes(values.sex)) return null;
  if (values.dob && !validDob(values.dob)) return null;
  return values;
}

function validDob(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10);
}

export function ageAtToday(dob) {
  const today = new Date().toISOString().slice(0, 10);
  return Number(today.slice(0, 4)) - Number(dob.slice(0, 4)) - Number(today.slice(5) < dob.slice(5));
}

export function missingIntake(values) {
  return Object.keys(intakeFields).filter(key => key !== "history" &&
    (!values[key] || (key === "dob" && !validDob(values.dob)) ||
      (key === "examKey" && !Object.hasOwn(exams, values.examKey)) ||
      (key === "sex" && !sexOptions.includes(values.sex))));
}

export function quickOrder(randomInteger = randomInt) {
  const first = ["Morgan", "Riley", "Jordan", "Taylor", "Casey", "Alex"];
  const last = ["Ellis", "Patel", "Chen", "Rivera", "Reed", "Brooks"];
  const reasons = ["Persistent headaches", "New onset dizziness", "Follow-up for visual changes", "Memory changes"];
  const details = {
    firstName: first[randomInteger(first.length)],
    lastName: last[randomInteger(last.length)],
    patientId: "SIM-" + randomInteger(100000, 1000000),
    dob: `${randomInteger(1945, 2009)}-${String(randomInteger(1, 13)).padStart(2, "0")}-${String(randomInteger(1, 29)).padStart(2, "0")}`,
    sex: sexOptions[randomInteger(sexOptions.length)],
    examKey: "mr-brain-v1",
    indication: reasons[randomInteger(reasons.length)],
    history: "Fictional patient reports no known implanted devices or metal injuries. Review screening before scanning.",
  };
  if (randomInteger(100) < 20) {
    const candidates = Object.keys(intakeFields).filter(key => key !== "history");
    for (let count = randomInteger(1, 4); count > 0; count--) {
      const [key] = candidates.splice(randomInteger(candidates.length), 1);
      details[key] = "";
    }
  }
  details.patientName = [details.firstName, details.lastName].filter(Boolean).join(" ");
  return details;
}
