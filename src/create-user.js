import { randomBytes } from "node:crypto";
import { createUser, openDatabase } from "./db.js";

const [, , username, role] = process.argv;
if (!username || !role) {
  console.error("Usage: npm run create-user -- <username> <student|instructor|admin>");
  process.exit(1);
}

const db = openDatabase();
try {
  const password = randomBytes(18).toString("base64url");
  createUser(db, username, role, password);
  console.log(`Account: ${username} (${role})\nPassword: ${password}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
