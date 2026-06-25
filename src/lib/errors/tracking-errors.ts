export class TrackingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TrackingError';
  }
}

export class WebhookVerificationError extends TrackingError {
  constructor(message: string) {
    super('WEBHOOK_VERIFICATION_FAILED', message);
  }
}

export class OutOfOrderStateError extends TrackingError {
  constructor(message: string, details: Record<string, unknown>) {
    super('OUT_OF_ORDER_STATE', message, details);
  }
}

export class ResendJobSchedulingError extends TrackingError {
  constructor(message: string, details: Record<string, unknown>) {
    super('RESEND_SCHEDULING_FAILED', message, details);
  }
}
