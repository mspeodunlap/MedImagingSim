import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import {
  accessibleOrder, acquisitionDetails, acquisitionPixels, authenticate, endSession, findScan, launchOrder, listAcquisitions,
  pacsSelection, saveAcquisition, savePacsSelection, saveScreening,
  sessionUser, startSession, visibleOrders,
} from "./db.js";
import { exams, readScreening, scenarios } from "./exams.js";
import { generateMr, ScanQueueFull } from "./mr-executor.js";
import { makeLocalizers, mrExamKey, readPlan, readPresentation } from "./mr.js";
import { acquisitionViewer, mrConsole } from "./mr-view.js";
import { canUseWorkspace } from "./roles.js";
import { instructor, orderPage, problem, signIn, worklist } from "./views.js";

const assets = new Map([
  ["/styles.css", "text/css; charset=utf-8"],
  ["/mr-console.js", "text/javascript; charset=utf-8"],
  ["/mr-geometry.js", "text/javascript; charset=utf-8"],
].map(([path, type]) => [path, { type, bytes: readFileSync(new URL(`../public${path}`, import.meta.url)) }]));
const orderPattern = /^\/ris\/orders\/(SIM-[A-F0-9]{16})(\/screening)?$/;
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

async function readForm(req) {
  if (req.headers["content-type"]?.split(";")[0] !== "application/x-www-form-urlencoded") {
    return { error: 400 };
  }
  if (Number(req.headers["content-length"]) > 8192) return { error: 413 };
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 8192) return { error: 413 };
    chunks.push(chunk);
  }
  return { form: new URLSearchParams(Buffer.concat(chunks).toString("utf8")) };
}

function readyConsole(order) {
  const exam = order && exams[order.exam_key];
  if (order?.status !== "ready" || !exam?.consolePath) return null;
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
        return canUseWorkspace(user, "student") ? redirect(res, "/ris") : send(res, 200, instructor(user));
      }
      if (req.method === "GET" && path === "/instructor") {
        return canUseWorkspace(user, "instructor") ? send(res, 200, instructor(user)) : reject(403);
      }
      const mrMatch = path.match(mrPattern);
      if (mrMatch) return await handleMr(db, req, res, url, mrMatch, user, token, reject);
      if (path !== "/ris" && !path.startsWith("/ris/")) return reject(404);
      if (!canUseWorkspace(user, "student")) return reject(403);

      if (req.method === "GET" && path === "/ris") {
        return send(res, 200, worklist(user, visibleOrders(db, user), scenarios, randomBytes(16).toString("hex")));
      }
      if (req.method === "POST" && path === "/ris/orders") {
        const { form, error } = await readForm(req);
        if (error) return reject(error);
        const key = form.get("scenario");
        const launchKey = form.get("launchKey");
        if (!Object.hasOwn(scenarios, key) || !/^[a-f0-9]{32}$/.test(launchKey)) return reject(400);
        if (!sessionUser(db, token)) return redirect(res, "/sign-in");
        const scenario = scenarios[key];
        const accession = launchOrder(db, user, scenario, exams[scenario.examKey], `${key}:${launchKey}`);
        if (!accession) return reject(403);
        return redirect(res, `/ris/orders/${accession}`);
      }

      const match = path.match(orderPattern);
      if (!match) return reject(404);
      const [, accession, screeningRoute] = match;
      const order = accessibleOrder(db, user, accession);
      if (!order) return reject(404);
      const exam = exams[order.exam_key];
      if (req.method === "GET" && !screeningRoute) return send(res, 200, orderPage(user, order, exam));
      if (req.method !== "POST" || !screeningRoute) return reject(404);

      const { form, error } = await readForm(req);
      if (error) return reject(error);
      const currentUser = sessionUser(db, token);
      if (!currentUser) return redirect(res, "/sign-in");
      const currentOrder = accessibleOrder(db, currentUser, accession);
      if (!currentOrder) return reject(404);
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
