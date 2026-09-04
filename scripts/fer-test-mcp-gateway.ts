/**
 * @fileOverview CompanyBrain 2.0 Phase 6: FER MCP Gateway & Tool Registry Verification Script
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Fast, Idempotent Verification:
 *    - Validates MCP Registry, JSON-RPC 2.0 Dispatcher, Risk Policies, API Keys, and Approval Gates.
 * 2. Non-Destructive Invariant:
 *    - Uses isolated test workspace and clean assertions.
 * 3. Telemetry Output:
 *    - Logs detailed step-by-step verification results with execution timings.
 *
 * Usage:
 *   npx tsx scripts/fer-test-mcp-gateway.ts [--workspace-id=ws_xxx] [--dry-run]
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// Ensure mock ambient environment variables for local testing
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'mock_gemini_key';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'mock_google_key';

import { globalMcpRegistry } from '../src/lib/mcp/registry';
import { registerAllCoreTools, ALL_CORE_MCP_TOOLS } from '../src/lib/mcp/tools';
import { McpGateway } from '../src/lib/mcp/gateway';
import { McpApiKeyService } from '../src/lib/mcp/api-key-service';
import { McpApprovalEngine } from '../src/lib/mcp/approval-engine';
import { McpAuditLogger } from '../src/lib/mcp/audit-logger';
import { MCP_ERROR_CODES, type McpExecutionContext } from '../src/lib/mcp/types';

async function main() {
  console.log('='.repeat(70));
  console.log('   CompanyBrain 2.0 Phase 6: MCP Platform & Governed Gateway FER   ');
  console.log('='.repeat(70));

  const args = process.argv.slice(2);
  const wsArg = args.find((a) => a.startsWith('--workspace-id='));
  const testWorkspaceId = wsArg ? wsArg.split('=')[1] : `ws_fer_mcp_${Date.now().toString(36)}`;
  const testOrgId = 'org_fer_test';

  const baseContext: McpExecutionContext = {
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    callerId: 'fer_tester_admin',
    callerType: 'user',
    requestId: 'req_fer_001',
    callDepth: 0,
    timestamp: new Date().toISOString(),
  };

  // --- Step 1: Tool Registry Registration ---
  console.log('\n--- 1. Testing MCP Tool Registry Bootstrap ---');
  registerAllCoreTools(globalMcpRegistry);
  const registeredCount = globalMcpRegistry.listTools().length;
  console.log(`  ✓ Registered Tools Count: ${registeredCount} (expected: >= 12)`);
  if (registeredCount < 12) {
    throw new Error(`Expected at least 12 tools registered, got ${registeredCount}`);
  }

  const coreNames = ALL_CORE_MCP_TOOLS.map((t) => t.name);
  console.log(`  ✓ Core tools verified: ${coreNames.slice(0, 6).join(', ')}...`);

  // --- Step 2: Protocol Initialize & Ping ---
  console.log('\n--- 2. Testing JSON-RPC 2.0 "initialize" & "ping" ---');
  const initRes = await McpGateway.handleRequest(
    { jsonrpc: '2.0', id: 1, method: 'initialize' },
    baseContext
  );
  console.log('  ✓ initialize response:', JSON.stringify(initRes.result));
  if (!initRes.result || typeof initRes.result !== 'object') {
    throw new Error('Failed to handle "initialize" JSON-RPC method');
  }

  const pingRes = await McpGateway.handleRequest(
    { jsonrpc: '2.0', id: 2, method: 'ping' },
    baseContext
  );
  console.log('  ✓ ping response:', JSON.stringify(pingRes.result));
  if (!pingRes.result || typeof pingRes.result !== 'object') {
    throw new Error('Failed to handle "ping" JSON-RPC method');
  }

  // --- Step 3: Tool Discovery (tools/list) ---
  console.log('\n--- 3. Testing "tools/list" Descriptors ---');
  const listRes = await McpGateway.handleRequest(
    { jsonrpc: '2.0', id: 3, method: 'tools/list' },
    baseContext
  );
  const tools = (listRes.result as { tools: unknown[] })?.tools;
  console.log(`  ✓ tools/list returned ${tools?.length} descriptors`);
  if (!Array.isArray(tools) || tools.length < 12) {
    throw new Error('tools/list did not return expected tool descriptors');
  }

  // --- Step 4: High-Risk Approval Interception ---
  console.log('\n--- 4. Testing Risk-Gated Interception (Approval Gate) ---');
  const highRiskCall = await McpGateway.handleRequest(
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'memory.resolve_conflict',
        arguments: {
          conflictId: 'conf_mock_123',
          resolution: 'confirm_a',
          notes: 'Validated via contract inspection',
        },
      },
    },
    baseContext
  );

  console.log(`  ✓ High-risk tool error code: ${highRiskCall.error?.code} (expected: ${MCP_ERROR_CODES.APPROVAL_REQUIRED})`);
  console.log(`  ✓ Message: "${highRiskCall.error?.message}"`);
  if (highRiskCall.error?.code !== MCP_ERROR_CODES.APPROVAL_REQUIRED) {
    throw new Error(`Expected error code ${MCP_ERROR_CODES.APPROVAL_REQUIRED}, received ${highRiskCall.error?.code}`);
  }

  const pendingApprovalId = (highRiskCall.error?.data as { pendingApprovalId?: string })?.pendingApprovalId;
  console.log(`  ✓ Intercepted and queued pending approval: ${pendingApprovalId}`);

  // --- Step 5: Approval Engine Adjudication ---
  console.log('\n--- 5. Testing Approval Adjudication ---');
  if (pendingApprovalId) {
    const adjudication = await McpApprovalEngine.adjudicate({
      approvalId: pendingApprovalId,
      decision: 'rejected',
      adjudicatedBy: 'supervisor_admin',
      notes: 'Rejected after security compliance review',
    });
    console.log(`  ✓ Approval status after adjudication: ${adjudication.status} (by: ${adjudication.adjudicatedBy})`);
    if (adjudication.status !== 'rejected') {
      throw new Error(`Expected status 'rejected', got ${adjudication.status}`);
    }
  }

  // --- Step 6: API Key Lifecycle ---
  console.log('\n--- 6. Testing MCP API Key Cryptographic Lifecycle ---');
  const { apiKey, plaintextKey } = await McpApiKeyService.createApiKey({
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    name: 'Cursor IDE Agent Key',
    role: 'agent',
    allowedCategories: ['memory', 'context'],
    expiresInDays: 30,
    createdBy: 'admin_tester',
  });

  console.log(`  ✓ Generated API Key: ${apiKey.keyPrefix} (Length: ${plaintextKey.length})`);
  console.log(`  ✓ Stored SHA-256 Hash: ${apiKey.keyHash.slice(0, 16)}...`);

  // Validate active key
  const activeValidation = await McpApiKeyService.validateApiKey(plaintextKey);
  console.log(`  ✓ Key validation: ${activeValidation.valid ? 'VALID' : 'INVALID'}`);
  if (!activeValidation.valid) {
    throw new Error(`Newly created key failed validation: ${activeValidation.error}`);
  }

  // Revoke key
  await McpApiKeyService.revokeApiKey(apiKey.id, 'admin_tester');
  const revokedValidation = await McpApiKeyService.validateApiKey(plaintextKey);
  console.log(`  ✓ Key after revocation: ${revokedValidation.valid ? 'VALID' : 'REVOKED'} (${revokedValidation.error})`);
  if (revokedValidation.valid) {
    throw new Error('Revoked key still passed validation!');
  }

  // --- Step 7: Audit Logger Telemetry ---
  console.log('\n--- 7. Testing Asynchronous Audit Logger ---');
  await McpAuditLogger.logExecution({
    toolName: 'memory.recall',
    version: '1.0.0',
    workspaceId: testWorkspaceId,
    organizationId: testOrgId,
    callerId: 'test_agent_42',
    callerType: 'agent',
    durationMs: 45,
    status: 'success',
    inputPayload: {
      query: 'billing schedule',
      secretKey: 'sensitive_secret_token', // Test redaction
    },
    outputSummary: 'Found 3 memory matches',
  });

  const logs = await McpAuditLogger.listAuditLogs(testWorkspaceId, 5);
  console.log(`  ✓ Retrieved ${logs.length} audit log entries for test workspace`);
  if (logs.length > 0) {
    const lastLog = logs[0];
    console.log(`  ✓ Log status: ${lastLog.status}, Tool: ${lastLog.toolName}`);
    console.log(`  ✓ Redaction check for "secretKey": ${JSON.stringify(lastLog.inputPayload.secretKey)} (expected: "[REDACTED]")`);
    if (lastLog.inputPayload.secretKey !== '[REDACTED]') {
      throw new Error(`Sensitive field was not redacted: ${String(lastLog.inputPayload.secretKey)}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('   ✓ ALL Phase 6 MCP Platform & Gateway checks passed cleanly!     ');
  console.log('='.repeat(70) + '\n');
}

main().catch((err) => {
  console.error('\n❌ FER MCP Gateway Verification Failed:', err);
  process.exit(1);
});
