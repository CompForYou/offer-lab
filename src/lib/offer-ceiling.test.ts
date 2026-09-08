import { describe, it, expect } from 'vitest'
import { calculateOfferCeiling } from './offer-ceiling'
import { buildIncumbentViews, peersInOfferGrade } from './incumbent-view'
import { AS_AT, G4, GRADES, OFFER, SETTINGS, TEAM, teamWith } from './test-fixtures'
import type { Incumbent } from '../types/domain'

/**
 * Worked by hand at a 5% peer threshold and a 15% vertical threshold.
 *
 * Lowest-paid tenure-qualified peer is E1 at 92,000:
 *   gated peer ceiling   = 92,000 / 1.05 = 87,619.0476
 * Lowest-paid peer of any tenure is E5 at 88,000, hired six months ago:
 *   ungated peer ceiling = 88,000 / 1.05 = 83,809.5238
 * Manager E10 at 130,000:
 *   vertical ceiling     = 130,000 / 1.15 = 113,043.4783
 * G4 maximum 120,000.
 */
function ceilingFor(
  incumbents: Incumbent[] = TEAM,
  comparator: number | null = 130_000,
  settings = SETTINGS,
  marketReference: number | undefined = 104_000,
) {
  const views = buildIncumbentViews(incumbents, GRADES, OFFER, settings, AS_AT)
  return calculateOfferCeiling(
    peersInOfferGrade(views),
    G4,
    comparator,
    settings,
    marketReference,
  )
}

describe('calculateOfferCeiling', () => {
  it('takes the lowest tenure-qualified peer as the gated constraint', () => {
    expect(ceilingFor().peerCeilingGated).toBeCloseTo(87_619.0476, 4)
  })

  it('takes the lowest peer of any tenure as the ungated constraint', () => {
    expect(ceilingFor().peerCeilingUngated).toBeCloseTo(83_809.5238, 4)
  })

  it('computes the vertical ceiling from the comparator', () => {
    expect(ceilingFor().verticalCeiling).toBeCloseTo(113_043.4783, 4)
  })

  it('takes the tightest of peer, vertical and range maximum', () => {
    const ceiling = ceilingFor()

    expect(ceiling.gatedCeiling).toBeCloseTo(87_619.0476, 4)
    expect(ceiling.binding).toBe('peer')
  })

  it('says when the tenure gate is what raised the ceiling', () => {
    const ceiling = ceilingFor()

    // The gated figure is higher BECAUSE it ignored a six-month hire on 88,000.
    // Publishing both is what stops the gate inflating the safe number silently.
    expect(ceiling.gateRaisesCeiling).toBe(true)
    expect(ceiling.gatedCeiling).toBeGreaterThan(ceiling.ungatedCeiling as number)
  })

  it('agrees with itself when nobody is excluded by the gate', () => {
    const ceiling = ceilingFor(TEAM, 130_000, { ...SETTINGS, tenureQualifyingMonths: 0 })

    expect(ceiling.gatedCeiling).toBeCloseTo(ceiling.ungatedCeiling as number, 6)
    expect(ceiling.gateRaisesCeiling).toBe(false)
  })

  it('lets the vertical constraint bind when peers are well paid', () => {
    // Lift every G4 peer clear, leaving the manager as the tightest constraint.
    const wellPaid = TEAM.map((person) =>
      person.gradeId === 'G4' ? { ...person, baseSalary: 118_000, fte: 1 } : person,
    )
    const ceiling = ceilingFor(wellPaid)

    // 118,000 / 1.05 = 112,380.95 against a vertical ceiling of 113,043.48.
    expect(ceiling.binding).toBe('peer')
    // Raise them further and the manager binds instead.
    const higher = TEAM.map((person) =>
      person.gradeId === 'G4' ? { ...person, baseSalary: 125_000, fte: 1 } : person,
    )
    expect(ceilingFor(higher).binding).toBe('vertical')
  })

  it('lets the range maximum bind when nothing else is tighter', () => {
    const generous = TEAM.map((person) =>
      person.gradeId === 'G4' ? { ...person, baseSalary: 140_000, fte: 1 } : person,
    )
    const ceiling = ceilingFor(generous, 200_000)

    expect(ceiling.gatedCeiling).toBe(120_000)
    expect(ceiling.binding).toBe('gradeMax')
  })

  it('flags a ceiling below the market reference', () => {
    const ceiling = ceilingFor()

    // 87,619 against a market of 104,000: a competitive offer is not possible
    // without paying to fix the team.
    expect(ceiling.belowMarket).toBe(true)
  })

  it('does not flag below-market when no market number was given', () => {
    // Called directly: passing undefined to the helper would re-apply its default.
    const views = buildIncumbentViews(TEAM, GRADES, OFFER, SETTINGS, AS_AT)
    const ceiling = calculateOfferCeiling(
      peersInOfferGrade(views),
      G4,
      130_000,
      SETTINGS,
      undefined,
    )

    expect(ceiling.belowMarket).toBe(false)
    expect(ceiling.gatedCeiling).toBeCloseTo(87_619.0476, 4)
  })

  it('flags a ceiling below the range minimum', () => {
    // One long-tenured incumbent on 78,000 pulls the ceiling to 74,285.71,
    // under the G4 minimum of 80,000. No offer inside the range avoids
    // compression: the team and the structure already disagree.
    const ceiling = ceilingFor(teamWith({ id: 'E1', baseSalary: 78_000 }))

    expect(ceiling.gatedCeiling).toBeCloseTo(74_285.7143, 4)
    expect(ceiling.belowGradeMin).toBe(true)
  })

  it('returns null, not zero, when there is no constraint at all', () => {
    const empty = calculateOfferCeiling([], G4, null, SETTINGS, undefined)

    expect(empty.peerCeilingGated).toBeNull()
    expect(empty.peerCeilingUngated).toBeNull()
    expect(empty.verticalCeiling).toBeNull()
    // The grade maximum is still a constraint even with nobody in the grade.
    expect(empty.gatedCeiling).toBe(120_000)
    expect(empty.binding).toBe('gradeMax')
  })

  it('returns a null ceiling when there is no grade and no comparator', () => {
    const nothing = calculateOfferCeiling([], undefined, null, SETTINGS, undefined)

    expect(nothing.gatedCeiling).toBeNull()
    expect(nothing.binding).toBeNull()
    expect(nothing.belowGradeMin).toBe(false)
  })

  it('gives no gated ceiling when every peer is a recent hire', () => {
    const allNew = TEAM.map((person) =>
      person.gradeId === 'G4' ? { ...person, hireDate: '2024-06-01' } : person,
    )
    const ceiling = ceilingFor(allNew, null)

    // Nobody qualifies, so only the range maximum constrains the gated figure —
    // while the ungated one still reflects the people actually there.
    expect(ceiling.peerCeilingGated).toBeNull()
    expect(ceiling.gatedCeiling).toBe(120_000)
    expect(ceiling.ungatedCeiling).toBeCloseTo(83_809.5238, 4)
    expect(ceiling.gateRaisesCeiling).toBe(true)
  })
})
