import { getConfig } from '../../../config';
import { logger } from '../../../utils/logger';
import {
  handleConfigTool,
  handleKeyTool,
  handleModelAliasTool,
  handlePiCatalogTool,
  handleProviderTool,
  handleQuotaCheckerTool,
  handleQuotaTool,
  handleSettingsTool,
} from './configuration';
import {
  handleDebugTool,
  handleMcpGatewayTool,
  handleOperationsTool,
  handleSystemLogsTool,
  handleUsageTool,
} from './operations';
import { errorResponse } from './responses';
import { DESTRUCTIVE_OPERATIONS, requireDestructiveAck } from './security';
import {
  type ManagementShimContext,
  McpToolError,
  type ModelMuxToolName,
  type ToolInput,
} from './types';

export async function handleToolCall(
  toolName: ModelMuxToolName,
  input: ToolInput,
  shimContext: ManagementShimContext
) {
  try {
    if (DESTRUCTIVE_OPERATIONS.has(input.operation)) {
      requireDestructiveAck(input);
    }

    getConfig();

    switch (toolName) {
      case 'modelmux_config':
        return await handleConfigTool(input, shimContext);
      case 'modelmux_provider':
        return await handleProviderTool(input, shimContext);
      case 'modelmux_pi_catalog':
        return await handlePiCatalogTool(input, shimContext);
      case 'modelmux_model_alias':
        return await handleModelAliasTool(input, shimContext);
      case 'modelmux_key':
        return await handleKeyTool(input, shimContext);
      case 'modelmux_quota':
        return await handleQuotaTool(input, shimContext);
      case 'modelmux_quota_checker':
        return await handleQuotaCheckerTool(input, shimContext);
      case 'modelmux_mcp_gateway':
        return await handleMcpGatewayTool(input, shimContext);
      case 'modelmux_settings':
        return await handleSettingsTool(input, shimContext);
      case 'modelmux_system_logs':
        return await handleSystemLogsTool(input, shimContext);
      case 'modelmux_usage':
        return await handleUsageTool(input, shimContext);
      case 'modelmux_debug':
        return await handleDebugTool(input, shimContext);
      case 'modelmux_operations':
        return await handleOperationsTool(input, shimContext);
    }
  } catch (error) {
    if (error instanceof McpToolError) {
      return errorResponse(input.operation, error.message, error.type, error.code);
    }
    logger.warn(`ModelMux MCP tool ${toolName} failed: ${(error as Error).message}`);
    return errorResponse(input.operation, 'ModelMux MCP tool call failed.', 'internal_error', 500);
  }
}
