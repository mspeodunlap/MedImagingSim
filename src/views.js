import { applicationVersion } from "./version.js";
import { trainingHelp } from "./training.js";
import { defaultTimeZone, futureOrder, localAppointment } from "./scheduling.js";
import { screeningAnswers } from "./exams.js";
import { canUseWorkspace } from "./roles.js";
import { canOperate, ended, workflowLabels } from "./lifecycle.js";

export const escape = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const version = applicationVersion;

const status = order => `<span class="status ${order.status === "held" ? "held" : order.workflow_status}">${workflowLabels[order.workflow_status]}</span>${order.status === "held" ? ' <span class="status held">Screening hold</span>' : ""}`;
const title = (label, detail) => `<div class="page-title"><h1>${label}</h1><p>${detail}</p></div>`;

export function page(name, content, user, { script, helpTopic = name } = {}) {
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
      <a href="/queue">Order queue</a><a href="/ris">RIS worklist</a><a href="/ris/recent">Completed/Recent</a>
      ${canUseWorkspace(user, "instructor") ? '<a href="/instructor">Instructor home</a>' : ""}</nav>` : ""}
    ${user ? `<div class="account"><span>${escape(user.username)} <small>${user.role}</small></span>
      <form method="post" action="/sign-out"><button class="secondary">Sign out</button></form></div>` : ""}
  </div>
</header>
<main class="${user ? "workspace" : "guest"}">${user ? trainingHelp(user, helpTopic) : ""}${content}${!user && name === "Sign in" ? trainingHelp(user, helpTopic) : ""}</main>
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
  return page("Instructor home", `${title("Instructor home", "Review ended studies and return cases for correction.")}
    <section class="panel"><h2>Study review</h2><p>An instructor opening an ended or completed study locks it against corrections. Only an instructor can Send back for correction to allow further work.</p><a class="action" href="/ris/recent">Completed/Recent</a><p class="muted">Assignment dispatch and grading are planned.</p></section>`, user);
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

export function worklist(user, orders, { date, timeZone = defaultTimeZone, recent = false } = {}) {
  const today = localAppointment(new Date(), timeZone).date;
  date ??= today;
  const showOwner = user.role !== "student";
  const rows = orders.map(order => {
    const patient = `<a href="/ris/orders/${order.accession}">${escape(order.patient_name)}</a>`;
    return `<tr>
    <td>${patient}</td>
    <td>${escape(order.patient_mrn || "Not supplied")}</td>
    ${showOwner ? `<td>${escape(order.owner)}</td>` : ""}
    <td>${escape(order.exam_name)}</td>
    <td class="accession">${order.accession}</td>
    <td>${escape(order.appointment_date)} ${escape(order.appointment_time)}</td>
    <td>${status(order)}${order.locked_by ? '<p>Locked for instructor review</p>' : ""}</td>
    <td>${order.appointment_date > today ? "Future date — cannot start" : ""}
      ${recent ? (!order.locked_by ? workflowForm(order, "reopen", "Reopen for correction") : "") : user.role !== "instructor" ? rescheduleForm(order, today) : ""}</td>
  </tr>`;
  }).join("");
  const name = recent ? "Completed/Recent" : "RIS worklist";
  const base = recent ? "/ris/recent" : "/ris";
  return page(name, `${title(name, recent ? "Ended and completed studies. Instructor opening locks a study; use Reopen for correction before review." : "Scheduled exams awaiting screening, acquisition, or exam end. Unscheduled orders remain in Order queue.")}
    <section class="panel"><form method="get" action="${base}" class="intake-actions" data-ris-date-filter>
      <label>Appointment date<input type="date" name="date" value="${escape(date)}" min="1900-01-01" required></label>
      <a class="action" href="${base}">Today</a>
    </form><noscript><p>Enable JavaScript to update appointments automatically when choosing a date.</p></noscript><p>Appointments for ${escape(date)} · ${escape(timeZone)}. Future-dated exams cannot be started.</p></section>
    <div class="worklist-layout">
      <section class="panel"><h2>Orders <span class="count">${orders.length}</span></h2>
        ${orders.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Imaging orders"><table>
          <thead><tr><th scope="col">Patient</th><th scope="col">MRN</th>${showOwner ? '<th scope="col">Owner</th>' : ""}<th scope="col">Exam</th><th scope="col">Accession</th><th scope="col">Appointment</th><th scope="col">Status</th><th scope="col">${recent ? "Corrections" : "Scheduling"}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : `<p class="muted">${recent ? "No ended or completed exams for this appointment date." : "No active exams are scheduled for this date. Check another appointment date or schedule an order from the order queue."}</p>`}
      </section>
      <aside class="panel"><h2>Incoming orders</h2><p>Review and schedule new orders from the order queue.</p><a class="action" href="/queue">Open order queue</a></aside>
    </div>`, user, { script: "/ris-worklist.js" });
}

export function workflowForm(order, action, label, content = "") {
  return `<form method="post" action="/ris/orders/${order.accession}/${action}" class="stack">
    <input type="hidden" name="workflowRevision" value="${order.workflow_revision}">
    ${content}<button>${label}</button></form>`;
}

function workflowPanel(user, order, acquisitions, selection, events) {
  const closed = ended(order);
  const editable = canOperate(user, order);
  const base = `/console/mr/${order.accession}`;
  const eventLabels = { screening: "Screening submitted", screening_hold: "Screening hold", begin: "Begin exam",
    end: "End exam", complete: "Mark completed", reopen: "Reopen for correction", review: "Opened for instructor review", return: "Send back for correction" };
  return `<section class="panel"><h2>Exam workflow</h2>
    <p>Ordered → Scheduled → Screened → Exam Begin → Exam End → Completed</p>
    <p>Current stage: <strong>${workflowLabels[order.workflow_status]}</strong></p>
    ${order.locked_by ? '<p class="notice hold">Locked for instructor review. Corrections require an instructor to send the case back.</p>' : ""}
    ${order.workflow_status === "screened" && editable && !futureOrder(order) ? workflowForm(order, "begin", "Begin exam") : ""}
    ${order.workflow_status === "exam_begin" && editable ? `<a class="action" href="${base}">Open MRI console</a>
      <p>Saved acquisitions: ${acquisitions.length}. At least one is required before ending.</p>
      ${workflowForm(order, "end", "End exam", `<label><input type="checkbox" name="performedVerified" value="yes" required>Performed exam matches the ordered exam: ${escape(order.exam_name)}</label>
      <label>Technologist notes (optional)<textarea name="notes" maxlength="4000" rows="4">${escape(order.notes)}</textarea></label>`)}` : ""}
    ${closed ? `<p>Performed exam confirmed: ${order.performed_verified ? "Yes" : "Pending correction"}. Saved acquisitions: ${acquisitions.length}.</p>
      <p>Technologist notes: ${escape(order.notes || "None recorded")}</p><a class="action" href="${base}">Review images</a>
      <p>PACS selection: ${selection ? `Series ${selection.id}` : "Not selected"}. RIS completion does not send images to PACS or confirm delivery.</p>
      ${order.workflow_status === "exam_end" && !order.locked_by ? workflowForm(order, "complete", "Mark completed") : ""}
      ${!order.locked_by ? workflowForm(order, "reopen", "Reopen for correction") : user.role === "instructor" ? workflowForm(order, "return", "Send back for correction",
        '<label>Correction reason<textarea name="reason" maxlength="4000" rows="3" required></textarea></label>') : ""}` : ""}
    <dl><dt>Exam begin (UTC)</dt><dd>${escape(order.begun_at || "Not recorded")}</dd>
    <dt>Exam end (UTC)</dt><dd>${escape(order.ended_at || "Not recorded")}</dd>
    <dt>Completed (UTC)</dt><dd>${escape(order.completed_at || "Not recorded")}</dd></dl>
    <p>Correction cycles: ${order.correction_cycle}. Earlier timestamps remain in history; after reopening, displayed end/completion times refer to the previous cycle until recorded again.</p>
    <details><summary>Workflow history</summary>${events.length ? `<ul>${events.map(event => {
      const details = JSON.parse(event.details);
      return `<li>${escape(eventLabels[event.action] || event.action)} · ${escape(event.username || "System")} · ${escape(event.created_at)} UTC · ${escape(workflowLabels[event.to_state])}${details.reason ? `<p>${escape(details.reason)}</p>` : ""}${details.notes ? `<p>${escape(details.notes)}</p>` : ""}</li>`;
    }).join("")}</ul>` : "<p>No workflow actions recorded. Older studies retain their saved data.</p>"}</details>
  </section>`;
}

export function orderPage(user, order, exam, message = "", appointments = [], events = [], acquisitions = [], selection) {
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
    <a class="back" href="${ended(order) ? "/ris/recent" : "/ris"}?date=${escape(order.appointment_date)}">← Back to ${ended(order) ? "Completed/Recent" : "worklist"}</a>
    <div class="order-heading">
      ${title(escape(order.exam_name), `<span class="accession">${order.accession}</span>`)}
      ${status(order)}
    </div>
    ${message ? `<p class="notice error" role="alert">${escape(message)}</p>` : ""}
    ${workflowPanel(user, order, acquisitions, selection, events)}
    <section class="panel"><h2>Appointment</h2><p>${escape(order.appointment_date)} ${escape(order.appointment_time)} · ${escape(order.time_zone)}</p>
      ${user.role !== "instructor" ? rescheduleForm(order, today) : ""}
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
        ${future ? `<p class="notice hold">This exam is scheduled for a future date and cannot be started. Confirm the intended appointment and use Reschedule appointment to correct it to today if needed.</p>` : order.status === "ordered"
          ? user.role !== "instructor" ? `<form method="post" action="/ris/orders/${order.accession}/screening">${questions}<button>Submit screening</button></form>` : '<p>Screening has not been submitted.</p>'
          : `${questions}${order.status === "held"
              ? '<p class="notice hold">Screening requires further review. This exam is on hold.</p>'
              : '<p class="notice cleared">Screening complete. Use Exam workflow for the next step.</p>'}`}
      </section>
    </div>`, user, { helpTopic: order.workflow_status === "scheduled" ? "screening" : "lifecycle" });
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
