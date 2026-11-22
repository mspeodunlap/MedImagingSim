import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import {
  accessibleOrder, accessibleRequest, acquisitionDetails, acquisitionPixels, authenticate, createOrderRequest,
  endSession, findScan, listAcquisitions, requestReviews, reviewOrderRequest, visibleRequests,
  pacsSelection, saveAcquisition, savePacsSelection, saveScreening,
  sessionUser, startSession, visibleOrders, institutionTimeZone, appointmentHistory, rescheduleOrder,
} from "./db.js";
import { exams, readScreening, scenarios } from "./exams.js";
import { generateMr, ScanQueueFull } from "./mr-executor.js";
import { makeLocalizers, mrExamKey, readPlan, readPresentation } from "./mr.js";
import { acquisitionViewer, mrConsole } from "./mr-view.js";
import { canUseWorkspace } from "./roles.js";
import { intakeFields, missingIntake, quickOrder, readIntake, reviewGroups } from "./intake.js";
import { intakeReview, orderQueue } from "./intake-view.js";
import { futureOrder, localAppointment, readAppointment, validDate } from "./scheduling.js";
import { instructor, orderPage, problem, signIn, worklist } from "./views.js";

const assets = new Map([
  ["/styles.css", "text/css; charset=utf-8"],
  ["/mr-console.js", "text/javascript; charset=utf-8"],
  ["/mr-geometry.js", "text/javascript; charset=utf-8"],
].map(([path, type]) => [path, { type, bytes: readFileSync(new URL(`../public${path}`, import.meta.url)) }]));
const orderPattern = /^\/ris\/orders\/(SIM-[A-F0-9]{16})(\/(?:screening|reschedule))?$/;
const mrPattern = /^\/console\/mr\/(SIM-[A-F0-9]{16})(?:\/(?:(scan|localizers)|(pixels|selection|preview)\/([1-9][0-9]{0,15})))?$/;
const tokenPattern = /(?:^|; *)medsim_session=([0-9a-f]{64})(?:;|$)/;
let mrLocalizers;

function sendBytes(res, bytes, type = "application/octet-stream") {
  res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.byteLength });
  res.end(bytes);
}

function send(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function redirect(res, path) {
  res.writeHead(303, { Location: path });
  res.end();
}

async function readForm(req, limit = 8192) {
  if (req.headers["content-type"]?.split(";")[0] !== "application/x-www-form-urlencoded") {
    return { error: 400 };
  }
  if (Number(req.headers["content-length"]) > limit) return { error: 413 };
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) return { error: 413 };
    chunks.push(chunk);
  }
  return { form: new URLSearchParams(Buffer.concat(chunks).toString("utf8")) };
}

function readyConsole(order) {
  const exam = order && exams[order.exam_key];
  if (order?.status !== "ready" || !exam?.consolePath || futureOrder(order)) return null;
  return {
    accession: order.accession,
    examKey: order.exam_key,
    modality: order.modality,
    consolePath: exam.consolePath,
  };
}

// Shared contract for the acquisition console. Eligibility and ownership are rechecked server-side.
export function consoleHandoff(db, user, accession) {
  return readyConsole(accessibleOrder(db, user, accession));
}

