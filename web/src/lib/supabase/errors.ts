export function isMissingTableError(error: unknown, table: string): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  if (maybe.code !== "PGRST205") return false;
  if (!maybe.message) return false;
  return maybe.message.includes(`public.${table}`);
}

