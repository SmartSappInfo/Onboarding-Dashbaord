import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // SECURITY (agents_mcp PR-2): refuse to start in production without the Cloud Tasks worker
    // secret (there is no built-in fallback any more). See src/lib/security/cloud-tasks-auth.ts.
    const { assertCloudTasksConfig } = await import("./lib/security/cloud-tasks-auth");
    assertCloudTasksConfig();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