async function handleMr(db, req, res, url, match, user, token, reject) {
  const [, accession, action, seriesAction, seriesId] = match;
  const { institutionId } = user;
  const order = accessibleOrder(db, user, accession);
  const handoff = readyConsole(order);
  if (handoff?.examKey !== mrExamKey || handoff.modality !== "MR") return reject(404);
  const base = `${handoff.consolePath}/${accession}`;
  const render = (status, requestedSeries, message, draft) => {
    const acquisitions = listAcquisitions(db, institutionId, accession);
    const selection = pacsSelection(db, institutionId, accession);
    const viewed = requestedSeries === null
      ? acquisitions[0]
      : acquisitions.find(series => String(series.id) === requestedSeries);
    if (requestedSeries !== null && !viewed) return reject(404);
    return send(res, status, mrConsole(user, handoff, order, {
      acquisitions, selection, viewed, message, scanKey: randomBytes(16).toString("hex"), ...draft,
    }));
  };

  if (req.method === "GET") {
    if (!action && !seriesAction) return render(200, url.searchParams.get("series"));
    if (action === "localizers") return sendBytes(res, mrLocalizers ??= makeLocalizers());
    const id = Number(seriesId);
    if (seriesAction === "pixels" && Number.isSafeInteger(id)) {
      const pixels = acquisitionPixels(db, institutionId, accession, id);
      if (pixels) return sendBytes(res, pixels);
    }
    if (seriesAction === "preview" && Number.isSafeInteger(id)) {
      const series = acquisitionDetails(db, institutionId, accession, id);
      if (series) return send(res, 200, acquisitionViewer(base, series, pacsSelection(db, institutionId, accession)));
    }
    return reject(404);
  }
  if (req.method !== "POST" || !(action === "scan" || seriesAction === "selection")) return reject(404);

  const { form, error } = await readForm(req);
  if (error) return reject(error);
  const currentUser = sessionUser(db, token);
  if (!currentUser) return redirect(res, "/sign-in");
  if (!consoleHandoff(db, currentUser, accession)) return reject(404);
  if (action === "scan") {
    const scanKey = form.get("scanKey");
    if (form.getAll("scanKey").length !== 1 || !/^[0-9a-f]{32}$/.test(scanKey)) return reject(400);
    const plan = readPlan(form);
    if (!plan) return render(400, null, "Check the slice coverage and sequence parameters before running the scan.");
    const existing = findScan(db, institutionId, accession, scanKey);
    if (existing) return redirect(res, `${base}?series=${existing.id}`);
    let acquisition;
    try {
      acquisition = await generateMr(plan);
    } catch (error) {
      if (!(error instanceof ScanQueueFull)) throw error;
      res.setHeader("Retry-After", "2");
      return render(503, null, "The scanner is busy. Try running the scan again in a moment.", { plan, scanKey });
    }
    const operator = sessionUser(db, token);
    if (!operator) return redirect(res, "/sign-in");
    const id = saveAcquisition(db, operator, accession, scanKey, acquisition);
    if (!id) return reject(404);
    return redirect(res, `${base}?series=${id}`);
  }

  const id = Number(seriesId);
  if (!Number.isSafeInteger(id)) return reject(404);
  const presentation = readPresentation(form);
  if (!presentation) return render(400, seriesId, "Enter a valid window width and level.");
  if (!savePacsSelection(db, institutionId, accession, id, presentation)) return reject(404);
  return redirect(res, `${base}?series=${id}`);
}

