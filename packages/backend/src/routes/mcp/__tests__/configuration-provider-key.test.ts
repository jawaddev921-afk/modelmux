import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from 'bun:test';

import { createModelMuxMcpTestFixture } from './modelmux-mcp-test-fixtures';

describe('ModelMux management MCP routes - configuration, provider, and key', () => {
  const fixture = createModelMuxMcpTestFixture();

  beforeAll(async () => {
    await fixture.start();
  });

  beforeEach(() => {
    fixture.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await fixture.close();
  });

  test('uses management routes for config status and quota checker operations', async () => {
    const configResponse = await fixture.postModelMuxMcp(
      {
        method: 'tools/call',
        id: 1,
        params: { name: 'modelmux_config', arguments: { operation: 'status' } },
      },
      fixture.adminHeaders()
    );
    const quotaResponse = await fixture.postModelMuxMcp(
      {
        method: 'tools/call',
        id: 2,
        params: { name: 'modelmux_quota_checker', arguments: { operation: 'get', id: 'checker' } },
      },
      fixture.adminHeaders()
    );

    expect(
      fixture.parseJsonRpcResponse(configResponse).result.structuredContent.data
    ).toMatchObject({
      providerCount: 1,
    });
    expect(fixture.parseJsonRpcResponse(quotaResponse).result.structuredContent.data).toMatchObject(
      {
        checkerId: 'checker',
      }
    );
    expect(fixture.fastify.inject).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/v0/management/config/status' })
    );
    expect(fixture.fastify.inject).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/v0/management/quotas/checker' })
    );
  });

  test('returns redacted provider data from tool calls', async () => {
    const response = await fixture.postModelMuxMcp(
      {
        method: 'tools/call',
        id: 1,
        params: {
          name: 'modelmux_provider',
          arguments: { operation: 'get', id: 'openrouter' },
        },
      },
      fixture.adminHeaders()
    );
    const body = fixture.parseJsonRpcResponse(response);

    expect(body.result.structuredContent.ok).toBe(true);
    expect(body.result.structuredContent.data.api_key).toBe('[REDACTED]');
    expect(body.result.structuredContent.data.headers.Authorization).toBe('[REDACTED]');
    expect(JSON.stringify(body.result)).not.toContain('provider-secret');
    expect(JSON.stringify(body.result)).not.toContain('upstream-secret');
  });

  test('returns redacted key data from tool calls', async () => {
    const response = await fixture.postModelMuxMcp(
      {
        method: 'tools/call',
        id: 1,
        params: {
          name: 'modelmux_key',
          arguments: { operation: 'get', id: 'test-key' },
        },
      },
      fixture.adminHeaders()
    );
    const body = fixture.parseJsonRpcResponse(response);

    expect(body.result.structuredContent.ok).toBe(true);
    expect(body.result.structuredContent.data.secret).toBe('[REDACTED]');
    expect(JSON.stringify(body.result)).not.toContain('sk-valid-key');
  });

  test('sends update PATCHes in merge mode so callers can send only the delta', async () => {
    const response = await fixture.postModelMuxMcp(
      {
        method: 'tools/call',
        id: 1,
        params: {
          name: 'modelmux_provider',
          arguments: {
            operation: 'update',
            id: 'openrouter',
            body: { models: { 'new-model': {} } },
          },
        },
      },
      fixture.adminHeaders()
    );
    expect(fixture.parseJsonRpcResponse(response).result.structuredContent.ok).toBe(true);

    // `?merge=deep` keeps the stored models map intact instead of replacing it,
    // so the caller never has to read and resend the existing models.
    expect(fixture.fastify.inject).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PATCH',
        url: '/v0/management/providers/openrouter?merge=deep',
        payload: { models: { 'new-model': {} } },
      })
    );
  });

  test('implements modelmux_key update through the management shim', async () => {
    const updateResponse = await fixture.postModelMuxMcp(
      {
        method: 'tools/call',
        id: 1,
        params: {
          name: 'modelmux_key',
          arguments: {
            operation: 'update',
            id: 'test-key',
            body: { beta: true },
          },
        },
      },
      fixture.adminHeaders()
    );
    const updateBody = fixture.parseJsonRpcResponse(updateResponse);
    expect(updateBody.result.structuredContent.ok).toBe(true);

    const getResponse = await fixture.postModelMuxMcp(
      {
        method: 'tools/call',
        id: 2,
        params: {
          name: 'modelmux_key',
          arguments: { operation: 'get', id: 'test-key' },
        },
      },
      fixture.adminHeaders()
    );
    const getBody = fixture.parseJsonRpcResponse(getResponse);
    expect(getBody.result.structuredContent.data.beta).toBe(true);
  });
});
