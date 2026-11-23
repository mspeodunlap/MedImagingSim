import { timingError } from "../public/mr-physics.js";
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
import { defaultPlan, makeLocalizers, mrExamKey, readPlan, readPresentation } from "./mr.js";
import { acquisitionViewer, mrConsole } from "./mr-view.js";
import { canUseWorkspace } from "./roles.js";
import { intakeFields, missingIntake, quickOrder, readIntake, reviewGroups } from "./intake.js";
import { intakeReview, orderQueue } from "./intake-view.js";
import { futureOrder, localAppointment, readAppointment, validDate } from "./scheduling.js";
import { trainingDocuments } from "./training.js";
import { accessibleProtocol, changeExamProtocol, examProtocol, protocolVersions, saveProtocolVersion, sequenceFromPlan, validateProtocol } from "./protocols.js";
import { protocolLibrary, readProtocolDraft } from "./protocol-view.js";
import { dictionary, dictionaryVersion, teachingStarter, teachingStarters } from "./mri-dictionary.js";
import { dictionaryPage } from "./mri-dictionary-view.js";
import { copyGeometry } from "./console-workflow.js";
import { canOperate, ended, examHistory, transitionExam } from "./lifecycle.js";
import { instructor, orderPage, problem, signIn, worklist } from "./views.js";

const assets = new Map([
  ["/styles.css", "text/css; charset=utf-8"],
  ["/mr-console.js", "text/javascript; charset=utf-8"],
  ["/mr-protocol-editor.js", "text/javascript; charset=utf-8"],
  ["/ris-worklist.js", "text/javascript; charset=utf-8"],
  ["/mr-geometry.js", "text/javascript; charset=utf-8"],
  ["/mr-physics.js", "text/javascript; charset=utf-8"],
].map(([path, type]) => [path, { type, bytes: readFileSync(new URL(`../public${path}`, import.meta.url)) }]));
const orderPattern = /^\/ris\/orders\/(SIM-[A-F0-9]{16})(\/(?:screening|reschedule|begin|end|complete|reopen|return))?$/;
const mrPattern = /^\/console\/mr\/(SIM-[A-F0-9]{16})(?:\/(?:(scan|localizers|protocol)|(pixels|selection|preview)\/([1-9][0-9]{0,15})))?$/;
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

