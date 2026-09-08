import { describe, it, expect } from 'vitest'
import { buildIncumbentViews, peersInOfferGrade } from './incumbent-view'
import { AS_AT, GRADES, OFFER, SETTINGS, TEAM, teamWith } from './test-fixtures'

function viewsFor(incumbents = TEAM, settings = SETTINGS) {
  return buildIncumbentViews(incumbents, GRADES, OFFER, settings, AS_AT)
}

function viewOf(id: string, incumbents = TEAM) {
  return viewsFor(incumbents).find((view) => view.incumbent.id === id)
}

describe('buildIncumbentViews', () => {
  it('keeps actual pay and full-time equivalent pay separate', () => {
    const e8 = viewOf('E8')

    expect(e8?.actualSalary).toBe(47_500)
    expect(e8?.fteSalary).toBe(95_000)
  })

  it('resolves each incumbent to their grade', () => {
    expect(viewOf('E9')?.grade?.id).toBe('G5')
  })

  it('leaves the grade undefined when the structure has no such grade', () => {
    const orphan = viewOf('E1', teamWith({ id: 'E1', gradeId: 'G9' }))

    expect(orphan?.grade).toBeUndefined()
    // And is therefore in neither the peer nor the inversion population.
    expect(orphan?.inOfferGrade).toBe(false)
    expect(orphan?.aboveOfferGrade).toBe(false)
  })

  it('measures tenure to the as-at date', () => {
    // E1 hired 2019-01-01, as at 2024-09-01: 68 completed months.
    expect(viewOf('E1')?.tenureMonths).toBe(68)
    expect(viewOf('E1')?.tenureQualified).toBe(true)
  })

  it('records unknown tenure as null and never qualifies it', () => {
    const e6 = viewOf('E6')

    expect(e6?.tenureMonths).toBeNull()
    expect(e6?.tenureKnown).toBe(false)
    expect(e6?.tenureQualified).toBe(false)
  })

  it('does not qualify a recent hire', () => {
    // E5 hired 2024-03-01: six months at the as-at date.
    const e5 = viewOf('E5')

    expect(e5?.tenureMonths).toBe(6)
    expect(e5?.tenureKnown).toBe(true)
    expect(e5?.tenureQualified).toBe(false)
  })

  it('identifies grades above the offer by declared order, not midpoint', () => {
    // GRADES is deliberately supplied out of sequence in the fixture.
    expect(viewOf('E9')?.aboveOfferGrade).toBe(true) // G5, order 5
    expect(viewOf('E11')?.aboveOfferGrade).toBe(false) // G3, order 3
    expect(viewOf('E1')?.aboveOfferGrade).toBe(false) // G4, the offer's own
  })

  it('marks an incumbent with a zero FTE as not comparable', () => {
    const broken = viewOf('E4', teamWith({ id: 'E4', fte: 0 }))

    expect(broken?.fteSalary).toBeNull()
    expect(broken?.comparable).toBe(false)
    // Their actual pay is still known, so grade payroll stays right.
    expect(broken?.actualSalary).toBe(106_000)
  })

  it('produces one view per incumbent, in the input order', () => {
    const views = viewsFor()

    expect(views).toHaveLength(TEAM.length)
    expect(views[0].incumbent.id).toBe('E1')
  })
})

describe('peersInOfferGrade', () => {
  it('returns only comparable incumbents in the offer grade', () => {
    const peers = peersInOfferGrade(viewsFor())

    expect(peers.map((peer) => peer.incumbent.id)).toEqual([
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8',
    ])
  })

  it('excludes an incumbent who cannot be compared', () => {
    const peers = peersInOfferGrade(viewsFor(teamWith({ id: 'E4', fte: 0 })))

    expect(peers.map((peer) => peer.incumbent.id)).not.toContain('E4')
    expect(peers).toHaveLength(7)
  })
})
