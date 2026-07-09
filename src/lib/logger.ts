import crypto from "crypto";

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function logServerError(
  type: string,
  message: string,
  context?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level: "error",
    type,
    message,
    ...context,
  };

  console.error(JSON.stringify(entry));
}
