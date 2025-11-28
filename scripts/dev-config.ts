/**
 * Lightweight utility to output dev server config values (port, db path, FRP URL)
 * so that shell scripts can source them.
 *
 * Usage:
 *   bun run dev:get:port        → prints the port number
 *   bun run dev:get:db_path     → prints the database URL/path
 *   bun run dev:get:frp-url     → prints the FRP URL
 */

import { tmpdir } from 'os';
import { basename, join } from 'path';

import { deriveDevPort } from './dev-port-allocator';
import {
  buildFrpcEndpoint,
  type FrpcEndpoint,
  getFrpcUrlFilePath,
  getRepositoryName,
  isFrpcAvailable,
} from './frpc';

const dirName = basename(process.cwd());
export const DEFAULT_DEV_TARGET = 'dev';

// --- Port (explicit PORT, otherwise derived from the worktree) ---
export function getPort(target = DEFAULT_DEV_TARGET): string {
  if (process.env.PORT) return process.env.PORT;

  return deriveDevPort(process.cwd(), target);
}

// --- DB path (same logic as dev.ts) ---
function getDbPath(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.MODELMUX_POSTGRES_DRIVER === 'pglite') {
    const dataDir =
      process.env.MODELMUX_PGLITE_DATA_DIR ?? join(tmpdir(), `modelmux-${dirName}.pglite`);
    return dataDir;
  }
  return `sqlite://${join(tmpdir(), `modelmux-${dirName}.db`)}`;
}

function getFrpEndpoint(): FrpcEndpoint {
  if (!process.env.FRPC_SERVER_ADDR || !process.env.FRPC_AUTH_TOKEN) {
    throw new Error('FRP is not configured: set FRPC_SERVER_ADDR and FRPC_AUTH_TOKEN.');
  }
  if (!isFrpcAvailable()) {
    throw new Error('FRP is not available: install frpc or add it to PATH.');
  }

  return buildFrpcEndpoint(
    getRepositoryName(process.cwd()),
    dirName,
    process.env.FRPC_SUBDOMAIN_HOST
  );
}

function printFrpEndpoint(args: string[]) {
  const urlFile = getFrpcUrlFilePath(dirName);
  if (args.includes('--file')) {
    console.log(urlFile);
    return;
  }

  const endpoint = getFrpEndpoint();
  const hostname = endpoint.url ? new URL(endpoint.url).hostname : undefined;

  if (args.includes('--json')) {
    console.log(JSON.stringify({ ...endpoint, hostname: hostname ?? null, urlFile }));
    return;
  }
  if (args.includes('--subdomain')) {
    console.log(endpoint.subdomain);
    return;
  }
  if (args.includes('--hostname')) {
    if (!hostname) throw new Error('FRPC_SUBDOMAIN_HOST is not set; cannot build the hostname.');
    console.log(hostname);
    return;
  }
  if (!endpoint.url) {
    throw new Error('FRPC_SUBDOMAIN_HOST is not set; use --subdomain or configure the host.');
  }
  console.log(endpoint.url);
}

// --- CLI ---
if (import.meta.main) {
  const command = process.argv[2];
  try {
    if (command === 'port') {
      console.log(getPort());
    } else if (command === 'db_path') {
      console.log(getDbPath());
    } else if (command === 'frp_url') {
      printFrpEndpoint(process.argv.slice(3));
    } else {
      throw new Error(
        'Usage: bun run scripts/dev-config.ts <port|db_path|frp_url> [--hostname|--subdomain|--json|--file]'
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
