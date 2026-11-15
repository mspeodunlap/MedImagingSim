import { parentPort } from "node:worker_threads";
import { acquireMr } from "./mr.js";

parentPort.on("message", plan => {
  try {
    const result = acquireMr(plan);
    parentPort.postMessage({ result }, [result.pixels.buffer]);
  } catch (error) {
    parentPort.postMessage({ error });
  }
});
