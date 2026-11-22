import { readFileSync } from "node:fs";
import { defaultTimeZone, futureOrder, localAppointment } from "./scheduling.js";
import { screeningAnswers, statusLabels } from "./exams.js";
import { canUseWorkspace } from "./roles.js";

export const escape = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version.split(".").slice(0, 2).join(".");

const status = value => `<span class="status ${value}">${statusLabels[value]}</span>`;
const title = (label, detail) => `<div class="page-title"><h1>${label}</h1><p>${detail}</p></div>`;

export function page(name, content, user, { script } = {}) {
  const home = "/queue";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(name)} · MedImagingSim</title>
<link rel="stylesheet" href="/styles.css">
${script ? `<script type="module" src="${escape(script)}"></script>` : ""}
</head>
<body>
<header class="shell-header">
  <div class="shell-inner">
    <a class="wordmark" href="${home}"><span class="brand-mark" aria-hidden="true"></span>MedImagingSim</a>
    ${user ? `<nav class="workspace-nav" aria-label="Workspaces">
      <a href="/queue">Order queue</a><a href="/ris">RIS worklist</a>
      ${canUseWorkspace(user, "instructor") ? '<a href="/instructor">Instructor home</a>' : ""}</nav>` : ""}
    ${user ? `<div class="account"><span>${escape(user.username)} <small>${user.role}</small></span>
      <form method="post" action="/sign-out"><button class="secondary">Sign out</button></form></div>` : ""}
  </div>
