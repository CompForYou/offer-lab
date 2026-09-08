import { describe, it, expect } from 'vitest'
import { findLeapfrogs } from './leapfrog'
import { buildIncumbentViews } from './incumbent-view'
import { AS_AT, GRADES, OFFER, SETTINGS, TEAM, teamWith } from './test-fixtures'

function leapfrogsFor(incumbents = TEAM, settings = SETTINGS) {
  const views = buildIncumbentViews(incumbents, GRADES, OFFER, settings, AS_AT)
  return findLeapfrogs(views, 100_000, settings)
}

describe('findLeapfrogs', () => {
  it('finds everyone in the grade paid less than the offer', () => {
    // E1 92,000 · E2 98,000 · E5 88,000 · E8 95,000 fte
    expect(leapfrogsFor().leapfrogged.map((r) => r.incumbentId)).toEqual([
      'E1', 'E2', 'E5', 'E8',
    ])
  })

  it('separates the tenured ones, which are the ones that start a conversation', () => {
    // E5 is six months in and drops out.
    expect(leapfrogsFor().qualifiedLeapfrogs.map((r) => r.incumbentId)).toEqual([
      'E1', 'E2', 'E8',
    ])
  })

  it('separates the strong performers among the tenured ones', () => {
    // E1 Exceeds, E8 Outstanding — both nominated as strong. E2 is a Meets.
    expect(leapfrogsFor().strongLeapfrogs.map((r) => r.incumbentId)).toEqual(['E1', 'E8'])
  })

  it('treats an empty strong-rating list as nobody, not everybody', () => {
    const summary = leapfrogsFor(TEAM, { ...SETTINGS, strongRatings: [] })
    expect(summary.strongLeapfrogs).toHaveLength(0)
  })

  it('reports grade inversion separately from peer leapfrog', () => {
    const summary = leapfrogsFor()

    // E9 sits in G5 — a grade ABOVE the offer — yet earns 97,000 against a
    // 100,000 offer into G4. Structural, and louder than anything inside G4.
    expect(summary.gradeInversions.map((r) => r.incumbentId)).toEqual(['E9'])
    // And is never mixed into the leapfrog count.
    expect(summary.leapfrogged.map((r) => r.incumbentId)).not.toContain('E9')
  })

  it('ignores lower grades entirely', () => {
    // E11 in G3 earns 76,000, well below the offer, and is not a finding:
    // a lower grade being paid less is the structure working.
    const summary = leapfrogsFor()
    const allIds = [
      ...summary.leapfrogged,
      ...summary.gradeInversions,
    ].map((r) => r.incumbentId)

    expect(allIds).not.toContain('E11')
  })

  it('measures shortfall against the offer', () => {
    const e1 = leapfrogsFor().leapfrogged.find((r) => r.incumbentId === 'E1')
    // (100,000 - 92,000) / 100,000 = 0.08
    expect(e1?.shortfall).toBeCloseTo(0.08, 10)
  })

  it('compares a part-time incumbent on a full-time basis', () => {
    const e8 = leapfrogsFor().leapfrogged.find((r) => r.incumbentId === 'E8')
    expect(e8?.fteSalary).toBe(95_000)
    expect(e8?.shortfall).toBeCloseTo(0.05, 10)
  })

  it('does not count someone paid exactly the offer as leapfrogged', () => {
    const summary = leapfrogsFor(teamWith({ id: 'E2', baseSalary: 100_000 }))
    expect(summary.leapfrogged.map((r) => r.incumbentId)).not.toContain('E2')
  })

  it('returns nothing when the offer cannot be placed', () => {
    const views = buildIncumbentViews(TEAM, GRADES, OFFER, SETTINGS, AS_AT)
    const summary = findLeapfrogs(views, null, SETTINGS)

    expect(summary.leapfrogged).toHaveLength(0)
    expect(summary.gradeInversions).toHaveLength(0)
  })
})
