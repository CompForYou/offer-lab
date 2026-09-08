import { describe, it, expect } from 'vitest'
import { positionInTeam } from './team-position'
import { buildIncumbentViews, peersInOfferGrade } from './incumbent-view'
import { AS_AT, G4, GRADES, OFFER, SETTINGS, TEAM, teamWith } from './test-fixtures'

/**
 * G4 full-time equivalent salaries, sorted:
 *   88,000 · 92,000 · 95,000 · 98,000 · 101,500 · 103,000 · 106,000 · 115,000
 * Median is the mean of the middle two: (98,000 + 101,500) / 2 = 99,750.
 */
function positionFor(incumbents = TEAM, offerFte: number | null = 100_000) {
  const views = buildIncumbentViews(incumbents, GRADES, OFFER, SETTINGS, AS_AT)
  return positionInTeam(peersInOfferGrade(views), offerFte, G4.mid)
}

describe('positionInTeam', () => {
  it('counts less, same and more so they reconcile to the headcount', () => {
    const position = positionFor()

    expect(position.gradeHeadcount).toBe(8)
    expect(position.countPaidLess).toBe(4) // 88,000 · 92,000 · 95,000 · 98,000
    expect(position.countPaidSame).toBe(0)
    expect(position.countPaidMore).toBe(4) // 101,500 · 103,000 · 106,000 · 115,000
    expect(
      position.countPaidLess + position.countPaidSame + position.countPaidMore,
    ).toBe(position.gradeHeadcount)
  })

  it('expresses the offer as a percentile of the grade', () => {
    expect(positionFor().offerPercentile).toBe(0.5) // 4 of 8 paid less
  })

  it('ranks the offer among the people already there', () => {
    const position = positionFor()

    // Four people out-earn the offer, so it is 5th of 9 once it joins.
    expect(position.offerRank).toBe(5)
    expect(position.rankOf).toBe(9)
  })

  it('gives a tie the better rank', () => {
    // An offer level with 101,500 still sits behind only the three above it.
    const position = positionFor(TEAM, 101_500)

    expect(position.countPaidSame).toBe(1)
    expect(position.offerRank).toBe(4)
  })

  it('reports the grade median on a full-time equivalent basis', () => {
    expect(positionFor().medianFteSalary).toBe(99_750)
  })

  it('reports the median compa-ratio', () => {
    // 99,750 / 100,000
    expect(positionFor().medianCompaRatio).toBeCloseTo(0.9975, 10)
  })

  it('reports the extremes of the grade', () => {
    const position = positionFor()

    expect(position.lowestPaidFte).toBe(88_000)
    expect(position.highestPaidFte).toBe(115_000)
  })

  it('sums grade payroll on ACTUAL pay, not full-time equivalent', () => {
    // 92,000 + 98,000 + 103,000 + 106,000 + 88,000 + 101,500 + 115,000 + 47,500
    // The 0.5 FTE incumbent contributes the 47,500 that leaves the bank, not
    // the 95,000 they are compared at.
    expect(positionFor().gradePayroll).toBe(751_000)
  })

  it('excludes an incumbent who cannot be compared, and still reconciles', () => {
    const position = positionFor(teamWith({ id: 'E4', fte: 0 }))

    expect(position.gradeHeadcount).toBe(7)
    expect(
      position.countPaidLess + position.countPaidSame + position.countPaidMore,
    ).toBe(7)
  })

  it('returns nulls for an empty grade rather than zeros', () => {
    const position = positionFor([])

    expect(position.gradeHeadcount).toBe(0)
    expect(position.offerPercentile).toBeNull()
    expect(position.medianFteSalary).toBeNull()
    expect(position.lowestPaidFte).toBeNull()
    expect(position.gradePayroll).toBe(0)
  })

  it('still reports the grade when the offer cannot be placed', () => {
    const position = positionFor(TEAM, null)

    // What the team looks like does not depend on the offer being valid.
    expect(position.medianFteSalary).toBe(99_750)
    expect(position.offerPercentile).toBeNull()
    expect(position.offerRank).toBeNull()
  })
})
