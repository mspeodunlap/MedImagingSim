import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import {
  accessibleOrder, authenticate, endSession, launchOrder, saveScreening,
  sessionUser, startSession, visibleOrders,
} from "./db.js";
import { exams, readScreening, scenarios } from "./exams.js";
import { canUseWorkspace } from "./roles.js";
import { instructor, orderPage, problem, signIn, worklist } from "./views.js";

const styles = readFileSync(new URL("../public/styles.css", import.meta.url));
const orderPattern = /^\/ris\/orders\/(SIM-[A-F0-9]{16})(\/screening)?$/;
const tokenPattern = /(?:^|; *)medsim_session=([0-9a-f]{64})(?:;|$)/;

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

// Shared contract for the acquisition console. Eligibility and ownership are rechecked server-side.
export function consoleHandoff(db, user, accession) {
  const order = accessibleOrder(db, user, accession);
  if (order?.status !== "ready") return null;
  return {
    accession: order.accession,
    examKey: order.exam_key,
    modality: order.modality,
    consolePath: exams[order.exam_key].consolePath,
  };
}

export function createRequestHandler(db) {
  let attemptWindow = 0;
  let attempts = 0;

  return async (req, res) => {
    let user;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

    const reject = code => send(res, code, problem(code, user));

    try {
      const port = req.socket.localPort;
      const host = req.headers.host;
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) return reject(403);
      if (req.method === "POST" && req.headers.origin !== `http://${host}`) return reject(403);
      const path = new URL(req.url, `http://${host}`).pathname;
      if (req.method === "GET" && path === "/styles.css") {
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        return res.end(styles);
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
          attempts = 0;
        }
        if (attempts >= 20) {
          res.setHeader("Retry-After", Math.ceil((attemptWindow - Date.now()) / 1000));
          return reject(429);
        }
        attempts++;
        const id = username.length <= 40 && password.length <= 256 && authenticate(db, username, password);
        if (!id) return send(res, 401, signIn("Check your username and password."));
        const session = startSession(db, id);
        res.setHeader("Set-Cookie", `medsim_session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`);
        return redirect(res, "/");
      }

      if (!user) return redirect(res, "/sign-in");
      if (req.method === "POST" && path === "/sign-out") {
        endSession(db, token);
        res.setHeader("Set-Cookie", "medsim_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
        return redirect(res, "/sign-in");
      }
      if (req.method === "GET" && path === "/") {
        return canUseWorkspace(user, "student") ? redirect(res, "/ris") : send(res, 200, instructor(user));
      }
      if (req.method === "GET" && path === "/instructor") {
        return canUseWorkspace(user, "instructor") ? send(res, 200, instructor(user)) : reject(403);
      }
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
        const accession = launchOrder(db, user.id, scenario, exams[scenario.examKey], `${key}:${launchKey}`);
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
      if (!sessionUser(db, token)) return redirect(res, "/sign-in");
      if (order.status !== "ordered") return reject(409);
      const screening = readScreening(exam, form);
      if (!screening) return send(res, 400, orderPage(user, order, exam, "Answer each screening question."));
      if (!saveScreening(db, order.student_id, accession, screening).changes) return reject(409);
      return redirect(res, `/ris/orders/${accession}`);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) reject(500);
      else res.destroy();
    }
  };
}

export function createApp(db) {
  return createServer(createRequestHandler(db));
}
