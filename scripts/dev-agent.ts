/**
 * dev-agent.ts
 *
 * Agent & contributor launcher for ModelMux workspace scripts.
 *
 * Starts a workspace dev target as a background process, waits for it to become
 * healthy and streams its log.
 *
 * Features:
 *   - Target support (defaults to `dev:full`; any `dev*` package script works)
 *   - Idempotent: if target is already running, attaches to live logs
 *   - Tails the local log file (pass --detach to skip)
 *
 * Usage:
 *   bun run dev:agent [target]           # start/attach target & stream logs (default: dev:full)
 *   bun run dev:agent [target] --detach  # start detached and return after health check
 *   bun run dev:agent stop [target]      # stop background execution for target
 *   bun run dev:agent stop --all        # stop all background stacks for this worktree
 */

import { spawn } from 'child_process';
import { existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';

import { deriveDevPort } from './dev-port-allocator';
import { buildFrpcEndpoint, type FrpcEndpoint, getRepositoryName, isFrpcAvailable } from './frpc';

const dirName = basename(process.cwd());

const rawArgs = process.argv.slice(2);
const isStop = rawArgs[0] === 'stop';
const detach = rawArgs.includes('--detach') || rawArgs.includes('--no-wait');
const stopAll = isStop && rawArgs.includes('--all');

function sanitizeTarget(name?: string): string {
  if (!name || name.startsWith('--')) return 'dev:full';
  return name;
}

const targetName = isStop ? sanitizeTarget(rawArgs[1]) : sanitizeTarget(rawArgs[0]);

// One dev server per worktree: derive the same port regardless of which
// target (dev / dev:full / dev:pglite) is used to start it, matching
// dev.ts and dev-config.ts. An explicit PORT always takes precedence.
function derivePort(): string {
  if (process.env.PORT) return process.env.PORT;
  return deriveDevPort(process.cwd(), 'dev');
}

const PORT = derivePort();
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'password';
const CONSECUTIVE_OK = 3;
const READY_TIMEOUT_MS = 180_000;

function getPidFile(target: string): string {
  return join(tmpdir(), `modelmux-${target.replace(/[:/]/g, '_')}-${dirName}.pid`);
}

function getLogFile(target: string): string {
  return join(tmpdir(), `modelmux-dev-${target.replace(/[:/]/g, '_')}-${dirName}.log`);
}

function getFrpcEndpoint(): FrpcEndpoint | undefined {
  if (!process.env.FRPC_SERVER_ADDR || !process.env.FRPC_AUTH_TOKEN || !isFrpcAvailable()) {
    return undefined;
  }
  return buildFrpcEndpoint(
    getRepositoryName(process.cwd()),
    dirName,
    process.env.FRPC_SUBDOMAIN_HOST
  );
}

// Standard fallback PID file from previous dev-agent versions
const LEGACY_PID_FILE = join(tmpdir(), `modelmux-${dirName}.pid`);

async function isHealthy(port = PORT): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealthy(port = PORT, timeoutMs = READY_TIMEOUT_MS): Promise<boolean> {
  const start = Date.now();
  let ok = 0;
  while (Date.now() - start < timeoutMs) {
    if (await isHealthy(port)) {
      if (++ok >= CONSECUTIVE_OK) return true;
    } else {
      ok = 0;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function printReady(
  target: string,
  port: string | number,
  frpcEndpoint?: FrpcEndpoint,
  prefix = 'Ready.'
) {
  const baseUrl = `http://localhost:${port}`;
  const loginUrl = `${baseUrl}/ui/login?token=${encodeURIComponent(ADMIN_KEY)}`;
  console.log(`\n${prefix}`);
  console.log(`TARGET=${target}`);
  console.log(`PORT=${port}`);
  console.log(`ADMIN_KEY=${ADMIN_KEY}`);
  console.log(`URL=${loginUrl}`);
  if (frpcEndpoint) {
    console.log(`FRPC_SUBDOMAIN=${frpcEndpoint.subdomain}`);
    if (frpcEndpoint.url) {
      console.log(`PROXY_URL=${frpcEndpoint.url}`);
    }
  }
}

// --- STOP ACTION ---

if (isStop) {
  let stoppedAny = false;

  const pidFiles = stopAll ? [getPidFile(targetName), LEGACY_PID_FILE] : [getPidFile(targetName)];

  for (const pidFile of pidFiles) {
    if (existsSync(pidFile)) {
      try {
        const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          process.kill(pid, 'SIGTERM');
        }
        console.log(`Stopped standalone dev process for "${dirName}" (pid ${pid}).`);
        stoppedAny = true;
      } catch {
        console.log(`Cleaned stale pid file for "${dirName}".`);
      } finally {
        try {
          unlinkSync(pidFile);
        } catch {}
      }
    }
  }

  if (!stoppedAny) {
    console.log(`No running dev stack found for target "${targetName}" in "${dirName}".`);
  }
  process.exit(0);
}

// --- START / ATTACH ACTION ---

// Direct background process execution

const fallbackPort = PORT;
const pidFile = getPidFile(targetName);
const logFile = getLogFile(targetName);

if (await isHealthy(fallbackPort)) {
  printReady(
    targetName,
    fallbackPort,
    getFrpcEndpoint(),
    `Dev stack already running on port ${fallbackPort} — reusing it.`
  );
  if (detach) {
    process.exit(0);
  }

  if (existsSync(logFile)) {
    console.log(`\nAttaching to log output (${logFile}). Press Ctrl+C to detach.\n`);
    const tail = spawn('tail', ['-f', logFile], { stdio: 'inherit' });
    tail.on('exit', (code) => process.exit(code ?? 0));
    await new Promise(() => {});
  } else {
    process.exit(0);
  }
}

const logFd = openSync(logFile, 'a');

console.log(`Starting target "${targetName}": bun run ${targetName} --no-open`);
const childProcess = spawn('bun', ['run', targetName, '--no-open'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: fallbackPort, ADMIN_KEY },
  detached: true,
  stdio: ['ignore', logFd, logFd],
});

writeFileSync(pidFile, String(childProcess.pid));
childProcess.unref();

console.log(`Started "${targetName}" in background (logs: ${logFile})...`);

if (await waitForHealthy(fallbackPort)) {
  printReady(targetName, fallbackPort, getFrpcEndpoint(), `Target "${targetName}" ready.`);
  if (detach) {
    process.exit(0);
  }

  console.log(`\nAttaching to log output (${logFile}). Press Ctrl+C to detach.\n`);
  const tail = spawn('tail', ['-f', logFile], { stdio: 'inherit' });
  tail.on('exit', (code) => process.exit(code ?? 0));
  await new Promise(() => {});
} else {
  console.error(
    `Target "${targetName}" did not become healthy within ${READY_TIMEOUT_MS / 1000}s. Recent log:`
  );
  try {
    console.error(readFileSync(logFile, 'utf8').split('\n').slice(-25).join('\n'));
  } catch {}
  console.error(`\nInspect ${logFile} or stop with: bun run dev:stop ${targetName}`);
  process.exit(1);
}
