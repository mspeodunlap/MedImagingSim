import { createApp } from "./app.js";
import { openDatabase } from "./db.js";

const port = Number(process.env.MEDSIM_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("MEDSIM_PORT must be an integer from 1024 to 65535.");
}

const db = openDatabase();
const publicOrigin = process.env.MEDSIM_PUBLIC_ORIGIN;
const server = createApp(db, { publicOrigin });
server.listen(port, "127.0.0.1", () => {
  const address = publicOrigin ?? `http://127.0.0.1:${port}`;
  console.log(`MedImagingSim is available at ${address}`);
});
