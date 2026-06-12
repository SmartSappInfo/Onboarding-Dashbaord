type AutomationLogContext = {
  automationId?: string;
  automationName?: string;
  runId?: string;
  workspaceId?: string;
  entityId?: string;
  nodeId?: string;
  nodeType?: string;
  actionType?: string;
  jobId?: string;
  trigger?: string;
  processed?: number;
  campaignId?: string;
  error?: unknown;
  [key: string]: any;
};

function serializeError(error: unknown): { errorMessage?: string; errorStack?: string } {
  if (!error) return {};
  if (error instanceof Error) {
    return { errorMessage: error.message, errorStack: error.stack };
  }
  return { errorMessage: String(error) };
}

/**
 * Structured automation engine logs for observability / alerting.
 */
export function logAutomationEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: AutomationLogContext = {}
): void {
  const { error, ...rest } = context;
  const payload = {
    scope: 'automation_engine',
    level,
    message,
    ...rest,
    ...serializeError(error),
    ts: new Date().toISOString(),
  };

  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
