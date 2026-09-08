import { describe, it, expect } from 'vitest'
import { findPeerCompression } from './peer-compression'
import { buildIncumbentViews, peersInOfferGrade } from './incumbent-view'
import { AS_AT, GRADES, OFFER, SETTINGS, TEAM, teamWith } from './test-fixtures'

/**
 * The canonical team against a $100,000 offer into G4. Worked by hand:
 *
 *   E1  92,000 fte   gap -0.08   inverted    68 months   FLAGGED
 *   E2  98,000 fte   gap -0.02   inverted    39 months   FLAGGED
 *   E3 103,000 fte   gap +0.03   compressed  54 months   FLAGGED
 *   E4 106,000 fte   gap +0.06   clear       24 months
 *   E5  88,000 fte   gap -0.12   inverted     6 months   recent hire, not flagged
 *   E6 101,500 fte   gap +0.015  compressed  unknown     not flagged
 *   E7 115,000 fte   gap +0.15   clear       80 months
 *   E8  95,000 fte   gap -0.05   inverted    63 months   FLAGGED (0.5 FTE)
 */
function summarize(incumbents = TEAM, settings = SETTINGS) {
  const views = buildIncumbentViews(incumbents, GRADES, OFFER, settings, AS_AT)
  return findPeerCompression(peersInOfferGrade(views), 100_000, settings)
}

describe('findPeerCompression', () => {
  it('classifies every comparable peer and drops nobody', () => {
    const summary = summarize()
    expect(summary.findings).toHaveLength(8)
    expect(summary.findings.map((f) => f.incumbentId)).toEqual([
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8',
    ])
  })

  it('computes the gap against the offer, not the lower salary', () => {
    const summary = summarize()
    const e3 = summary.findings.find((f) => f.incumbentId === 'E3')

    // (103,000 - 100,000) / 100,000 = 0.03 exactly.
    // Dividing by the lower salary instead would give 0.0291, which is what
    // Merit Lab reports for the same pair. See SPEC 13.1.
    expect(e3?.peerGap).toBeCloseTo(0.03, 10)
  })

  it('counts inverted, compressed and clear so they sum to the headcount', () => {
    const summary = summarize()

    expect(summary.invertedCount).toBe(4) // E1, E2, E5, E8
    expect(summary.compressedCount).toBe(2) // E3, E6
    expect(summary.clearCount).toBe(2) // E4, E7
    expect(
      summary.invertedCount + summary.compressedCount + summary.clearCount,
    ).toBe(summary.findings.length)
  })

  it('flags only people in the zone whose tenure qualifies', () => {
    const summary = summarize()
    expect(summary.flagged.map((f) => f.incumbentId)).toEqual(['E1', 'E2', 'E3', 'E8'])
  })

  it('does not flag a recent hire sitting below the offer', () => {
    const summary = summarize()
    const e5 = summary.findings.find((f) => f.incumbentId === 'E5')

    // Six months in, priced by the same market as the offer. Reported, marked,
    // never flagged, never costed.
    expect(e5?.status).toBe('inverted')
    expect(e5?.recentHire).toBe(true)
    expect(e5?.flagged).toBe(false)
  })

  it('does not flag an incumbent with no hire date', () => {
    const summary = summarize()
    const e6 = summary.findings.find((f) => f.incumbentId === 'E6')

    expect(e6?.status).toBe('compressed')
    expect(e6?.tenureKnown).toBe(false)
    expect(e6?.tenureMonths).toBeNull()
    expect(e6?.flagged).toBe(false)
    // And is not treated as a recent hire either — unknown is its own state.
    expect(e6?.recentHire).toBe(false)
  })

  it('reports the three standing counts so the gate cannot hide anything', () => {
    const summary = summarize()

    expect(summary.recentHiresInZone).toBe(1) // E5
    expect(summary.gateExcluded).toBe(1) // E5
    expect(summary.tenureUnknown).toBe(1) // E6
  })

  it('grosses a part-time peer up before comparing', () => {
    const summary = summarize()
    const e8 = summary.findings.find((f) => f.incumbentId === 'E8')

    // 47,500 at 0.5 FTE is a full-time rate of 95,000: gap -0.05, inverted.
    // Ungrossed it would read as 47,500 and look catastrophically underpaid.
    expect(e8?.fteSalary).toBe(95_000)
    expect(e8?.actualSalary).toBe(47_500)
    expect(e8?.peerGap).toBeCloseTo(-0.05, 10)
    expect(e8?.status).toBe('inverted')
  })

  it('treats an incumbent paid exactly the offer as compressed, not inverted', () => {
    const summary = summarize(teamWith({ id: 'E3', baseSalary: 100_000 }))
    const e3 = summary.findings.find((f) => f.incumbentId === 'E3')

    expect(e3?.peerGap).toBe(0)
    expect(e3?.status).toBe('compressed')
  })

  it('treats an incumbent exactly at the threshold as clear', () => {
    // 105,000 against a 100,000 offer is a gap of exactly 0.05.
    const summary = summarize(teamWith({ id: 'E3', baseSalary: 105_000 }))
    const e3 = summary.findings.find((f) => f.incumbentId === 'E3')

    expect(e3?.peerGap).toBeCloseTo(0.05, 10)
    expect(e3?.status).toBe('clear')
  })

  it('widens the flagged set when the threshold rises', () => {
    const wider = summarize(TEAM, { ...SETTINGS, peerCompressionThreshold: 0.1 })

    // At 10 points, E4 (+0.06) joins the compressed set. E7 (+0.15) stays clear.
    expect(wider.compressedCount).toBe(3)
    expect(wider.flagged.map((f) => f.incumbentId)).toEqual(['E1', 'E2', 'E3', 'E4', 'E8'])
  })

  it('flags the recent hire when the gate is removed', () => {
    const noGate = summarize(TEAM, { ...SETTINGS, tenureQualifyingMonths: 0 })

    expect(noGate.gateExcluded).toBe(0)
    expect(noGate.recentHiresInZone).toBe(0)
    expect(noGate.flagged.map((f) => f.incumbentId)).toEqual(['E1', 'E2', 'E3', 'E5', 'E8'])
    // Unknown tenure still never flags: no gate is not the same as no data.
    expect(noGate.tenureUnknown).toBe(1)
  })

  it('returns an empty summary when the offer cannot be placed', () => {
    const views = buildIncumbentViews(TEAM, GRADES, OFFER, SETTINGS, AS_AT)
    const summary = findPeerCompression(peersInOfferGrade(views), null, SETTINGS)

    expect(summary.findings).toHaveLength(0)
    expect(summary.flagged).toHaveLength(0)
  })
})
