import { screeningAnswers, statusLabels } from "./exams.js";
import { canUseWorkspace } from "./roles.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

const status = value => `<span class="status ${value}">${statusLabels[value]}</span>`;
const title = (label, detail) => `<div class="page-title"><h1>${label}</h1><p>${detail}</p></div>`;

export function page(name, content, user) {
  const home = canUseWorkspace(user, "student") ? "/ris" : "/";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(name)} · MedImagingSim</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="shell-header">
  <div class="shell-inner">
    <a class="wordmark" href="${home}"><span class="brand-mark" aria-hidden="true"></span>MedImagingSim</a>
    ${user?.role === "admin" ? `<nav class="workspace-nav" aria-label="Workspaces">
      <a href="/ris">RIS worklist</a><a href="/instructor">Instructor home</a></nav>` : ""}
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
  </section>`);
}

export function instructor(user) {
  return page("Instructor home", `${title("Instructor home", "Assignments and submission review will appear here when grading is available.")}
    <section class="panel"><h2>Submissions</h2><p class="muted">No submissions to review.</p></section>`, user);
}

export function worklist(user, orders, scenarios, launchKey) {
  const showOwner = user.role === "admin";
  const rows = orders.map(order => `<tr>
    <td><a href="/ris/orders/${order.accession}">${escape(order.patient_name)}</a></td>
    ${showOwner ? `<td>${escape(order.owner)}</td>` : ""}
    <td>${escape(order.exam_name)}</td>
    <td class="accession">${order.accession}</td>
    <td>${status(order.status)}</td>
  </tr>`).join("");
  return page("RIS worklist", `${title("RIS worklist", "Open an imaging order to review the patient history and record screening.")}
    <div class="worklist-layout">
      <section class="panel"><h2>Orders <span class="count">${orders.length}</span></h2>
        ${orders.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Imaging orders"><table>
          <thead><tr><th scope="col">Patient</th>${showOwner ? '<th scope="col">Owner</th>' : ""}<th scope="col">Exam</th><th scope="col">Accession</th><th scope="col">Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : '<p class="muted">Your worklist is empty. Launch a sandbox exam to get started.</p>'}
      </section>
      <aside class="panel sandbox"><h2>Practice sandbox</h2><p class="muted">Launch a fictional patient and order.</p>
        <form method="post" action="/ris/orders" class="stack">
          <input type="hidden" name="launchKey" value="${launchKey}">
          <label for="scenario">Scenario</label>
          <select name="scenario" id="scenario">
            ${Object.entries(scenarios).map(([id, scenario]) => `<option value="${id}">${escape(scenario.title)}</option>`).join("")}
          </select>
          <button>Launch exam</button>
        </form>
      </aside>
    </div>`, user);
}

export function orderPage(user, order, exam, message = "") {
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
    <div class="order-layout">
      <section class="panel"><h2>Patient history</h2>
        <dl><dt>Fictional patient</dt><dd>${escape(order.patient_name)} · ${order.patient_age} years</dd>
        <dt>Indication</dt><dd>${escape(order.indication)}</dd>
        <dt>Clinical history</dt><dd>${escape(order.history)}</dd></dl>
      </section>
      <section class="panel"><h2>Safety screening</h2>
        ${message ? `<p class="notice error" role="alert">${escape(message)}</p>` : ""}
        ${order.status === "ordered"
          ? `<form method="post" action="/ris/orders/${order.accession}/screening">${questions}<button>Submit screening</button></form>`
          : `${questions}${order.status === "held"
              ? '<p class="notice hold">Screening requires further review. This exam is on hold.</p>'
              : '<p class="notice cleared">Screening complete. This order is ready for the console.</p><p class="muted">The acquisition console is added in Milestone 2.</p>'}`}
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
    429: ["Too many sign-in attempts", "Wait a minute before trying again."],
    500: ["Something went wrong", "Return to your workspace and try again."],
  };
  const [name, detail] = messages[code];
  return page(name, `${title(name, detail)}<a href="/">Return to workspace</a>`, user);
}
