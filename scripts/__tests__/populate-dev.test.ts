import { describe, expect, it } from 'bun:test';

import { deriveDevPort, resolveApiRoot } from '../populate-dev';

describe('resolveApiRoot', () => {
  it('uses the worktree-derived port by default', () => {
    const cwd = '/workspace/modelmux-review';

    expect(resolveApiRoot({}, cwd)).toBe(`http://localhost:${deriveDevPort(cwd, 'dev')}`);
  });

  it.each([
    ['modelmux.example.com', 'http://modelmux.example.com:8443'],
    ['localhost', 'http://localhost:8443'],
    ['https://modelmux.example.com', 'https://modelmux.example.com:8443'],
  ])('combines hostname %s with an explicit port', (configuredUrl, expected) => {
    expect(resolveApiRoot({ MODELMUX_URL: configuredUrl, MODELMUX_PORT: '8443' })).toBe(expected);
  });

  it('preserves the port already present in MODELMUX_URL', () => {
    expect(resolveApiRoot({ MODELMUX_URL: 'http://localhost:4000', MODELMUX_PORT: '8443' })).toBe(
      'http://localhost:4000'
    );
  });
});
