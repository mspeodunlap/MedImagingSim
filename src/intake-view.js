import { defaultTimeZone } from "./scheduling.js";
import { exams, scenarios } from "./exams.js";
import { intakeFields, reviewGroups, sexOptions } from "./intake.js";
import { escape, page } from "./views.js";

function detailsForm(details = {}) {
  const legacy = details.patientName && details.firstName === undefined && details.lastName === undefined;
  return `${legacy ? `<p class="notice">Previously entered patient name: ${escape(details.patientName)}. Confirm the first and last names separately before scheduling.</p>` : ""}
    <p class="muted">Enter first and last names in their labeled fields. Names display as First Last, separated by one space.</p><div class="intake-fields">${Object.entries(intakeFields).map(([key, [label, max]]) => {
    const value = details[key] ?? "";
    let control;
    if (key === "examKey" || key === "sex") {
      const choices = key === "examKey" ? Object.entries(exams).map(([id, exam]) => [id, exam.examName])
        : sexOptions.map(sex => [sex, sex]);
      control = `<select name="${key}"><option value="">Not supplied</option>${choices.map(([id, text]) =>
        `<option value="${id}"${value === id ? " selected" : ""}>${escape(text)}</option>`).join("")}</select>`;
    } else if (key === "history" || key === "indication") {
      control = `<textarea name="${key}" maxlength="${max}" rows="3">${escape(value)}</textarea>`;
    } else {
      control = `<input name="${key}" type="${key === "dob" ? "date" : "text"}" maxlength="${max}" value="${escape(value)}"${key === "dob" ? ` min="1900-01-01" max="${new Date().toISOString().slice(0, 10)}"` : ""}>`;
    }
    return `<label>${label}${control}</label>`;
  }).join("")}</div>`;
}

export function orderQueue(user, requests, key, message = "", draft) {
  const privileged = user.role !== "student";
  const rows = requests.map(request => {
    const details = JSON.parse(request.details);
    return `<tr><td><a href="/queue/${request.id}">Order ${request.id}</a></td>
      <td>${escape(details.patientName || "Not supplied")}</td>
      <td>${escape(exams[details.examKey]?.examName ?? "Not supplied")}</td>
      ${privileged ? `<td>${escape(request.owner)}</td>` : ""}<td>${request.last_action === "needs_information" ? "Needs information" : "Awaiting review"}</td>
      <td>${escape(request.created_at)} UTC</td></tr>`;
  }).join("");
  return page("Order queue", `<div class="page-title"><h1>Order queue</h1>
    <p>Review incoming orders for completeness before scheduling them into the RIS worklist.</p></div>
    ${message ? `<p class="notice error" role="alert">${escape(message)}</p>` : ""}
    <div class="queue-layout"><section class="panel"><h2>Awaiting review <span class="count">${requests.length}</span></h2>
      ${rows ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Patient</th><th>Exam</th>
        ${privileged ? "<th>Created by</th>" : ""}<th>Status</th><th>Received</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="muted">No orders awaiting review.</p>'}
    </section>
    <aside class="panel"><h2>Create an order</h2>
      <form method="post" action="/queue/quick"><input type="hidden" name="requestKey" value="${key}">
        <button>Quick order</button></form>
      <p class="muted intake-help">Generates a fictional order for your review.</p>
      ${user.role !== "instructor" ? `<details><summary>Practice scenarios</summary>
        <form method="post" action="/ris/orders" class="stack">
          <input type="hidden" name="launchKey" value="${key}">
          <label>Scenario<select name="scenario">${Object.entries(scenarios).map(([id, scenario]) =>
            `<option value="${id}">${escape(scenario.title)}</option>`).join("")}</select></label>
          <button>Create scenario order</button>
        </form></details>` : ""}
      <details${draft ? " open" : ""}><summary>Manual order</summary><form method="post" action="/queue" class="stack">
        <input type="hidden" name="requestKey" value="${key}">${detailsForm(draft)}
        <button>Create order</button></form></details>
    </aside></div>`, user);
}

export function intakeReview(user, request, reviews, message = "", draft, { timeZone = defaultTimeZone, appointment = {} } = {}) {
  const details = draft ?? JSON.parse(request.details);
  const original = JSON.parse(request.original_details);
  const scheduled = Boolean(request.accession);
  const history = reviews.map(review => {
    const missing = JSON.parse(review.missing).map(key => intakeFields[key]?.[0] ?? (key === "patientName" ? "Patient name" : key === "appointment" ? "Appointment date and time" : key)).join(", ");
    const reviewedAppointment = JSON.parse(review.details).appointment;
    const checked = Object.entries(JSON.parse(review.checks)).filter(([, value]) => value)
      .map(([key]) => reviewGroups[key]).join("; ");
    return `<li><strong>${escape(review.username)}</strong> · ${escape(review.action.replaceAll("_", " "))} · ${review.created_at} UTC
      ${reviewedAppointment ? `<p>Appointment — ${escape(reviewedAppointment.date)} ${escape(reviewedAppointment.time)} (${escape(reviewedAppointment.timeZone ?? timeZone)})</p>` : ""}
      ${missing ? `<p>Missing at review — ${escape(missing)}</p>` : ""}
      ${checked ? `<p>Verified — ${escape(checked)}</p>` : ""}</li>`;
  }).join("");
  return page("Order review", `<a class="back" href="/queue">← Back to order queue</a>
    <div class="page-title"><h1>Order review</h1><p>Order ${request.id} · ${scheduled ? "Scheduled" : "Awaiting review"}</p></div>
    ${message ? `<p class="notice error" role="alert">${escape(message)}</p>` : ""}
    ${scheduled ? `<section class="panel"><p>Scheduled under ${request.accession}.</p><p>Appointment: ${escape(request.appointment_date)} ${escape(request.appointment_time)} (${escape(timeZone)})</p><a href="/ris?date=${escape(request.appointment_date)}">Open RIS worklist</a></section>`
    : `<form method="post" action="/queue/${request.id}" class="panel stack">
      <input type="hidden" name="revision" value="${request.revision}">
      ${detailsForm(details)}
      <fieldset><legend>Appointment</legend><p>Choose the appointment date and time (${escape(timeZone)}).</p>
        <label>Appointment date<input type="date" name="appointmentDate" min="1900-01-01" value="${escape(appointment.date ?? "")}"></label>
        <label>Appointment time<input type="time" name="appointmentTime" value="${escape(appointment.time ?? "")}"></label>
      </fieldset>
      <fieldset><legend>Completeness review</legend>
        <div class="intake-checks">${Object.entries(reviewGroups).map(([key, label]) =>
          `<label><input type="checkbox" name="check_${key}" value="verified"> ${label}</label>`).join("")}</div>
      </fieldset>
      <div class="intake-actions"><button name="action" value="schedule">Schedule order</button>
        <button class="secondary" name="action" value="needs_information">Return for missing information</button>
        <button class="secondary" name="action" value="save">Save corrections</button></div>
    </form>`}
    <section class="panel intake-history"><h2>Review history</h2>
      ${history ? `<ul>${history}</ul>` : '<p class="muted">No review recorded.</p>'}
      <details><summary>Original order as received</summary><dl>${original.firstName === undefined && original.lastName === undefined ? `<dt>Patient name (original)</dt><dd>${escape(original.patientName || "Not supplied")}</dd>` : ""}${Object.entries(intakeFields).map(([key, [label]]) =>
        `<dt>${label}</dt><dd>${escape(key === "examKey" ? exams[original[key]]?.examName ?? "Not supplied"
          : original[key] || "Not supplied")}</dd>`).join("")}</dl></details>
    </section>`, user);
}