async function handleProtocols(db, req, res, url, user, token, reject) {
  if (req.method === "GET" && url.pathname === "/protocols/mr/dictionary.json") {
    res.setHeader("Content-Disposition", `attachment; filename="mri-dictionary-${dictionaryVersion}.json"`);
    return sendBytes(res, Buffer.from(JSON.stringify(dictionary, null, 2)), "application/json; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/protocols/mr/dictionary") {
    const p = url.searchParams;
    if (["tab", "q", "category", "strength"].some(key => p.getAll(key).length > 1) || (p.get("q") ?? "").length > 200 ||
      !["exams", "sequences", "anatomy", "starters", "sources"].includes(p.get("tab") ?? "exams") ||
      (p.get("category") && !dictionary.categories.some(c => c.id === p.get("category"))) ||
      !["", "1.5T", "3T"].includes(p.get("strength") ?? "")) return reject(400);
    return send(res, 200, dictionaryPage(user, p));
  }
  if (req.method === "POST" && url.pathname === "/protocols/mr/install-starters") {
    const parsed = await readForm(req);
    if (parsed.error) return reject(parsed.error);
    user = sessionUser(db, token);
    if (!user) return redirect(res, "/sign-in");
    if (!["instructor", "admin"].includes(user.role)) return reject(403);
    let installed = 0, skipped = 0;
    for (const starter of teachingStarters) {
      const result = saveProtocolVersion(db, user, "default", starter.name,
        { sequences: starter.sequences, origin: { id: starter.id, version: dictionaryVersion } });
      if (result.error === "conflict") skipped++;
      else if (result.error) return reject(result.error === "forbidden" ? 403 : 400);
      else installed++;
    }
    return redirect(res, `/protocols/mr?installed=${installed}&skipped=${skipped}`);
  }
  if (!["/protocols/mr", "/protocols/mr/edit", "/protocols/mr/save"].includes(url.pathname)) return reject(404);
  let document = { sequences: [sequenceFromPlan({ ...defaultPlan })] };
  let name = "", sourceId = "";
  const render = (code, message = "", saved = false) => send(res, code, protocolLibrary(user, protocolVersions(db, user), document, { name, sourceId, message, saved }));
  if (req.method === "GET" && url.pathname === "/protocols/mr") {
    const id = url.searchParams.get("version"), accession = url.searchParams.get("exam"), starterId = url.searchParams.get("starter");
    if (["version", "exam", "starter"].some(key => url.searchParams.getAll(key).length > 1) || [id, accession, starterId].filter(v => v !== null).length > 1) return reject(400);
    if (id !== null) {
      if (!/^[1-9]\d{0,14}$/.test(id)) return reject(400);
      const version = accessibleProtocol(db, user, Number(id));
      if (!version) return reject(404);
      document = JSON.parse(version.payload); name = version.name; sourceId = version.id;
    } else if (starterId !== null) {
      const starter = teachingStarter(starterId);
      if (!starter) return reject(404);
      document = { sequences: starter.sequences, origin: { id: starter.id, version: dictionaryVersion } }; name = starter.name;
    } else if (accession !== null) {
      const order = accessibleOrder(db, user, accession);
      if (!order) return reject(404);
      const copy = examProtocol(db, user.institutionId, accession);
      if (copy) {
        document = JSON.parse(copy.payload); name = copy.protocol_name ?? "";
        sourceId = copy.source_version_id && accessibleProtocol(db, user, copy.source_version_id) ? copy.source_version_id : "";
      }
    }
    const installed = url.searchParams.get("installed"), skipped = url.searchParams.get("skipped");
    return render(200, /^\d$/.test(installed) && /^\d$/.test(skipped) ? `${installed} teaching defaults installed; ${skipped} existing names preserved.` : url.searchParams.get("saved") === "1" ? "Protocol version saved. Earlier versions are unchanged." : "", url.searchParams.get("saved") === "1" || installed !== null);
  }
  if (req.method !== "POST" || url.pathname === "/protocols/mr") return reject(404);
  const { form, error } = await readForm(req, 131072);
  if (error) return reject(error);
  user = sessionUser(db, token);
  if (!user) return redirect(res, "/sign-in");
  document = readProtocolDraft(form);
  if (!document || form.getAll("name").length !== 1 || form.getAll("sourceVersion").length !== 1) return reject(400);
  name = form.get("name"); sourceId = form.get("sourceVersion");
  if (sourceId && !/^[1-9]\d{0,14}$/.test(sourceId)) return reject(400);
  if (sourceId && !accessibleProtocol(db, user, Number(sourceId))) return reject(404);
  const valid = validateProtocol(document);
  if (!valid) return render(400, "Check every sequence name, coverage, timing and parameter range. Unsaved fields are retained.");
  document = valid;
  if (url.pathname === "/protocols/mr/edit") {
    if (form.getAll("editAction").length !== 1) return reject(400);
    const action = form.get("editAction");
    if (action === "add" && document.sequences.length < 32) {
      document.sequences.push({ name: `Sequence ${document.sequences.length + 1}`, plan: { ...defaultPlan } });
    } else {
      const match = action?.match(/^(up|down|remove):(\d+)$/);
      if (!match) return reject(400);
      const index = Number(match[2]), count = document.sequences.length;
      if (index >= count || (match[1] === "remove" && count === 1) ||
        (match[1] === "up" && index === 0) || (match[1] === "down" && index === count - 1)) return reject(400);
      if (match[1] === "remove") document.sequences.splice(index, 1);
      else { const other = index + (match[1] === "up" ? -1 : 1); [document.sequences[index], document.sequences[other]] = [document.sequences[other], document.sequences[index]]; }
    }
    return render(200, "Sequence list updated in this editor. Save a protocol version to keep these changes.", true);
  }
  if (form.getAll("kind").length !== 1) return reject(400);
  const result = saveProtocolVersion(db, user, form.get("kind"), name, document, sourceId ? Number(sourceId) : null);
  if (result.error === "forbidden") return reject(403);
  if (result.error) return render(result.error === "conflict" ? 409 : 400, result.error === "conflict"
    ? "A protocol with that name already exists or has a newer version. Load its latest version before saving, or choose a different name."
    : "Enter a protocol name and valid settings for every sequence.");
  return redirect(res, `/protocols/mr?version=${result.id}&saved=1`);
}

function readyConsole(order, user, readOnly = false) {
  const exam = order && exams[order.exam_key];
  if (order?.status !== "ready" || !exam?.consolePath || futureOrder(order)) return null;
  if (!(readOnly && ended(order)) && (order.workflow_status !== "exam_begin" || !canOperate(user, order))) return null;
  return {
    accession: order.accession,
    examKey: order.exam_key,
    modality: order.modality,
    consolePath: exam.consolePath,
  };
}

// Shared contract for the acquisition console. Eligibility and ownership are rechecked server-side.
export function consoleHandoff(db, user, accession) {
  return readyConsole(accessibleOrder(db, user, accession), user);
}

function openExam(db, user, accession) {
  let order = accessibleOrder(db, user, accession);
  if (user.role === "instructor" && ended(order) && !order.locked_by) {
    transitionExam(db, user, accession, undefined, "review");
    order = accessibleOrder(db, user, accession);
  }
  return order;
}

async function handleMr(db, req, res, url, match, user, token, reject) {
  const [, accession, action, seriesAction, seriesId] = match;
  const { institutionId } = user;
  const order = req.method === "GET" ? openExam(db, user, accession) : accessibleOrder(db, user, accession);
  const readOnly = ended(order);
  const handoff = readyConsole(order, user, req.method === "GET");
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
      acquisitions, selection, viewed, message, messageKind: status >= 400 ? "error" : "cleared", readOnly, protocols: protocolVersions(db, user), workingProtocol: examProtocol(db, institutionId, accession), scanKey: randomBytes(16).toString("hex"), ...draft,
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
      if (series) return send(res, 200, acquisitionViewer(base, series, pacsSelection(db, institutionId, accession), readOnly));
    }
    return reject(404);
  }
  if (req.method !== "POST" || !(action === "scan" || action === "protocol" || seriesAction === "selection")) return reject(404);

  const { form, error } = await readForm(req);
  if (error) return reject(error);
  const currentUser = sessionUser(db, token);
  if (!currentUser) return redirect(res, "/sign-in");
  if (!consoleHandoff(db, currentUser, accession)) return reject(404);
  if (action === "protocol") {
    const revision = form.get("protocolRevision"), operation = form.get("protocolAction");
    if (form.getAll("protocolRevision").length !== 1 || !/^\d+$/.test(revision) || form.getAll("protocolAction").length !== 1) return reject(400);
    const selecting = operation?.match(/^select:(\d+)$/);
    const geometry = operation?.match(/^geometry:([1-9]\d{0,14})$/);
    if (geometry) {
      const current = examProtocol(db, institutionId, accession);
      if (Number(revision) !== (current?.revision ?? 0)) return render(409, null, "The case protocol changed. Reload before copying geometry.");
      const source = acquisitionDetails(db, institutionId, accession, Number(geometry[1]));
      if (!source) return reject(404);
      const target = readPlan(form), draft = target && copyGeometry(target, source);
      if (!draft) return render(400, String(geometry[1]), "Geometry is incompatible with the current plan. Check the parameters; a 3D GRE slab needs zero gap.", target ? { plan: target } : undefined);
      return render(200, String(geometry[1]), "Geometry copied to the current draft. Timing and contrast are unchanged. Save sequence settings or run a scan to keep it.", { plan: draft });
    }
    if (!["load", "update", "save"].includes(operation) && !selecting) return reject(400);
    const plan = operation === "load" ? undefined : readPlan(form);
    if (operation !== "load" && !plan) return render(400, null, "Check all sequence parameters before saving or changing sequences.");
    const choice = form.get("protocolVersion"), starterId = choice?.startsWith("starter:") ? choice.slice(8) : null;
    if (operation === "load" && (form.getAll("protocolVersion").length !== 1 || !(starterId ? teachingStarter(starterId) : /^[1-9]\d{0,14}$/.test(choice)))) return reject(400);
    if (operation === "save" && form.getAll("protocolName").length !== 1) return reject(400);
    const result = changeExamProtocol(db, currentUser, accession, Number(revision), selecting ? "select" : operation,
      { versionId: Number(choice), starterId, selected: selecting ? Number(selecting[1]) : undefined, plan, name: form.get("protocolName") });
    if (result.error === "forbidden") return reject(403);
    if (result.error) return render(result.error === "conflict" ? 409 : 400, null,
      result.error === "conflict" ? "This case or named protocol changed. Reload the latest version or choose a different personal protocol name." : "Check the protocol name and sequence settings.", plan ? { plan } : undefined);
    return redirect(res, `${base}#planning`);
  }
  if (action === "scan") {
    const startingCopy = examProtocol(db, institutionId, accession);
    const scanKey = form.get("scanKey");
    if (form.getAll("scanKey").length !== 1 || !/^[0-9a-f]{32}$/.test(scanKey)) return reject(400);
    const plan = readPlan(form);
    if (!plan) {
      const draft = readPlan(form, { allowTimingInvalid: true });
      return render(400, null, draft ? timingError(draft) : "Check slice coverage, parameter ranges and sequence timing before running the scan.", draft ? { plan: draft } : undefined);
    }
    const existing = findScan(db, institutionId, accession, scanKey);
    if (existing) return redirect(res, `${base}?series=${existing.id}#review`);
    const revision = form.get("protocolRevision");
    if (form.has("protocolRevision") && (form.getAll("protocolRevision").length !== 1 || !/^\d+$/.test(revision) || Number(revision) !== (startingCopy?.revision ?? 0))) {
      return render(409, null, "The case protocol changed in another tab. Reload before scanning.", { plan });
    }
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
    if (startingCopy && revision !== null) {
      const document = JSON.parse(startingCopy.payload);
      acquisition.parameters.protocolContext = { instanceKey: startingCopy.instance_key, sequenceIndex: startingCopy.selected_sequence,
        sequenceName: document.sequences[startingCopy.selected_sequence].name, protocolRevision: startingCopy.revision };
    }
    const id = saveAcquisition(db, operator, accession, scanKey, acquisition, order.workflow_revision);
    if (!id) return reject(404);
    // Retain a successfully acquired plan in an already-loaded case copy, without publishing
    // a library version or overwriting a sequence changed while generation was in progress.
    if (startingCopy) changeExamProtocol(db, operator, accession, startingCopy.revision, "update", { plan });
    return redirect(res, `${base}?series=${id}#review`);
  }

  const id = Number(seriesId);
  if (!Number.isSafeInteger(id)) return reject(404);
  const presentation = readPresentation(form);
  if (!presentation) return render(400, seriesId, "Enter a valid window width and level.");
  if (!savePacsSelection(db, institutionId, accession, id, presentation)) return reject(404);
  return redirect(res, `${base}?series=${id}#review`);
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
      const training = trainingDocuments.get(path);
      if (req.method === "GET" && training) {
        res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'");
        return sendBytes(res, training, "text/html; charset=utf-8");
      }
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
      if (path.startsWith("/protocols/mr")) return await handleProtocols(db, req, res, url, user, token, reject);
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
      if (req.method === "GET" && (path === "/ris" || path === "/ris/recent")) {
        const timeZone = institutionTimeZone(db, user.institutionId);
        const date = url.searchParams.get("date") ?? localAppointment(new Date(), timeZone).date;
        if (url.searchParams.getAll("date").length > 1 || !validDate(date)) return reject(400);
        const recent = path === "/ris/recent";
        return send(res, 200, worklist(user, visibleOrders(db, user, date, recent), { date, timeZone, recent }));
      }
      if (req.method === "POST" && path === "/ris/orders") {
        if (!canUseWorkspace(user, "student")) return reject(403);
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
      const order = req.method === "GET" && !screeningRoute ? openExam(db, user, accession) : accessibleOrder(db, user, accession);
      if (!order) return reject(404);
      const exam = exams[order.exam_key];
      const renderOrder = (code, current, message = "") => send(res, code, orderPage(user, current, exam, message,
        appointmentHistory(db, accession), examHistory(db, accession), listAcquisitions(db, user.institutionId, accession), pacsSelection(db, user.institutionId, accession)));
      if (req.method === "GET" && !screeningRoute) return renderOrder(200, order);
      if (req.method !== "POST" || !screeningRoute) return reject(404);

      const { form, error } = await readForm(req, ["/end", "/return"].includes(screeningRoute) ? 65536 : 8192);
      if (error) return reject(error);
      const currentUser = sessionUser(db, token);
      if (!currentUser) return redirect(res, "/sign-in");
      const currentOrder = accessibleOrder(db, currentUser, accession);
      if (!currentOrder) return reject(404);
      if (["/begin", "/end", "/complete", "/reopen", "/return"].includes(screeningRoute)) {
        const revision = form.get("workflowRevision");
        if (form.getAll("workflowRevision").length !== 1 || !/^\d+$/.test(revision)) return reject(400);
        const details = screeningRoute === "/end" ? {
          performedVerified: form.getAll("performedVerified").length === 1 && form.get("performedVerified") === "yes",
          notes: form.getAll("notes").length <= 1 ? form.get("notes") ?? "" : null,
        } : screeningRoute === "/return" ? { reason: form.getAll("reason").length === 1 ? form.get("reason") : null } : {};
        if (!transitionExam(db, currentUser, accession, Number(revision), screeningRoute.slice(1), details)) {
          return renderOrder(409, accessibleOrder(db, currentUser, accession),
            "The study changed, is locked, or this action's prerequisites are not met. Reload and check the current stage. End exam requires a saved acquisition and performed-exam confirmation; sending back requires a correction reason.");
        }
        return redirect(res, form.get("returnToConsole") === "yes" && ["/end", "/complete"].includes(screeningRoute)
          ? `/console/mr/${accession}#finish` : `/ris/orders/${accession}`);
      }
      if (!canUseWorkspace(currentUser, "student")) return reject(403);
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
      if (!saveScreening(db, currentOrder, screening, currentUser.id).changes) return reject(409);
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
