/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Central MCP Tool Bootstrapper
 *
 * Registers all core governed tools into the provided or global MCP registry.
 */

import { McpRegistry, globalMcpRegistry } from '../registry';
import {
  memoryRecallTool,
  memoryRememberTool,
  memoryResolveConflictTool,
  memoryGetHealthTool,
} from './memory-tools';
import { contextBuildTool, contextGetDossierTool } from './context-tools';
import { crmGetEntityTool, crmSearchEntitiesTool } from './crm-tools';
import { dealGetTool, dealListTool, dealUpdateStageTool, dealTransferTool, dealPreviewTransferTool } from './deal-tools';
import { taskListTool, taskCreateTool } from './task-tools';
import {
  messagingGetConversationThreadTool,
  messagingSuggestReplyTool,
} from './messaging-conversation-tools';

export const ALL_CORE_MCP_TOOLS = [
  memoryRecallTool,
  memoryRememberTool,
  memoryResolveConflictTool,
  memoryGetHealthTool,
  contextBuildTool,
  contextGetDossierTool,
  crmGetEntityTool,
  crmSearchEntitiesTool,
  dealGetTool,
  dealListTool,
  dealUpdateStageTool,
  dealTransferTool,
  dealPreviewTransferTool,
  taskListTool,
  taskCreateTool,
  messagingGetConversationThreadTool,
  messagingSuggestReplyTool,
] as const;

/**
 * Registers all standard CompanyBrain tools into the specified registry.
 * Safely skips tools that have already been registered.
 */
export function registerAllCoreTools(registry: McpRegistry = globalMcpRegistry): void {
  for (const tool of ALL_CORE_MCP_TOOLS) {
    if (!registry.hasTool(tool.name)) {
      registry.registerTool(
        tool as unknown as Parameters<typeof registry.registerTool>[0],
        { allowOverride: true }
      );
    }
  }
}

// Auto-register into the global singleton on import
registerAllCoreTools(globalMcpRegistry);
