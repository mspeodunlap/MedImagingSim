import { readFileSync } from "node:fs";

// Explicitly publish our user-facing guides only, never source manuals or arbitrary files.
export const trainingDocuments = new Map(["USER_GUIDE", "STUDENT", "INSTRUCTOR", "ADMIN"].map(name => [
  `/training/${name}.html`, readFileSync(new URL(`../docs/print/${name}.html`, import.meta.url)),
]));

const topics = {
  "Sign in": ["Sign-in guide", "open-the-simulator-and-sign-in"],
  "Order queue": ["Order queue guide", "review-and-schedule-an-incoming-order"],
  "Order review": ["Order review guide", "review-and-schedule-an-incoming-order"],
  "RIS worklist": ["RIS worklist guide", "find-and-screen-an-exam-in-ris"],
  "Completed/Recent": ["Exam lifecycle guide", "end-complete-review-and-correct-an-exam"],
  "MRI console": ["MRI console guide", "plan-and-run-an-mri-scan"],
  "MRI protocols": ["MRI protocol guide", "create-load-and-save-mri-protocols"],
  "Instructor home": ["Instructor guide", "instructor-instructions"],
  screening: ["Screening guide", "find-and-screen-an-exam-in-ris"],
  lifecycle: ["Exam lifecycle guide", "end-complete-review-and-correct-an-exam"],
};
const link = (path, label) => `<a href="${path}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
export function trainingHelp(user, topic) {
  const [label, anchor] = topics[topic] ?? ["User guide", "choose-your-instructions"];
  const roles = user ? [user.role] : ["student", "instructor", "admin"];
  return `<aside class="workflow-help" aria-label="Training help"><strong>Training help</strong>
    ${link(`/training/USER_GUIDE.html#${anchor}`, label)}
    ${roles.map(role => link(`/training/${role.toUpperCase()}.html`, `${role[0].toUpperCase() + role.slice(1)} quick tips`)).join(" ")}
    <small>Opens in a new tab or window</small></aside>`;
}
