import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";

const workerLimit = Math.min(4, Math.max(1, availableParallelism() - 1));
const queueLimit = 32;
const workers = new Set();
const queue = [];

function addWorker() {
  const worker = new Worker(new URL("./mr-worker.js", import.meta.url));
  const slot = { worker, task: null, failed: false };
  workers.add(slot);

  worker.on("message", ({ result, error }) => {
    const task = slot.task;
    slot.task = null;
    if (error) task.reject(error);
    else task.resolve(result);
    worker.unref();
    dispatch();
  });

  worker.on("error", error => {
    slot.failed = true;
    slot.task?.reject(error);
    slot.task = null;
  });

  worker.on("exit", code => {
    workers.delete(slot);
    slot.task?.reject(new Error(`MRI worker exited with status ${code}.`));
    dispatch();
  });
  return slot;
}

function dispatch() {
  while (queue.length) {
    const idle = [...workers].find(slot => !slot.task && !slot.failed);
    if (!idle && workers.size >= workerLimit) return;
    const task = queue.shift();
    let slot;
    try {
      slot = idle ?? addWorker();
      slot.task = task;
      slot.worker.ref();
      slot.worker.postMessage(task.plan);
    } catch (error) {
      if (slot) {
        slot.failed = true;
        slot.task = null;
        void slot.worker.terminate();
      }
      task.reject(error);
    }
  }
}

export class ScanQueueFull extends Error {}

export function generateMr(plan) {
  if (queue.length >= queueLimit) return Promise.reject(new ScanQueueFull("MRI scan queue is full."));
  return new Promise((resolve, reject) => {
    queue.push({ plan, resolve, reject });
    dispatch();
  });
}
