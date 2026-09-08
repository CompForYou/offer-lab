import { describe, it, expect } from 'vitest'
import { SAMPLE_GRADES, SAMPLE_TEAM, sampleScenario } from './sample-team'
import { runOffer } from '../lib/run-offer'
import { calculateStructureProgressions } from '../lib/midpoint-progression'
import { calculateRangeSpread } from '../lib/range-spread'

/**
 * The sample is a demonstration, so it has to be a defensible one. A structure
 * with a broken progression or a team with no findings would teach a
 * practitioner the wrong thing about the tool on their first screen.
 */
describe('the sample structure', () => {
  it('has grades in a sensible order with min below mid below max', () => {
    for (const grade of SAMPLE_GRADES) {
      expect(grade.min).toBeLessThan(grade.mid)
      expect(grade.mid).toBeLessThan(grade.max)
    }
  })

  it('has plausible range spreads', () => {
    for (const grade of SAMPLE_GRADES) {
      const spread = calculateRangeSpread(grade.min, grade.max) as number
      expect(spread).toBeGreaterThan(0.35)
      expect(spread).toBeLessThan(0.6)
    }
  })

  it('has a rising midpoint progression at every step', () => {
    for (const step of calculateStructureProgressions(SAMPLE_GRADES)) {
      expect(step.progression).toBeGreaterThan(0.1)
      expect(step.progression).toBeLessThan(0.25)
    }
  })
})

describe('the sample team', () => {
  it('has every incumbent in a real grade', () => {
    const ids = new Set(SAMPLE_GRADES.map((grade) => grade.id))
    for (const person of SAMPLE_TEAM) {
      expect(ids.has(person.gradeId)).toBe(true)
    }
  })

  it('has no duplicate ids', () => {
    expect(new Set(SAMPLE_TEAM.map((p) => p.id)).size).toBe(SAMPLE_TEAM.length)
  })

  it('has every manager id pointing at somebody in the team', () => {
    const ids = new Set(SAMPLE_TEAM.map((p) => p.id))
    for (const person of SAMPLE_TEAM) {
      if (person.managerId !== undefined) expect(ids.has(person.managerId)).toBe(true)
    }
  })

  it('contains no names anywhere', () => {
    // Constraint 5. Ids are identifiers; nothing here is a person.
    for (const person of SAMPLE_TEAM) {
      expect(person.id).toMatch(/^A-\d{3}$/)
    }
  })

  it('is around forty people across five grades', () => {
    expect(SAMPLE_TEAM.length).toBeGreaterThanOrEqual(38)
    expect(new Set(SAMPLE_TEAM.map((p) => p.gradeId)).size).toBe(5)
  })

  it('includes part-time incumbents, so the gross-up is visible', () => {
    expect(SAMPLE_TEAM.filter((p) => p.fte < 1).length).toBeGreaterThanOrEqual(2)
  })

  it('includes somebody with no hire date, as a real export would', () => {
    expect(SAMPLE_TEAM.some((p) => p.hireDate === undefined)).toBe(true)
  })
})

describe('the sample scenario as it loads', () => {
  const results = runOffer(sampleScenario(), undefined, '2024-11-01')

  it('lands the offer inside the range, near the top', () => {
    expect(results.placement.aboveMax).toBe(false)
    expect(results.placement.belowMin).toBe(false)
    expect(results.placement.compaRatio).toBeGreaterThan(1)
  })

  it('leapfrogs tenured incumbents, including a strong performer', () => {
    // Otherwise the first screen shows nothing worth looking at.
    expect(results.leapfrog.qualifiedLeapfrogs.length).toBeGreaterThanOrEqual(4)
    expect(results.leapfrog.strongLeapfrogs.length).toBeGreaterThanOrEqual(1)
  })

  it('exposes a grade inversion the offer did not create', () => {
    // A-504 sits in G5 on 112,400 against a 116,000 offer into G4.
    expect(results.leapfrog.gradeInversions.map((r) => r.incumbentId)).toContain('A-504')
  })

  it('produces peer compression findings that cost real money', () => {
    expect(results.peerCompression.flagged.length).toBeGreaterThanOrEqual(4)
    expect(results.remediation.remediationCost).toBeGreaterThan(0)
    expect(results.remediation.totalFirstYearCost).toBeGreaterThan(
      results.placement.offerActual,
    )
  })

  it('shows the tenure gate and the missing hire date at work', () => {
    // A-443 was hired six months before the offer; A-462 has no hire date.
    expect(results.peerCompression.gateExcluded).toBeGreaterThanOrEqual(1)
    expect(results.peerCompression.tenureUnknown).toBe(1)
  })

  it('produces a ceiling below the market reference', () => {
    // The sentence the tool exists to produce: a competitive offer is not
    // possible here without paying to fix the team.
    expect(results.ceiling.gatedCeiling).not.toBeNull()
    expect(results.ceiling.belowMarket).toBe(true)
  })

  it('offers all three costed paths', () => {
    expect(results.paths.map((p) => p.id)).toEqual(['A', 'B', 'C'])
  })
})
