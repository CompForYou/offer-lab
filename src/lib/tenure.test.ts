import { describe, it, expect } from 'vitest'
import {
  completedMonthsBetween,
  calculateTenureMonths,
  isTenureQualified,
  resolveAsAtDate,
  todayIso,
} from './tenure'

describe('completedMonthsBetween', () => {
  it('counts a whole month when the day-of-month is reached', () => {
    expect(completedMonthsBetween('2024-01-15', '2024-02-15')).toBe(1)
  })

  it('does not count a month the day before it completes', () => {
    expect(completedMonthsBetween('2024-01-15', '2024-02-14')).toBe(0)
  })

  it('counts a full year', () => {
    expect(completedMonthsBetween('2023-06-01', '2024-06-01')).toBe(12)
  })

  it('counts across a year boundary', () => {
    // Nov 2023 to Mar 2024: Dec, Jan, Feb, Mar = 4 completed months.
    expect(completedMonthsBetween('2023-11-10', '2024-03-10')).toBe(4)
  })

  it('returns a negative count when the end precedes the start', () => {
    expect(completedMonthsBetween('2024-06-01', '2024-03-01')).toBe(-3)
  })

  it('returns zero for the same date', () => {
    expect(completedMonthsBetween('2024-04-09', '2024-04-09')).toBe(0)
  })

  it('treats a 31st start against a shorter month as incomplete', () => {
    // The documented edge: 31 Jan to 28 Feb is zero, not one.
    expect(completedMonthsBetween('2024-01-31', '2024-02-28')).toBe(0)
  })

  it('returns null for a missing date rather than zero', () => {
    expect(completedMonthsBetween(undefined, '2024-06-01')).toBeNull()
    expect(completedMonthsBetween('2024-06-01', undefined)).toBeNull()
  })

  it('returns null for an unparseable date', () => {
    expect(completedMonthsBetween('01/06/2024', '2024-06-01')).toBeNull()
    expect(completedMonthsBetween('2024-13-01', '2024-06-01')).toBeNull()
    expect(completedMonthsBetween('2024-06-32', '2024-06-01')).toBeNull()
  })

  it('tolerates surrounding whitespace', () => {
    expect(completedMonthsBetween(' 2024-01-15 ', '2024-02-15')).toBe(1)
  })
})

describe('calculateTenureMonths', () => {
  it('measures tenure to the as-at date', () => {
    // Hired 1 Mar 2022, offer starts 1 Sep 2024: 30 completed months.
    expect(calculateTenureMonths('2022-03-01', '2024-09-01')).toBe(30)
  })

  it('returns null for a missing hire date, never zero', () => {
    // A null and a zero lead to opposite conclusions about the same person.
    expect(calculateTenureMonths(undefined, '2024-09-01')).toBeNull()
  })

  it('returns a negative figure for a future hire date rather than clamping', () => {
    expect(calculateTenureMonths('2025-01-01', '2024-09-01')).toBe(-4)
  })
})

describe('isTenureQualified', () => {
  it('qualifies at exactly the gate', () => {
    expect(isTenureQualified(12, 12)).toBe(true)
  })

  it('does not qualify one month short', () => {
    expect(isTenureQualified(11, 12)).toBe(false)
  })

  it('never qualifies unknown tenure', () => {
    expect(isTenureQualified(null, 12)).toBe(false)
  })

  it('never qualifies a future hire date', () => {
    expect(isTenureQualified(-4, 12)).toBe(false)
  })

  it('qualifies everyone when the gate is zero', () => {
    expect(isTenureQualified(0, 0)).toBe(true)
  })
})

describe('resolveAsAtDate', () => {
  it('prefers the offer start date', () => {
    expect(resolveAsAtDate('2024-09-01', '2024-06-15')).toBe('2024-09-01')
  })

  it('falls back to today when no start date is given', () => {
    expect(resolveAsAtDate(undefined, '2024-06-15')).toBe('2024-06-15')
  })

  it('falls back to today when the start date is unparseable', () => {
    expect(resolveAsAtDate('next Monday', '2024-06-15')).toBe('2024-06-15')
  })
})

describe('todayIso', () => {
  it('formats a date as yyyy-mm-dd with zero padding', () => {
    expect(todayIso(new Date(2024, 0, 5))).toBe('2024-01-05')
  })

  it('uses local calendar date, not UTC', () => {
    // 31 Dec 2024 at 23:00 local is 1 Jan 2025 in UTC east of Greenwich.
    // Tenure is a calendar question, so the local date is the right answer.
    expect(todayIso(new Date(2024, 11, 31, 23, 0, 0))).toBe('2024-12-31')
  })
})
