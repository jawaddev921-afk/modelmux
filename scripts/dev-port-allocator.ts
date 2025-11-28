#!/usr/bin/env bun
/**
 * dev-port-allocator.ts
 *
 * Port allocator used by the ModelMux dev server scripts to give every worktree a
 * consistent, collision-free port.
 *
 * Usage:
 *   bun run scripts/dev-port-allocator.ts [serviceName] [workspaceId] [branchName] [worktreePath]
 */

import { basename } from 'path';

/**
 * Derives a stable, deterministic TCP port number (10000-19999) based on the
 * worktree directory name and optional service script name.
 */
export function deriveDevPort(cwd = process.cwd(), scriptName = ''): string {
  if (process.env.PORT) return process.env.PORT;
  const key = scriptName ? `${basename(cwd)}:${scriptName}` : basename(cwd);
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  return String(10000 + (Math.abs(hash) % 10000));
}

if (import.meta.main) {
  // Positional args: [scriptName, workspaceId, branchName, worktreePath]
  const scriptName = process.argv.length >= 3 ? process.argv[2] : '';
  const worktreePath = (process.argv.length >= 6 ? process.argv[5] : undefined) || process.cwd();

  const port = deriveDevPort(worktreePath, scriptName);
  console.log(port);
}
