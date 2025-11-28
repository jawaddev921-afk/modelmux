import { afterEach, beforeEach, describe, expect, it, test } from 'bun:test';
import { execFileSync } from 'child_process';
import { join } from 'path';

import { deriveDevPort } from '../dev-port-allocator';

// deriveDevPort respects process.env.PORT, so scrub it for every test in
// this file — otherwise the expected values depend on the ambient
// environment.
const originalPort = process.env.PORT;

beforeEach(() => {
  delete process.env.PORT;
});

afterEach(() => {
  if (originalPort !== undefined) {
    process.env.PORT = originalPort;
  } else {
    delete process.env.PORT;
  }
});

describe('deriveDevPort', () => {
  it('derives a deterministic port within 10000-19999 range based on directory path', () => {
    const cwd = '/workspace/modelmux-worktree-a';
    const port = deriveDevPort(cwd);
    const num = Number(port);

    expect(num).toBeGreaterThanOrEqual(10000);
    expect(num).toBeLessThanOrEqual(19999);
    expect(deriveDevPort(cwd)).toBe(port);
  });

  it('respects process.env.PORT when set', () => {
    process.env.PORT = '4000';
    expect(deriveDevPort('/some/path')).toBe('4000');
  });
});

describe('dev-port-allocator executable', () => {
  const scriptPath = join(__dirname, '../dev-port-allocator.ts');

  // The child must not inherit PORT from the ambient environment — otherwise
  // the derived port depends on where the test itself runs.
  function childEnv(extra: Record<string, string> = {}): Record<string, string> {
    const { PORT: _port, ...rest } = process.env as Record<string, string>;
    return { ...rest, ...extra };
  }

  it('outputs derived port when executed directly', () => {
    const output = execFileSync(
      'bun',
      ['run', scriptPath, 'dev', 'wks_1', 'main', '/workspace/my-app'],
      {
        encoding: 'utf8',
        env: childEnv(),
      }
    ).trim();

    const expected = deriveDevPort('/workspace/my-app', 'dev');
    expect(output).toBe(expected);
  });
});
