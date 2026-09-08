import { describe, it, expect } from 'vitest'
import { costRemediation, resolveRule } from './remediation'
import { buildIncumbentViews } from './incumbent-view'
import { AS_AT, GRADES, OFFER, SETTINGS, TEAM } from './test-fixtures'
import type { RemediationTarget } from '../types/domain'

/**
 * The flagged population against a $100,000 offer into G4, worked by hand.
 * Threshold 5%, so restore-differential targets $105,000; the offer sits at a
 * 1.00 compa-ratio, so compa-ratio parity targets each person's own midpoint.
 *
 *   E1  G4   92,000 fte  -> 105,000  funded 13,000  x1.0 = 13,000
 *   E2  G4   98,000 fte  -> 105,000  funded  7,000  x1.0 =  7,000
 *   E3  G4  103,000 fte  -> 105,000  funded  2,000  x1.0 =  2,000
 *   E8  G4   95,000 fte  -> 105,000  funded 10,000  x0.5 =  5,000
 *   E9  G5   97,000 fte  -> 120,000  funded 23,000  x1.0 = 23,000
 *                                                   total  50,000
 */
const FLAGGED_IDS = ['E1', 'E2', 'E3', 'E8', 'E9']

function costFor(
  ids: string[] = FLAGGED_IDS,
  target: RemediationTarget = 'auto',
  offerFte = 100_000,
  offerCompaRatio: number | null = 1,
) {
  const views = buildIncumbentViews(TEAM, GRADES, OFFER, SETTINGS, AS_AT)
  return costRemediation({
    flagged: views.filter((view) => ids.includes(view.incumbent.id)),
    offerFte,
    offerActual: 100_000,
    offerCompaRatio,
    offerGradeId: 'G4',
    peerCompressionThreshold: SETTINGS.peerCompressionThreshold,
    target,
    gradePayroll: 751_000,
    grades: GRADES,
  })
}

describe('resolveRule', () => {
  it('resolves auto to restore-differential inside the offer grade', () => {
    expect(resolveRule('auto', 'G4', 'G4')).toBe('restoreDifferential')
  })

  it('resolves auto to compa-ratio parity outside the offer grade', () => {
    // A target of "5% ahead of the offer" applied to a G5 employee would price
    // them off a G4 offer, which is arithmetic without meaning.
    expect(resolveRule('auto', 'G5', 'G4')).toBe('compaRatioParity')
  })

  it('leaves an explicit rule alone in both cases', () => {
    expect(resolveRule('parityWithOffer', 'G5', 'G4')).toBe('parityWithOffer')
    expect(resolveRule('compaRatioParity', 'G4', 'G4')).toBe('compaRatioParity')
  })
})

describe('costRemediation with the auto rule', () => {
  it('costs the whole flagged population', () => {
    expect(costFor().remediationCost).toBe(50_000)
    expect(costFor().remediationHeadcount).toBe(5)
  })

  it('applies restore-differential inside the offer grade', () => {
    const e1 = costFor().rows.find((row) => row.incumbentId === 'E1')

    expect(e1?.rule).toBe('restoreDifferential')
    expect(e1?.targetFteSalary).toBe(105_000)
    expect(e1?.fundedAdjustmentFte).toBe(13_000)
    expect(e1?.adjustmentCost).toBe(13_000)
    // 13,000 / 92,000
    expect(e1?.adjustmentPercent).toBeCloseTo(0.1413043478, 9)
  })

  it('applies compa-ratio parity across grades, against their own midpoint', () => {
    const e9 = costFor().rows.find((row) => row.incumbentId === 'E9')

    // Offer compa-ratio 1.00 x the G5 midpoint of 120,000.
    expect(e9?.rule).toBe('compaRatioParity')
    expect(e9?.targetFteSalary).toBe(120_000)
    expect(e9?.fundedAdjustmentFte).toBe(23_000)
  })

  it('costs a part-time incumbent at their actual FTE', () => {
    const e8 = costFor().rows.find((row) => row.incumbentId === 'E8')

    // The gap is 10,000 full-time, but only 5,000 leaves the bank at 0.5 FTE.
    expect(e8?.currentFteSalary).toBe(95_000)
    expect(e8?.fundedAdjustmentFte).toBe(10_000)
    expect(e8?.adjustmentCost).toBe(5_000)
    // The percentage rise is a full-time comparison: 10,000 / 95,000.
    expect(e8?.adjustmentPercent).toBeCloseTo(0.1052631579, 9)
  })

  it('reports cost against grade payroll and the offer', () => {
    const summary = costFor()

    // 50,000 / 751,000
    expect(summary.costAsPercentOfGrade).toBeCloseTo(0.0665778962, 9)
    expect(summary.totalFirstYearCost).toBe(150_000)
    expect(summary.remediationPremium).toBe(0.5)
  })
})

