import { describe, it, expect } from 'vitest'
import { runOffer } from './run-offer'
import { GRADES, OFFER, SETTINGS, TEAM } from './test-fixtures'
import type { OfferScenario } from '../types/domain'

/**
 * The whole of section 7 run end to end on the canonical team.
 *
 * The headline, worked by hand: a $100,000 offer into G4 flags five people
 * (E1, E2, E3, E8 in grade, plus the grade inversion E9), costs $50,000 a year
 * to fix, and therefore costs $150,000 in its first year rather than $100,000.
 */
const SCENARIO: OfferScenario = {
  name: 'Req 4412',
  incumbents: TEAM,
  grades: GRADES,
  offer: OFFER,
  settings: SETTINGS,
}

describe('runOffer', () => {
  it('produces the headline first-year cost', () => {
    const results = runOffer(SCENARIO)

    expect(results.remediation.remediationCost).toBe(50_000)
    expect(results.remediation.totalFirstYearCost).toBe(150_000)
  })

  it('places the offer in its grade', () => {
    const { placement } = runOffer(SCENARIO)

    expect(placement.compaRatio).toBe(1)
    expect(placement.rangePenetration).toBe(0.5)
    expect(placement.aboveMax).toBe(false)
  })

  it('positions the offer against the people already there', () => {
    const { teamPosition } = runOffer(SCENARIO)

    expect(teamPosition.gradeHeadcount).toBe(8)
    expect(teamPosition.countPaidLess).toBe(4)
    expect(teamPosition.offerRank).toBe(5)
  })

  it('finds the leapfrogs and the grade inversion', () => {
    const { leapfrog } = runOffer(SCENARIO)

    expect(leapfrog.leapfrogged).toHaveLength(4)
    expect(leapfrog.qualifiedLeapfrogs).toHaveLength(3)
    expect(leapfrog.strongLeapfrogs.map((r) => r.incumbentId)).toEqual(['E1', 'E8'])
    expect(leapfrog.gradeInversions.map((r) => r.incumbentId)).toEqual(['E9'])
  })

  it('costs the grade inversion against its own grade, not the offer grade', () => {
    const e9 = runOffer(SCENARIO).remediation.rows.find((r) => r.incumbentId === 'E9')

    expect(e9?.rule).toBe('compaRatioParity')
    expect(e9?.targetFteSalary).toBe(120_000)
  })

  it('uses one tenure date for every finding on the screen', () => {
    const results = runOffer(SCENARIO)

    // The offer's start date, not today. Two figures computed against different
    // tenure dates would contradict each other in front of a hiring manager.
    expect(results.asAtDate).toBe('2024-09-01')
  })

  it('falls back to today when the offer has no start date', () => {
    const { startDate: _startDate, ...offerWithoutStart } = OFFER
    const results = runOffer(
      { ...SCENARIO, offer: offerWithoutStart },
      undefined,
      '2025-09-01',
    )

    expect(results.asAtDate).toBe('2025-09-01')
    // A year later, E5 has crossed the twelve-month gate and now flags.
    expect(results.peerCompression.flagged.map((f) => f.incumbentId)).toContain('E5')
  })

  it('reports team-wide data quality, not just the offer grade', () => {
    const results = runOffer(SCENARIO)

    expect(results.teamHeadcount).toBe(11)
    expect(results.teamTenureUnknown).toBe(1) // E6
    expect(results.teamGateExcluded).toBe(1) // E5
    expect(results.orphanedIncumbents).toBe(0)
  })

  it('counts an incumbent whose grade is missing from the structure', () => {
    const orphaned = [...TEAM, {
      id: 'E99', gradeId: 'G9', baseSalary: 90_000, fte: 1, hireDate: '2020-01-01',
    }]
    const results = runOffer({ ...SCENARIO, incumbents: orphaned })

    // Reported, never silently dropped, and never mixed into the findings.
    expect(results.orphanedIncumbents).toBe(1)
    expect(results.teamPosition.gradeHeadcount).toBe(8)
  })

  it('builds the three costed paths', () => {
    const { paths } = runOffer(SCENARIO)

    expect(paths.map((p) => p.id)).toEqual(['A', 'B', 'C'])
    expect(paths[0].totalFirstYearCost).toBe(150_000)
    // C fixes only those paid less than the offer: E1, E2, E8, E9 = 48,000.
    expect(paths[2].remediationCost).toBe(48_000)
  })

  it('computes both ceilings and says the gate raised one of them', () => {
    const { ceiling } = runOffer(SCENARIO)

    expect(ceiling.gatedCeiling).toBeCloseTo(87_619.0476, 4)
    expect(ceiling.ungatedCeiling).toBeCloseTo(83_809.5238, 4)
    expect(ceiling.gateRaisesCeiling).toBe(true)
    expect(ceiling.belowMarket).toBe(true)
  })

  it('recomputes everything when the offer moves', () => {
    // The governing interaction: drag the offer, everything moves at once.
    const lower = runOffer({
      ...SCENARIO,
      offer: { ...OFFER, baseSalary: 87_000 },
    })

    // At 87,000 nobody in the grade is inverted or compressed any more.
    expect(lower.peerCompression.flagged).toHaveLength(0)
    expect(lower.remediation.remediationCost).toBe(0)
    expect(lower.remediation.totalFirstYearCost).toBe(87_000)
    expect(lower.leapfrog.gradeInversions).toHaveLength(0)
  })

  it('costs more as the offer rises', () => {
    const higher = runOffer({
      ...SCENARIO,
      offer: { ...OFFER, baseSalary: 118_000 },
    })

    // Everyone in the grade below 118,000 is now inverted, and the restore
    // target of 123,900 exceeds the G4 maximum, so part of the fix is blocked.
    expect(higher.remediation.remediationCost).toBeGreaterThan(50_000)
    expect(higher.remediation.blockedHeadcount).toBeGreaterThan(0)
    expect(higher.remediation.blockedCost).toBeGreaterThan(0)
  })

  it('survives an empty team without inventing numbers', () => {
    const results = runOffer({ ...SCENARIO, incumbents: [] })

    expect(results.teamPosition.gradeHeadcount).toBe(0)
    expect(results.teamPosition.offerPercentile).toBeNull()
    expect(results.peerCompression.flagged).toHaveLength(0)
    expect(results.remediation.remediationCost).toBe(0)
    expect(results.remediation.totalFirstYearCost).toBe(100_000)
    // The range maximum is still a real constraint on a team of nobody.
    expect(results.ceiling.gatedCeiling).toBe(120_000)
  })

  it('survives a grade that is missing from the structure', () => {
    const results = runOffer({
      ...SCENARIO,
      offer: { ...OFFER, gradeId: 'G9' },
    })

    expect(results.offerGrade).toBeUndefined()
    expect(results.placement.compaRatio).toBeNull()
    expect(results.ceiling.gatedCeiling).toBeCloseTo(113_043.4783, 4)
  })
})
