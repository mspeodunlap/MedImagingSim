import { createApp } from "./app.js";
import { openDatabase } from "./db.js";

const port = Number(process.env.MEDSIM_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("MEDSIM_PORT must be an integer from 1024 to 65535.");
}

const db = openDatabase();
const server = createApp(db);
server.listen(port, "127.0.0.1", () => {
  console.log(`MedImagingSim is available at http://127.0.0.1:${port}`);
});