describe('costRemediation rules compared', () => {
  it('parity is cheaper and levels tenured people with the new hire', () => {
    const summary = costFor(FLAGGED_IDS, 'parityWithOffer')

    // E1 8,000 + E2 2,000 + E3 0 + E8 (5,000 fte x 0.5) 2,500 + E9 3,000
    expect(summary.remediationCost).toBe(15_500)
  })

  it('restore-differential applied across grades prices G5 off a G4 offer', () => {
    const summary = costFor(FLAGGED_IDS, 'restoreDifferential')

    // E9's target drops from 120,000 to 105,000 — 8,000 rather than 23,000.
    // This is exactly the outcome the auto rule exists to avoid.
    const e9 = summary.rows.find((row) => row.incumbentId === 'E9')
    expect(e9?.targetFteSalary).toBe(105_000)
    expect(summary.remediationCost).toBe(35_000)
  })

  it('compa-ratio parity targets each person against their own midpoint', () => {
    const summary = costFor(FLAGGED_IDS, 'compaRatioParity')

    // Everyone in G4 targets 100,000; E9 in G5 targets 120,000.
    // E1 8,000 + E2 2,000 + E3 0 + E8 2,500 + E9 23,000
    expect(summary.remediationCost).toBe(35_500)
  })
})

describe('costRemediation edge behaviour', () => {
  it('never cuts pay: someone already above their target costs zero', () => {
    // E3 is at 103,000 against a parity target of 100,000.
    const e3 = costFor(['E3'], 'parityWithOffer').rows[0]

    expect(e3.fundedAdjustmentFte).toBe(0)
    expect(e3.adjustmentCost).toBe(0)
  })

  it('lists a zero-cost row rather than dropping the person', () => {
    // A reader checking the list should see who was considered, not only who
    // cost money.
    const summary = costFor(['E3'], 'parityWithOffer')

    expect(summary.rows).toHaveLength(1)
    expect(summary.remediationHeadcount).toBe(0)
  })

  it('caps the funded adjustment at the range maximum and reports the rest', () => {
    // A 118,000 offer targets 123,900 under restore-differential, which is
    // above the G4 maximum of 120,000.
    const summary = costFor(['E1'], 'auto', 118_000)
    const e1 = summary.rows[0]

    expect(e1.targetFteSalary).toBeCloseTo(123_900, 6)
    expect(e1.payableTargetFte).toBe(120_000)
    expect(e1.fundedAdjustmentFte).toBe(28_000) // 120,000 - 92,000
    expect(e1.blockedFte).toBeCloseTo(3_900, 6) // 123,900 - 120,000
  })

  it('never rolls the blocked amount into the cost', () => {
    // Quoting it would bill for an increase nobody has approved an exception for.
    const summary = costFor(['E1'], 'auto', 118_000)

    expect(summary.remediationCost).toBe(28_000)
    expect(summary.blockedCost).toBeCloseTo(3_900, 6)
    expect(summary.blockedHeadcount).toBe(1)
  })

  it('blocks at the part-timer own FTE too', () => {
    const summary = costFor(['E8'], 'auto', 118_000)
    const e8 = summary.rows[0]

    // Blocked 3,900 full-time is 1,950 of actual payroll at 0.5 FTE.
    expect(e8.blockedFte).toBeCloseTo(3_900, 6)
    expect(e8.blockedCost).toBeCloseTo(1_950, 6)
  })

  it('produces no row for compa-ratio parity when the offer has no compa-ratio', () => {
    // No defensible target exists, so no target is invented.
    const summary = costFor(['E9'], 'compaRatioParity', 100_000, null)

    expect(summary.rows).toHaveLength(0)
    expect(summary.remediationCost).toBe(0)
  })

  it('returns zeros for an empty flagged population', () => {
    const summary = costFor([])

    expect(summary.remediationCost).toBe(0)
    expect(summary.remediationHeadcount).toBe(0)
    expect(summary.totalFirstYearCost).toBe(100_000)
  })
})