</header>
<main class="${user ? "workspace" : "guest"}">${content}</main>
</body>
</html>`;
}

export function signIn(message = "") {
  return page("Sign in", `<section class="panel login">
    ${title("Sign in", "Use your simulator account to open your workspace.")}
    ${message ? `<p class="notice error" role="alert">${escape(message)}</p>` : ""}
    <form method="post" action="/sign-in" class="stack">
      <label>Username<input name="username" autocomplete="username" maxlength="40" required autofocus></label>
      <label>Password<input type="password" name="password" autocomplete="current-password" maxlength="256" required></label>
      <button>Sign in</button>
    </form>
  </section><p class="login-version">V ${escape(version)}</p>`);
}

export function instructor(user) {
  return page("Instructor home", `${title("Instructor home", "Assignments and submission review will appear here when grading is available.")}
    <section class="panel"><h2>Submissions</h2><p class="muted">No submissions to review.</p></section>`, user);
}

function rescheduleForm(order, today) {
  if (order.status !== "ordered" || order.answers !== null) return "";
  return `<details><summary>Reschedule appointment</summary>
    <p>The date defaults to today. Confirm the intended date and time before saving.</p>
    <form method="post" action="/ris/orders/${order.accession}/reschedule" class="stack">
      <input type="hidden" name="scheduleRevision" value="${order.schedule_revision}">
      <label>Appointment date<input type="date" name="appointmentDate" min="1900-01-01" value="${today}" required></label>
      <label>Appointment time<input type="time" name="appointmentTime" value="${escape(order.appointment_time)}" required></label>
      <button>Save appointment</button>
    </form></details>`;
}

export function worklist(user, orders, { date, timeZone = defaultTimeZone } = {}) {
  const today = localAppointment(new Date(), timeZone).date;
  date ??= today;
  const showOwner = user.role !== "student";
  const rows = orders.map(order => {
    let patient = `<a href="/ris/orders/${order.accession}">${escape(order.patient_name)}</a>`;
    if (user.role === "instructor") {
      patient = order.intake_id ? `<a href="/queue/${order.intake_id}">${escape(order.patient_name)}</a>` : escape(order.patient_name);
    }
    return `<tr>
    <td>${patient}</td>
    ${showOwner ? `<td>${escape(order.owner)}</td>` : ""}
    <td>${escape(order.exam_name)}</td>
    <td class="accession">${order.accession}</td>
    <td>${escape(order.appointment_date)} ${escape(order.appointment_time)}</td>
    <td>${status(order.status)}</td>
    <td>${order.appointment_date > today ? "Future date — cannot start" : ""}
      ${user.role !== "instructor" ? rescheduleForm(order, today) : ""}</td>
  </tr>`;
  }).join("");
  return page("RIS worklist", `${title("RIS worklist", "Open an imaging order to review the patient history and record screening.")}
    <section class="panel"><form method="get" action="/ris" class="intake-actions">
      <label>Appointment date<input type="date" name="date" value="${escape(date)}" min="1900-01-01" required></label>
      <button>Show appointments</button><a class="action" href="/ris">Today</a>
    </form><p>Appointments for ${escape(date)} · ${escape(timeZone)}. Future-dated exams cannot be started.</p></section>
    <div class="worklist-layout">
      <section class="panel"><h2>Orders <span class="count">${orders.length}</span></h2>
        ${orders.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Imaging orders"><table>
          <thead><tr><th scope="col">Patient</th>${showOwner ? '<th scope="col">Owner</th>' : ""}<th scope="col">Exam</th><th scope="col">Accession</th><th scope="col">Appointment</th><th scope="col">Status</th><th scope="col">Scheduling</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : '<p class="muted">No exams are scheduled for this date. Check another appointment date or schedule an order from the order queue.</p>'}
      </section>
      <aside class="panel"><h2>Incoming orders</h2><p>Review and schedule new orders from the order queue.</p><a class="action" href="/queue">Open order queue</a></aside>
    </div>`, user);
}

export function orderPage(user, order, exam, message = "", appointments = []) {
  const future = futureOrder(order);
  const today = localAppointment(new Date(), order.time_zone).date;
  const demographics = order.intake_details && JSON.parse(order.intake_details);
  const savedAnswers = order.answers ? JSON.parse(order.answers) : null;
  const questions = exam.questions.map(({ id, label }) => `
    <fieldset>
      <legend>${escape(label)}</legend>
      ${savedAnswers ? `<p class="saved-answer">${escape(screeningAnswers.find(([value]) => value === savedAnswers[id])?.[1] ?? "—")}</p>`
      : `<div class="choices">${screeningAnswers.map(([value, text]) => `
          <label><input type="radio" name="${id}" value="${value}" required>${text}</label>`).join("")}</div>`}
    </fieldset>`).join("");
  return page(order.exam_name, `
    <a class="back" href="/ris">← Back to worklist</a>
    <div class="order-heading">
      ${title(escape(order.exam_name), `<span class="accession">${order.accession}</span>`)}
      ${status(order.status)}
    </div>
    <section class="panel"><h2>Appointment</h2><p>${escape(order.appointment_date)} ${escape(order.appointment_time)} · ${escape(order.time_zone)}</p>
      ${rescheduleForm(order, today)}
      ${appointments.length ? `<details><summary>Appointment history</summary><ul>${appointments.map(change =>
        `<li>${escape(change.username)} · ${escape(change.created_at)} UTC · ${change.previous_date ? `${escape(change.previous_date)} ${escape(change.previous_time)} → ` : "Scheduled: "}${escape(change.appointment_date)} ${escape(change.appointment_time)} (${escape(change.time_zone)})</li>`).join("")}</ul></details>` : ""}
    </section>
    <div class="order-layout">
      <section class="panel"><h2>Patient history</h2>
        <dl><dt>Fictional patient</dt><dd>${escape(order.patient_name)} · ${order.patient_age} years</dd>
        ${demographics ? `<dt>Patient ID / MRN</dt><dd>${escape(demographics.patientId)}</dd>
        <dt>Date of birth</dt><dd>${escape(demographics.dob)}</dd><dt>Recorded sex</dt><dd>${escape(demographics.sex)}</dd>
        <dt>Order review</dt><dd><a href="/queue/${order.intake_id}">View completeness review</a></dd>` : ""}
        <dt>Indication</dt><dd>${escape(order.indication)}</dd>
        <dt>Clinical history</dt><dd>${escape(order.history)}</dd></dl>
      </section>
      <section class="panel"><h2>Safety screening</h2>
        ${message ? `<p class="notice error" role="alert">${escape(message)}</p>` : ""}
        ${future ? `<p class="notice hold">This exam is scheduled for a future date and cannot be started. Confirm the intended appointment and use Reschedule appointment to correct it to today if needed.</p>` : order.status === "ordered"
          ? `<form method="post" action="/ris/orders/${order.accession}/screening">${questions}<button>Submit screening</button></form>`
          : `${questions}${order.status === "held"
              ? '<p class="notice hold">Screening requires further review. This exam is on hold.</p>'
              : `<p class="notice cleared">Screening complete. This order is ready for the console.</p>
                 <a class="action" href="${escape(exam.consolePath)}/${order.accession}">Open ${escape(exam.consoleLabel)}</a>`}`}
      </section>
    </div>`, user);
}

export function problem(code, user) {
  const messages = {
    400: ["Invalid request", "Return to your workspace and try again."],
    403: ["Access denied", "Your account or session cannot perform this action."],
    404: ["Page unavailable", "The requested page or order could not be found."],
    409: ["Screening already saved", "Reopen the order from your worklist to see its current status."],
    413: ["Request too large", "Return to your workspace and try again."],
    429: ["Too many sign-in attempts", "Try signing in again shortly."],
    500: ["Something went wrong", "Return to your workspace and try again."],
  };
  const [name, detail] = messages[code];
  return page(name, `${title(name, detail)}<a href="/">Return to workspace</a>`, user);
}
