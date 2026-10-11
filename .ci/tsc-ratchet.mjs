/* eslint-disable no-undef */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(projectRoot, '.ci', 'tsc-baseline.txt');

if (!fs.existsSync(baselinePath)) {
  console.error(`[ratchet-tsc] Error: Baseline file not found at ${baselinePath}`);
  process.exit(1);
}

const baselineRaw = fs.readFileSync(baselinePath, 'utf8').trim();
const baseline = parseInt(baselineRaw, 10);
if (Number.isNaN(baseline)) {
  console.error(`[ratchet-tsc] Error: Invalid baseline number in ${baselinePath}: "${baselineRaw}"`);
  process.exit(1);
}

console.log(`[ratchet-tsc] Running tsc --noEmit (baseline: ${baseline})...`);

const tscBin = path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');
let result;

if (fs.existsSync(tscBin)) {
  result = spawnSync(process.execPath, [tscBin, '--noEmit'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
} else {
  result = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 10 * 1024 * 1024,
  });
}

const stdout = result.stdout || '';
const stderr = result.stderr || '';
const combined = `${stdout}\n${stderr}`.trim();

if (combined) {
  console.log(combined);
}

const errorLines = combined
  .split(/\r?\n/)
  .filter((line) => line.includes('error TS'));
const errorCount = errorLines.length;

console.log('\n----------------------------------------');
console.log(`[ratchet-tsc] TypeScript errors found: ${errorCount} (baseline: ${baseline})`);

if (errorCount > baseline) {
  console.error(
    `[ratchet-tsc] ❌ FAILED: Found ${errorCount} errors, which exceeds the baseline of ${baseline}.`
  );
  console.error(
    `[ratchet-tsc] Please fix any newly introduced type errors before committing.`
  );
  process.exit(1);
}

if (errorCount < baseline) {
  console.log(
    `[ratchet-tsc] ⚠️ NOTICE: TypeScript errors decreased from ${baseline} to ${errorCount}!`
  );
  console.log(
    `[ratchet-tsc] Please consider updating .ci/tsc-baseline.txt to ${errorCount} to lock in this improvement.`
  );
  process.exit(0);
}

console.log(
  `[ratchet-tsc] ✅ PASSED: Errors (${errorCount}) match baseline (${baseline}).`
);
process.exit(0);
