import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { ConfigService } from '../../../services/configuration/config-service';
import { McpUsageStorageService } from '../../../services/mcp-proxy/mcp-usage-storage';
import {
  acceptBearerAdminKey,
  authenticate,
  ManagementAuthError,
  requireAdmin,
} from '../../management/_principal';
import { handleToolCall } from './dispatch';
import { createModelMuxMcpRequestContext, handleModelMuxMcpHttpRequest } from './http';
import { buildShimHeaders } from './management';
import { getToolDescription, MODELMUX_MANAGEMENT_PROMPT, TOOL_NAMES } from './metadata';
import { toToolResult } from './responses';
import { type ManagementShimContext, type ToolInput, ToolInputSchema } from './types';

export async function registerModelMuxMcpRoutes(
  fastify: FastifyInstance,
  mcpUsageStorage: McpUsageStorageService
) {
  fastify.register(async (modelmuxMcp) => {
    modelmuxMcp.setErrorHandler(async (error, _request, reply) => {
      if (error instanceof ManagementAuthError) {
        return reply.code(error.statusCode).send(error.authBody);
      }
      throw error;
    });

    // Reject early when the admin MCP is disabled (before auth, to avoid leaking key validity)
    modelmuxMcp.addHook('preHandler', (_request, reply, done) => {
      void (async () => {
        try {
          const configService = ConfigService.getInstance();
          const mcpEnabled = await configService.getSetting<boolean>('mcpEnabled', true);
          if (!mcpEnabled) {
            reply.code(418).send({
              error: {
                message: 'ModelMux Management MCP is disabled. Enable it on the MCP Servers page.',
                type: 'mcp_disabled',
              },
            });
            return;
          }
        } catch {
          // ConfigService not initialized — default to enabled
        }
        done();
      })().catch(done);
    });

    // MCP clients commonly can only configure a bearer token, so let
    // `Authorization: Bearer <ADMIN_KEY>` stand in for `x-admin-key`. The
    // credential is still resolved as an admin key; `requireAdmin` below is what
    // enforces that only the server's ADMIN_KEY may use this endpoint.
    modelmuxMcp.addHook('preHandler', (request, _reply, done) => {
      acceptBearerAdminKey(request);
      done();
    });

    modelmuxMcp.addHook('preHandler', authenticate);
    modelmuxMcp.addHook('preHandler', requireAdmin);

    modelmuxMcp.post('/mcp/modelmux', (request, reply) =>
      handleModelMuxMcpRequest(request, reply, mcpUsageStorage)
    );
    modelmuxMcp.get('/mcp/modelmux', (request, reply) =>
      handleModelMuxMcpRequest(request, reply, mcpUsageStorage)
    );
    modelmuxMcp.delete('/mcp/modelmux', (request, reply) =>
      handleModelMuxMcpRequest(request, reply, mcpUsageStorage)
    );
  });
}

async function handleModelMuxMcpRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  mcpUsageStorage: McpUsageStorageService
) {
  const requestContext = createModelMuxMcpRequestContext(request);
  const shimContext: ManagementShimContext = {
    fastify: reply.server,
    headers: buildShimHeaders(request),
  };

  // The SDK server owns one active transport at a time. A singleton would need
  // close/reconnect queueing, so stateless per-request servers are simpler and safer.
  const server = createModelMuxMcpServer(shimContext);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  try {
    return await handleModelMuxMcpHttpRequest(
      request,
      reply,
      mcpUsageStorage,
      transport,
      requestContext
    );
  } finally {
    await server.close();
  }
}

function createModelMuxMcpServer(shimContext: ManagementShimContext) {
  const server = new McpServer(
    {
      name: 'modelmux-management',
      version: '0.1.0',
    },
    {
      instructions: MODELMUX_MANAGEMENT_PROMPT,
    }
  );

  server.registerResource(
    'modelmux_management_guide',
    'modelmux://management/guide',
    {
      title: 'ModelMux Management Guide',
      description:
        'How to safely manage ModelMux routing, raw provider access, keys, quotas, and operations.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: MODELMUX_MANAGEMENT_PROMPT,
        },
      ],
    })
  );

  server.registerPrompt(
    'modelmux_management_guide',
    {
      title: 'ModelMux Management Guide',
      description:
        'Best practices for providers, raw passthrough, keys, quotas, and operations through MCP.',
    },
    async () => ({
      description: 'Use this guide before changing ModelMux routing or privileged raw access.',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: MODELMUX_MANAGEMENT_PROMPT,
          },
        },
      ],
    })
  );

  for (const toolName of TOOL_NAMES) {
    server.registerTool(
      toolName,
      {
        title: toolName,
        description: getToolDescription(toolName),
        inputSchema: ToolInputSchema,
      },
      async (input) => toToolResult(await handleToolCall(toolName, input as ToolInput, shimContext))
    );
  }

  return server;
}
