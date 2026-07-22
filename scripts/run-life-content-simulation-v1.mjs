import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isMainThread, parentPort, workerData, Worker } from 'node:worker_threads';
import { mergeSimulationReports, runContractSimulation } from '../js/life-content-simulation-adapter-v1.js';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function runParallel(requestedLifeCount, seedStart, workerCount) {
  if (workerCount === 1) return runContractSimulation({ requestedLifeCount, seedStart });
  const baseCount = Math.floor(requestedLifeCount / workerCount);
  const remainder = requestedLifeCount % workerCount;
  let offset = 0;
  const jobs = [];
  for (let index = 0; index < workerCount; index += 1) {
    const count = baseCount + (index < remainder ? 1 : 0);
    if (!count) continue;
    const data = { requestedLifeCount: count, seedStart: seedStart + offset };
    offset += count;
    jobs.push(new Promise((resolveJob, rejectJob) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: data });
      worker.once('message', resolveJob);
      worker.once('error', rejectJob);
      worker.once('exit', (code) => { if (code !== 0) rejectJob(new Error(`Simulation worker exited ${code}`)); });
    }));
  }
  return mergeSimulationReports(await Promise.all(jobs), requestedLifeCount, seedStart);
}

async function main() {
  const requestedLifeCount = Number(option('--count', '10000'));
  const seedStart = Number(option('--seed-start', '119000'));
  const workerCount = Math.max(1, Number(option('--workers', '1')));
  const output = resolve(option('--output', 'reports/life-content-simulation-10000-v1.json'));
  const report = await runParallel(requestedLifeCount, seedStart, workerCount);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    output,
    workerCount,
    status: report.status,
    requestedLifeCount: report.requestedLifeCount,
    executedLifeCount: report.executedLifeCount,
    failedLifeCount: report.failedLifeCount,
  }));

  if (report.status !== 'completed' || report.failedLifeCount !== 0) process.exitCode = 1;
}

if (isMainThread) await main();
else parentPort.postMessage(runContractSimulation(workerData));
