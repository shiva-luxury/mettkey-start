/**
 * Optimal posting slots in Pacific time, per the posting plan:
 *   Tue / Wed / Thu : 7am, 12pm, 6pm PT
 *   Mon / Fri       : 12pm, 6pm PT
 *   Sat / Sun       : 10am PT
 *
 * Pacific wall-clock times are converted to real instants with Intl, so daylight saving
 * (PST/PDT) is handled without a timezone library.
 */

const PT = 'America/Los_Angeles'

/** Hours (24h, Pacific) for each weekday index: 0 = Sunday … 6 = Saturday. */
const HOURS_BY_WEEKDAY: Record<number, number[]> = {
  0: [10], // Sunday
  1: [12, 18], // Monday
  2: [7, 12, 18], // Tuesday
  3: [7, 12, 18], // Wednesday
  4: [7, 12, 18], // Thursday
  5: [12, 18], // Friday
  6: [10], // Saturday
}

type PTParts = { y: number; m: number; d: number; h: number; min: number }

function ptPartsOf(date: Date): PTParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PT,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') }
}

/** Converts a Pacific wall-clock time on a given calendar date to the real UTC instant. */
export function pacificToDate(y: number, m: number, d: number, h: number, min: number): Date {
  const asIfUtc = Date.UTC(y, m - 1, d, h, min)
  const seen = ptPartsOf(new Date(asIfUtc))
  const seenAsUtc = Date.UTC(seen.y, seen.m - 1, seen.d, seen.h, seen.min)
  const offsetMs = seenAsUtc - asIfUtc
  return new Date(asIfUtc - offsetMs)
}

/** Day of week for a Pacific calendar date (0 = Sunday). */
function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * The next `count` free posting slots strictly after `from` (plus a 15-minute buffer so we never
 * schedule into the past), skipping any instant in `taken`. Returned in chronological order.
 */
export function nextPostingSlots(count: number, taken: Set<number>, from: Date = new Date()): Date[] {
  const earliest = from.getTime() + 15 * 60 * 1000
  const today = ptPartsOf(from)
  const slots: Date[] = []

  // Walk forward one Pacific calendar day at a time until we have enough slots (max ~8 weeks).
  const cursor = new Date(Date.UTC(today.y, today.m - 1, today.d))
  for (let dayOffset = 0; dayOffset < 60 && slots.length < count; dayOffset++) {
    const day = new Date(cursor.getTime() + dayOffset * 24 * 60 * 60 * 1000)
    const y = day.getUTCFullYear()
    const m = day.getUTCMonth() + 1
    const d = day.getUTCDate()

    for (const h of HOURS_BY_WEEKDAY[weekdayOf(y, m, d)]) {
      const slot = pacificToDate(y, m, d, h, 0)
      if (slot.getTime() < earliest) continue
      if (taken.has(slot.getTime())) continue
      slots.push(slot)
      if (slots.length === count) break
    }
  }
  return slots
}

/** Human-readable Pacific time, e.g. "Tue Nov 3, 7:00 AM PT". */
export function formatPT(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: PT,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' PT'
}
