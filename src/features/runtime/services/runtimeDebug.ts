export function runtimeDebug(message: string, data?: unknown) {
  console.log(`[Ctrl-CC Runtime] ${message}`, data ?? '');
}

export function runtimeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
