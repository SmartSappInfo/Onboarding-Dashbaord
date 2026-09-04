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
import { dealGetTool, dealUpdateStageTool } from './deal-tools';
import { taskListTool, taskCreateTool } from './task-tools';

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
  dealUpdateStageTool,
  taskListTool,
  taskCreateTool,
] as const;

/**
 * Registers all standard CompanyBrain tools into the specified registry.
 * Safely skips tools that have already been registered.
 */
export function registerAllCoreTools(registry: McpRegistry = globalMcpRegistry): void {
  for (const tool of ALL_CORE_MCP_TOOLS) {
    if (!registry.hasTool(tool.name)) {
      registry.registerTool(tool);
    }
  }
}

// Auto-register into the global singleton on import
registerAllCoreTools(globalMcpRegistry);
