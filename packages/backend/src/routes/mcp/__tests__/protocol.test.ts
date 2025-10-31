import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from 'bun:test';

import * as mcpProxyService from '../../../services/mcp-proxy/mcp-proxy-service';
import { createModelMuxMcpTestFixture } from './modelmux-mcp-test-fixtures';

describe('ModelMux management MCP routes - protocol', () => {
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

  test('keeps other /mcp/:name gateway routes working', async () => {
    const response = await fixture.fastify.inject({
      method: 'POST',
      url: '/mcp/test-server',
      headers: {
        authorization: 'Bearer sk-valid-key',
        'content-type': 'application/json',
      },
      payload: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(mcpProxyService.proxyMcpRequest).toHaveBeenCalled();
  });

  test('reserves modelmux as an upstream MCP gateway server name', () => {
    expect(mcpProxyService.validateServerName('modelmux')).toBe(false);
    expect(mcpProxyService.getMcpServerConfig('modelmux')).toBeNull();
  });

  test('lists compact management tools', async () => {
    const response = await fixture.postModelMuxMcp(
      { method: 'tools/list', id: 1 },
      fixture.adminHeaders()
    );
    const body = fixture.parseJsonRpcResponse(response);

    expect(body.result.tools.map((tool: { name: string }) => tool.name)).toEqual(
      expect.arrayContaining([
        'modelmux_config',
        'modelmux_provider',
        'modelmux_pi_catalog',
        'modelmux_model_alias',
        'modelmux_key',
        'modelmux_quota',
        'modelmux_quota_checker',
        'modelmux_usage',
        'modelmux_debug',
        'modelmux_mcp_gateway',
        'modelmux_settings',
        'modelmux_system_logs',
        'modelmux_operations',
      ])
    );
  });

  test('ignores unsupported x-forwarded-proto values', async () => {
    const response = await fixture.postModelMuxMcp(
      { method: 'tools/list', id: 1 },
      { ...fixture.adminHeaders(), 'x-forwarded-proto': 'javascript' }
    );
    const body = fixture.parseJsonRpcResponse(response);

    expect(body.result.tools).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'modelmux_config' })])
    );
  });

  test('lists prompt resources and returns the management guide prompt', async () => {
    const listResponse = await fixture.postModelMuxMcp(
      { method: 'prompts/list', id: 1 },
      fixture.adminHeaders()
    );
    const listBody = fixture.parseJsonRpcResponse(listResponse);

    expect(listBody.result.prompts).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'modelmux_management_guide' })])
    );

    const getResponse = await fixture.postModelMuxMcp(
      {
        method: 'prompts/get',
        id: 2,
        params: { name: 'modelmux_management_guide' },
      },
      fixture.adminHeaders()
    );
    const getBody = fixture.parseJsonRpcResponse(getResponse);

    expect(getBody.result.messages[0].content.text).toContain('ModelMux is a unified API gateway');
    expect(getBody.result.messages[0].content.text).toContain('destructive: "acknowledged"');
  });
});
