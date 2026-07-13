// Group B #16 (progress %) + #21 (SLA / aging). Pure helpers usable on client
// or server. Progress is derived from a status's position in its ordered
// status list; aging is derived from how long a case has sat at its current
// status (status_date).

const TERMINAL = new Set(["Application Approved", "Application Denied", "Discharged"]);

/** Percent complete based on the status's index within the ordered list. */
export function statusProgress(status: string | null | undefined, statuses: readonly string[]): number {
  if (!status) return 0;
  if (TERMINAL.has(status)) return 100;
  const idx = statuses.indexOf(status);
  if (idx < 0 || statuses.length <= 1) return 0;
  // Reserve the last slot for terminal; scale the rest 0–95%.
  return Math.round(((idx + 1) / statuses.length) * 95);
}

export function isTerminalStatus(status: string | null | undefined): boolean {
  return !!status && TERMINAL.has(status);
}

export type AgingSeverity = "ok" | "warn" | "stale";

/** Days since the status last changed, with a severity band. */
export function caseAging(
  statusDate: string | null | undefined,
  status?: string | null,
  opts: { warnDays?: number; staleDays?: number } = {},
): { days: number | null; severity: AgingSeverity } {
  if (isTerminalStatus(status) || !statusDate) return { days: null, severity: "ok" };
  const then = new Date(statusDate).getTime();
  if (Number.isNaN(then)) return { days: null, severity: "ok" };
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  const warn = opts.warnDays ?? 14;
  const stale = opts.staleDays ?? 30;
  const severity: AgingSeverity = days >= stale ? "stale" : days >= warn ? "warn" : "ok";
  return { days, severity };
}
