/**
 * Tenure — how long an incumbent has been on the team, in completed whole months.
 *
 * Tenure is what separates a compression finding from a list of people who
 * happen to earn less. Someone hired inside the last twelve months has not been
 * through a merit cycle, so their salary is a MARKET-set number, set by the same
 * market that is setting this offer. Comparing two market-set numbers and calling
 * the difference compression is a category error — both are correct, they were
 * priced on different days. See docs/SPEC.md section 7.4.
 *
 * `completedMonthsBetween` is copied unchanged from Merit Lab's proration.ts,
 * with its tests, per SPEC section 4.
 */

/**
 * Completed whole months between two ISO dates (yyyy-mm-dd).
 *
 * "Completed" means the day-of-month has been reached: 15 Jan to 14 Feb is zero
 * completed months; 15 Jan to 15 Feb is one. Negative when the end precedes the
 * start. Returns null when either date is missing or unparseable.
 *
 * Whole months rather than days, deliberately. A month count can be verified by
 * hand; a day-count basis produces figures like 11.87 months that nobody checks.
 *
 * Known edge: a start on the 31st against an end in a shorter month (31 Jan to
 * 28 Feb) counts as zero completed months, not one. Rare, and preferred over a
 * rule that is harder to state.
 */
export function completedMonthsBetween(
  startDate: string | undefined,
  endDate: string | undefined,
): number | null {
  const start = parseIsoDate(startDate)
  const end = parseIsoDate(endDate)
  if (start === null || end === null) return null

  let months = (end.year - start.year) * 12 + (end.month - start.month)
  if (end.day < start.day) months -= 1

  return months
}

/**
 * An incumbent's tenure at the "as at" date, in completed whole months.
 *
 * Returns null when the hire date is missing or unparseable. A null is NOT zero:
 * "we do not know how long they have been here" and "they started today" lead to
 * opposite conclusions, and the tool must never silently pick one. A null tenure
 * is reported on screen as "tenure unknown" and never flags.
 *
 * A hire date in the future returns a negative number rather than being clamped,
 * so the importer can reject it visibly instead of it arriving here as a zero.
 */
export function calculateTenureMonths(
  hireDate: string | undefined,
  asAtDate: string,
): number | null {
  return completedMonthsBetween(hireDate, asAtDate)
}

/**
 * Whether an incumbent's tenure qualifies them to be flagged.
 *
 * Unknown tenure never qualifies. Neither does tenure below the gate. Both are
 * counted and shown separately, because a gate that shrinks the population
 * invisibly is how a tool starts lying. See SPEC section 7.4.
 */
export function isTenureQualified(
  tenureMonths: number | null,
  tenureQualifyingMonths: number,
): boolean {
  if (tenureMonths === null) return false
  return tenureMonths >= tenureQualifyingMonths
}

/**
 * The date tenure is measured to: the offer's start date when it has one,
 * otherwise today. Kept here so the choice is made in one place and the callers
 * stay pure — every function below takes the resolved date as a plain string.
 */
export function resolveAsAtDate(
  offerStartDate: string | undefined,
  today: string,
): string {
  return offerStartDate && parseIsoDate(offerStartDate) !== null
    ? offerStartDate
    : today
}

/** Today as yyyy-mm-dd in the viewer's own timezone, not UTC. */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface ParsedDate {
  year: number
  month: number
  day: number
}

/** Strict yyyy-mm-dd parse. No timezone involvement — these are calendar dates. */
function parseIsoDate(value: string | undefined): ParsedDate | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  return { year, month, day }
}