export function createRequestHandler(db, { publicOrigin } = {}) {
  let hosted;
  if (publicOrigin !== undefined) {
    hosted = new URL(publicOrigin);
    if (hosted.protocol !== "https:" || hosted.origin !== publicOrigin) {
      throw new Error("MEDSIM_PUBLIC_ORIGIN must be an HTTPS origin with no trailing slash, path, or credentials.");
    }
  }
  const secureCookie = hosted ? "; Secure" : "";
  let attemptWindow = 0;
  let pendingSignIns = 0;
  const attempts = new Map();

  return async (req, res) => {
    let user;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

    const reject = code => send(res, code, problem(code, user));

    try {
      const port = req.socket.localPort;
      const host = req.headers.host;
      const allowedHosts = hosted ? [hosted.host] : [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!allowedHosts.includes(host)) return reject(403);
      const origin = hosted?.origin ?? `http://${host}`;
      if (req.method === "POST" && req.headers.origin !== origin) return reject(403);
      const url = new URL(req.url, origin);
      if (url.origin !== origin) return reject(403);
      const path = url.pathname;
      const asset = assets.get(path);
      if (req.method === "GET" && asset) {
        return sendBytes(res, asset.bytes, asset.type);
      }

      const token = req.headers.cookie?.match(tokenPattern)?.[1];
      user = sessionUser(db, token);
      if (req.method === "GET" && path === "/sign-in") {
        return user ? redirect(res, "/") : send(res, 200, signIn());
      }
      if (req.method === "POST" && path === "/sign-in") {
        if (user) return redirect(res, "/");
        const { form, error } = await readForm(req);
        if (error) return reject(error);
        const username = (form.get("username") ?? "").trim().toLowerCase();
        const password = form.get("password") ?? "";
        if (Date.now() >= attemptWindow) {
          attemptWindow = Date.now() + 60_000;
          attempts.clear();
        }
        if (username.length > 40 || password.length > 256) return send(res, 401, signIn("Check your username and password."));
        const limitedUsername = (attempts.size < 1024 || attempts.has(username)) ? username : null;
        const count = attempts.get(limitedUsername) ?? 0;
        if (pendingSignIns >= 64 || count >= 20) {
          res.setHeader("Retry-After", count >= 20 ? Math.max(1, Math.ceil((attemptWindow - Date.now()) / 1000)) : 1);
          return reject(429);
        }
        attempts.set(limitedUsername, count + 1);
        pendingSignIns++;
        let session;
        try {
          const id = await authenticate(db, username, password);
          if (id) session = startSession(db, id);
        } finally {
          pendingSignIns--;
        }
        if (!session) return send(res, 401, signIn("Check your username and password."));
        res.setHeader("Set-Cookie", `medsim_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secureCookie}`);
        return redirect(res, "/");
      }

      if (!user) return redirect(res, "/sign-in");
      if (req.method === "POST" && path === "/sign-out") {
        endSession(db, token);
        res.setHeader("Set-Cookie", `medsim_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie}`);
        return redirect(res, "/sign-in");
      }
      if (req.method === "GET" && path === "/") {
        return redirect(res, "/queue");
      }
      if (req.method === "GET" && path === "/instructor") {
        return canUseWorkspace(user, "instructor") ? send(res, 200, instructor(user)) : reject(403);
      }
      if (path === "/queue" || path.startsWith("/queue/")) {
        if (req.method === "GET" && path === "/queue") {
          return send(res, 200, orderQueue(user, visibleRequests(db, user), randomBytes(16).toString("hex")));
        }
        const queueMatch = path.match(/^\/queue\/([1-9][0-9]{0,12})$/);
        const requestId = queueMatch ? Number(queueMatch[1]) : null;
        const intake = requestId && accessibleRequest(db, user, requestId);
        let appointmentDraft;
        const render = (code, message, draft) => send(res, code, intakeReview(user,
          accessibleRequest(db, user, requestId), requestReviews(db, requestId), message, draft, { timeZone: institutionTimeZone(db, user.institutionId), appointment: appointmentDraft }));
        if (req.method === "GET" && intake) return render(200);
        if (req.method !== "POST") return reject(404);
        const { form, error } = await readForm(req, 65536);
        if (error) return reject(error);
        user = sessionUser(db, token);
        if (!user) return redirect(res, "/sign-in");
        if (path === "/queue" || path === "/queue/quick") {
          const key = form.get("requestKey");
          if (form.getAll("requestKey").length !== 1 || !/^[a-f0-9]{32}$/.test(key)) return reject(400);
          const details = path === "/queue/quick" ? quickOrder() : readIntake(form);
          if (!details) return send(res, 400, orderQueue(user, visibleRequests(db, user), key,
            "Check field lengths, the supplied date of birth, recorded sex, and requested exam.",
            Object.fromEntries(Object.keys(intakeFields).map(field => [field, form.get(field) ?? ""]))));
          const id = createOrderRequest(db, user, details, key, path === "/queue/quick" ? "quick" : "manual");
          return redirect(res, `/queue/${id}`);
        }
        if (!intake || !accessibleRequest(db, user, requestId)) return reject(404);
        appointmentDraft = { date: form.get("appointmentDate") ?? "", time: form.get("appointmentTime") ?? "" };
        const details = readIntake(form);
        const revision = form.get("revision");
        const action = form.get("action");
        if (form.getAll("revision").length !== 1 || !/^\d+$/.test(revision) ||
            form.getAll("action").length !== 1 || !["schedule", "needs_information", "save"].includes(action)) return reject(400);
        if (!details) return render(400, "Check field lengths, the supplied date of birth, recorded sex, and requested exam.",
          Object.fromEntries(Object.keys(intakeFields).map(field => [field, form.get(field) ?? ""])));
        const appointment = readAppointment(form);
        const checks = Object.fromEntries(Object.keys(reviewGroups).map(key =>
          [key, form.getAll(`check_${key}`).length === 1 && form.get(`check_${key}`) === "verified"]));
        const missing = missingIntake(details);
        const result = reviewOrderRequest(db, user, requestId, Number(revision), details, checks, missing, action, appointment);
        if (!result) return render(409, "This order changed or was scheduled. Reopen it before reviewing.");
        if (result.result === "schedule_blocked") {
          const feedback = missing.length ? `Required information is missing — ${missing.map(key => intakeFields[key][0]).join(", ")}.`
            : !appointment ? "Select a valid appointment date and time before scheduling."
              : "Verify all three completeness checks before scheduling.";
          return render(400, feedback);
        }
        if (result.accession) return redirect(res, "/queue");
        return render(200, action === "needs_information" ? "Missing information review recorded. The order remains in the queue." : "Corrections saved.");
      }
      const mrMatch = path.match(mrPattern);
      if (mrMatch) return await handleMr(db, req, res, url, mrMatch, user, token, reject);
      if (path !== "/ris" && !path.startsWith("/ris/")) return reject(404);
      if (req.method === "GET" && path === "/ris") {
        const timeZone = institutionTimeZone(db, user.institutionId);
        const date = url.searchParams.get("date") ?? localAppointment(new Date(), timeZone).date;
        if (url.searchParams.getAll("date").length > 1 || !validDate(date)) return reject(400);
        return send(res, 200, worklist(user, visibleOrders(db, user, date), { date, timeZone }));
      }
      if (!canUseWorkspace(user, "student")) return reject(403);
      if (req.method === "POST" && path === "/ris/orders") {
        const { form, error } = await readForm(req);
        if (error) return reject(error);
        const key = form.get("scenario");
        const launchKey = form.get("launchKey");
        if (!Object.hasOwn(scenarios, key) || !/^[a-f0-9]{32}$/.test(launchKey)) return reject(400);
        if (!sessionUser(db, token)) return redirect(res, "/sign-in");
        const scenario = scenarios[key];
        const id = createOrderRequest(db, user, {
          firstName: scenario.firstName, lastName: scenario.lastName,
          patientName: scenario.patient, patientId: "SIM-" + randomBytes(4).toString("hex").toUpperCase(),
          dob: `${new Date().getUTCFullYear() - scenario.age}-01-01`, sex: "Unknown",
          examKey: scenario.examKey, indication: scenario.indication, history: scenario.history,
        }, `scenario:${key}:${launchKey}`, "scenario");
        return redirect(res, `/queue/${id}`);
      }

      const match = path.match(orderPattern);
      if (!match) return reject(404);
      const [, accession, screeningRoute] = match;
      const order = accessibleOrder(db, user, accession);
      if (!order) return reject(404);
      const exam = exams[order.exam_key];
      if (req.method === "GET" && !screeningRoute) return send(res, 200, orderPage(user, order, exam, "", appointmentHistory(db, accession)));
      if (req.method !== "POST" || !screeningRoute) return reject(404);

      const { form, error } = await readForm(req);
      if (error) return reject(error);
      const currentUser = sessionUser(db, token);
      if (!currentUser) return redirect(res, "/sign-in");
      const currentOrder = accessibleOrder(db, currentUser, accession);
      if (!currentOrder) return reject(404);
      if (screeningRoute === "/reschedule") {
        const appointment = readAppointment(form);
        const revision = form.get("scheduleRevision");
        if (!appointment || form.getAll("scheduleRevision").length !== 1 || !/^\d+$/.test(revision)) return reject(400);
        if (!rescheduleOrder(db, currentUser, accession, Number(revision), appointment)) {
          return send(res, 409, orderPage(currentUser, currentOrder, exam,
            "This appointment changed or screening has started. Reopen the order before rescheduling.", appointmentHistory(db, accession)));
        }
        return redirect(res, `/ris?date=${appointment.date}`);
      }
      if (futureOrder(currentOrder)) return send(res, 403, orderPage(currentUser, currentOrder, exam,
        "Future-dated exams cannot be started. Check the appointment and reschedule if necessary.", appointmentHistory(db, accession)));
      if (currentOrder.status !== "ordered") return reject(409);
      const screening = readScreening(exam, form);
      if (!screening) return send(res, 400, orderPage(user, order, exam, "Answer each screening question."));
      if (!saveScreening(db, currentOrder, screening).changes) return reject(409);
      return redirect(res, `/ris/orders/${accession}`);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) reject(500);
      else res.destroy();
    }
  };
}

export function createApp(db, options) {
  return createServer(createRequestHandler(db, options));
}
