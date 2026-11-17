import assert from "node:assert/strict";
import { Readable } from "node:stream";

const base = "http://127.0.0.1:3000";

// Exercise the real request handler in environments that cannot bind a network listener.
export async function requestThrough(handle, path, { cookie, fields, origin = base, host = "127.0.0.1:3000", headers = {} } = {}) {
  const body = fields ? Buffer.from(new URLSearchParams(fields).toString()) : null;
  const req = Object.assign(Readable.from(body ? [body] : []), {
    url: path,
    method: fields ? "POST" : "GET",
    socket: { localPort: 3000 },
    headers: { ...headers, host, cookie },
  });
  if (fields) {
    req.headers.origin = origin;
    req.headers["content-type"] = "application/x-www-form-urlencoded";
  }

  let response;
  const responseHeaders = new Headers();
  await handle(req, {
    headersSent: false,
    setHeader(name, value) { responseHeaders.set(name, value); },
    writeHead(status, additional) {
      this.status = status;
      this.headersSent = true;
      for (const [name, value] of Object.entries(additional)) responseHeaders.set(name, value);
    },
    end(content) {
      response = new Response(content, { status: this.status, headers: responseHeaders });
    },
  });
  assert.ok(response);
  return response;
}
