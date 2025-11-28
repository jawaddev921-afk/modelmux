import { afterEach, describe, expect, it, test } from 'bun:test';
import { readFileSync } from 'fs';

import {
  buildFrpcArgs,
  buildFrpcEndpoint,
  buildFrpcSubdomain,
  buildFrpcUrl,
  getFrpcUrlFilePath,
  removeFrpcUrlFile,
  repositoryNameFromRemote,
  sanitizeDnsLabel,
  writeFrpcUrlFile,
} from '../frpc';

const TEST_WORKTREE_NAME = `frpc-test-${process.pid}`;

afterEach(() => {
  removeFrpcUrlFile(TEST_WORKTREE_NAME);
});

describe('frpc helpers', () => {
  it('extracts repository names from common git remote formats', () => {
    expect(repositoryNameFromRemote('https://github.com/jawaddev921-afk/modelmux.git')).toBe('modelmux');
    expect(repositoryNameFromRemote('git@github.com:jawaddev921-afk/modelmux.git')).toBe('modelmux');
  });

  it('creates a DNS-safe deterministic subdomain from repo and worktree names', () => {
    const subdomain = buildFrpcSubdomain('ModelMux', 'feature/auth login');

    expect(subdomain).toBe('modelmux-feature-auth-login');
    expect(subdomain).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
    expect(buildFrpcSubdomain('ModelMux', 'feature/auth login')).toBe(subdomain);
  });

  it('keeps long subdomains within the DNS label limit', () => {
    const subdomain = buildFrpcSubdomain('modelmux', 'a'.repeat(100));

    expect(subdomain.length).toBeLessThanOrEqual(63);
    expect(subdomain).toMatch(/-[a-f0-9]{8}$/);
  });

  it('builds the CLI-only HTTP proxy arguments', () => {
    expect(
      buildFrpcArgs({
        serverAddr: '192.168.0.2',
        serverPort: 7000,
        token: 'secret',
        proxyName: 'modelmux-worktree',
        localPort: 12345,
        subdomain: 'modelmux-worktree',
      })
    ).toEqual([
      'http',
      '--server-addr',
      '192.168.0.2',
      '--server-port',
      '7000',
      '--token',
      'secret',
      '--proxy-name',
      'modelmux-worktree',
      '--local-ip',
      '127.0.0.1',
      '--local-port',
      '12345',
      '--sd',
      'modelmux-worktree',
    ]);
  });

  it('uses a fallback for labels that contain no DNS-safe characters', () => {
    expect(sanitizeDnsLabel('---', 'fallback')).toBe('fallback');
  });

  it('builds a full URL only when the optional host is configured', () => {
    expect(buildFrpcUrl('modelmux-worktree', 'dev.example.com')).toBe(
      'https://modelmux-worktree.dev.example.com'
    );
    expect(buildFrpcUrl('modelmux-worktree')).toBeUndefined();
  });

  it('builds the same endpoint used by the dev lifecycle', () => {
    expect(buildFrpcEndpoint('ModelMux', 'purple-turtle', 'dev.example.com')).toEqual({
      subdomain: 'modelmux-purple-turtle',
      url: 'https://modelmux-purple-turtle.dev.example.com',
    });
  });

  it('writes and removes the URL file for later tools', () => {
    const url = 'https://modelmux-purple-turtle.dev.example.com';
    const filePath = getFrpcUrlFilePath(TEST_WORKTREE_NAME);

    writeFrpcUrlFile(url, TEST_WORKTREE_NAME);
    expect(readFileSync(filePath, 'utf8')).toBe(`${url}\n`);

    removeFrpcUrlFile(TEST_WORKTREE_NAME);
    expect(() => readFileSync(filePath, 'utf8')).toThrow();
  });
});
