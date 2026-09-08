import { describe, it, expect } from 'vitest'
import { findVerticalCompression } from './vertical-compression'
import { buildIncumbentViews } from './incumbent-view'
import { AS_AT, G3, G4, GRADES, OFFER, SETTINGS, TEAM } from './test-fixtures'
import type { Incumbent, Offer } from '../types/domain'

function verticalFor(
  offer: Offer = OFFER,
  incumbents: Incumbent[] = TEAM,
  grades = GRADES,
  offerFte: number | null = 100_000,
) {
  const views = buildIncumbentViews(incumbents, grades, offer, SETTINGS, AS_AT)
  return findVerticalCompression(views, offer, grades, offerFte, SETTINGS)
}

describe('findVerticalCompression', () => {
  it('uses the named manager when the offer has one', () => {
    const result = verticalFor()

    expect(result.source).toBe('manager')
    expect(result.comparatorId).toBe('E10')
    expect(result.comparatorFteSalary).toBe(130_000)
    // (130,000 - 100,000) / 100,000 = 0.30, comfortably above the 15% wanted.
    expect(result.verticalGap).toBeCloseTo(0.3, 10)
    expect(result.flagged).toBe(false)
  })

  it('flags a manager differential below the threshold', () => {
    // A 112,000 manager against a 100,000 offer is a 12% differential.
    const thin = TEAM.map((person) =>
      person.id === 'E10' ? { ...person, baseSalary: 112_000 } : person,
    )
    const result = verticalFor(OFFER, thin)

    expect(result.verticalGap).toBeCloseTo(0.12, 10)
    expect(result.flagged).toBe(true)
    expect(result.offerExceedsComparator).toBe(false)
  })

  it('reports an offer that exceeds the level above in its own right', () => {
    const inverted = TEAM.map((person) =>
      person.id === 'E10' ? { ...person, baseSalary: 94_000 } : person,
    )
    const result = verticalFor(OFFER, inverted)

    expect(result.verticalGap).toBeCloseTo(-0.06, 10)
    expect(result.flagged).toBe(true)
    expect(result.offerExceedsComparator).toBe(true)
  })

  it('falls back to the median of the grade above, and says so', () => {
    const { managerId: _managerId, ...withoutManager } = OFFER
    const result = verticalFor(withoutManager as Offer)

    // G5 holds E9 at 97,000 and E10 at 130,000. Median 113,500.
    expect(result.source).toBe('gradeAboveMedian')
    expect(result.comparatorGradeId).toBe('G5')
    expect(result.comparatorHeadcount).toBe(2)
    expect(result.comparatorFteSalary).toBe(113_500)
    // (113,500 - 100,000) / 100,000 = 0.135, below the 15% wanted.
    expect(result.verticalGap).toBeCloseTo(0.135, 10)
    expect(result.flagged).toBe(true)
  })

  it('falls back to the grade median when the managerId matches nobody', () => {
    const result = verticalFor({ ...OFFER, managerId: 'GHOST' })

    // Still gives an answer, and the label says which answer it gave.
    expect(result.source).toBe('gradeAboveMedian')
    expect(result.comparatorFteSalary).toBe(113_500)
  })

  it('reports no comparator when the grade above is empty', () => {
    const { managerId: _managerId, ...withoutManager } = OFFER
    const onlyG4 = TEAM.filter((person) => person.gradeId === 'G4')
    const result = verticalFor(withoutManager as Offer, onlyG4)

    expect(result.source).toBe('none')
    expect(result.comparatorFteSalary).toBeNull()
    expect(result.verticalGap).toBeNull()
    expect(result.flagged).toBe(false)
  })

  it('never reaches past the immediately adjacent grade', () => {
    // With G5 removed from the structure there is no grade above G4 at all.
    // The answer is "no comparator", not a number borrowed from further up.
    const { managerId: _managerId, ...withoutManager } = OFFER
    const result = verticalFor(withoutManager as Offer, TEAM, [G3, G4])

    expect(result.source).toBe('none')
    expect(result.verticalGap).toBeNull()
  })

  it('returns no gap when the offer cannot be placed', () => {
    const result = verticalFor(OFFER, TEAM, GRADES, null)

    expect(result.comparatorFteSalary).toBe(130_000)
    expect(result.verticalGap).toBeNull()
    expect(result.flagged).toBe(false)
  })
})
