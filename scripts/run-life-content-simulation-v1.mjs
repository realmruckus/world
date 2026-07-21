import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isMainThread, parentPort, workerData, Worker } from 'node:worker_threads';
import { runContractSimulation } from '../js/life-content-simulation-adapter-v1.js';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function addMap(target, source) {
  for (const [key, value] of Object.entries(source || {})) target[key] = (target[key] || 0) + value;
}

function mergeReports(reports, requestedLifeCount, seedStart) {
  const executedLifeCount = reports.reduce((sum, report) => sum + report.executedLifeCount, 0);
  const failedLifeCount = reports.reduce((sum, report) => sum + report.failedLifeCount, 0);
  const mapFields = [
    'endingDistribution', 'deathCauseDistribution', 'eventFrequency', 'careerDistribution',
    'relationshipStatusDistribution', 'relationshipPathDistribution', 'achievementFrequency',
  ];
  const simulationSummary = {};
  for (const field of mapFields) {
    simulationSummary[field] = {};
    for (const report of reports) addMap(simulationSummary[field], report.simulationSummary[field]);
  }
  const weightedFields = [
    'averageTurns', 'averageLifeScore', 'eventCoverageRate', 'repeatRate', 'romanceStallRate',
    'invalidChoiceRate', 'achievementUnlockRate',
  ];
  for (const field of weightedFields) {
    simulationSummary[field] = reports.reduce(
      (sum, report) => sum + Number(report.simulationSummary[field] || 0) * report.simulationSummary.lifeCount,
      0,
    ) / Math.max(1, reports.reduce((sum, report) => sum + report.simulationSummary.lifeCount, 0));
  }
  const metricIds = new Set(reports.flatMap((report) => Object.keys(report.simulationSummary.metricAverages || {})));
  simulationSummary.metricAverages = Object.fromEntries([...metricIds].sort().map((id) => [id, Math.round(
    reports.reduce((sum, report) => sum + Number(report.simulationSummary.metricAverages[id] || 0) * report.simulationSummary.lifeCount, 0)
      / Math.max(1, reports.reduce((sum, report) => sum + report.simulationSummary.lifeCount, 0)),
  )]));
  simulationSummary.lifeCount = reports.reduce((sum, report) => sum + report.simulationSummary.lifeCount, 0);
  simulationSummary.uniqueEventCount = Object.keys(simulationSummary.eventFrequency).length;

  const ageBandEventCoverage = {};
  for (const report of reports) {
    for (const [id, coverage] of Object.entries(report.ageBandEventCoverage)) {
      const target = ageBandEventCoverage[id] ||= { declaredEventCount: 0, observedUniqueEventCount: 0, observedOccurrenceCount: 0 };
      target.declaredEventCount = Math.max(target.declaredEventCount, coverage.declaredEventCount);
      target.observedUniqueEventCount = Math.max(target.observedUniqueEventCount, coverage.observedUniqueEventCount);
      target.observedOccurrenceCount += coverage.observedOccurrenceCount;
    }
  }
  const errorSummary = {};
  for (const report of reports) addMap(errorSummary, report.errorSummary);
  return {
    schemaVersion: 1,
    status: failedLifeCount === 0 ? 'completed' : 'completed_with_errors',
    requestedLifeCount,
    executedLifeCount,
    failedLifeCount,
    seed: { strategy: 'consecutive_integer', start: seedStart, end: seedStart + requestedLifeCount - 1 },
    policyVersion: reports[0].policyVersion,
    contentVersion: reports[0].contentVersion,
    contractVersion: reports[0].contractVersion,
    ageBandEventCoverage,
    relationshipPathDistribution: simulationSummary.relationshipPathDistribution,
    endingDistribution: simulationSummary.endingDistribution,
    errorSummary,
    simulationSummary,
  };
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
  return mergeReports(await Promise.all(jobs), requestedLifeCount, seedStart);
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
