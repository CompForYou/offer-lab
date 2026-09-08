import { describe, it, expect } from 'vitest'
import { placeOffer, fullTimeEquivalent } from './offer-placement'
import type { Grade, Offer } from '../types/domain'

/**
 * One grade, chosen so every expected value can be worked out by hand:
 * a $40,000 span, a midpoint at $100,000, a 50% range spread.
 */
const G4: Grade = { id: 'G4', name: 'Grade 4', order: 4, min: 80_000, mid: 100_000, max: 120_000 }

function offerOf(baseSalary: number, fte = 1): Offer {
  return { label: 'Req 4412', gradeId: 'G4', baseSalary, fte }
}

describe('placeOffer', () => {
  it('places an offer at the midpoint', () => {
    const placement = placeOffer(offerOf(100_000), G4)

    expect(placement.compaRatio).toBe(1)
    // (100,000 - 80,000) / 40,000 = 0.50
    expect(placement.rangePenetration).toBe(0.5)
    expect(placement.band?.id).toBe('band-100-110')
    expect(placement.aboveMax).toBe(false)
    expect(placement.belowMin).toBe(false)
  })

  it('places an offer below the midpoint', () => {
    const placement = placeOffer(offerOf(97_000), G4)

    expect(placement.compaRatio).toBeCloseTo(0.97, 10)
    // (97,000 - 80,000) / 40,000 = 0.425
    expect(placement.rangePenetration).toBeCloseTo(0.425, 10)
    expect(placement.band?.id).toBe('band-090-100')
  })

  it('reports an offer above the maximum as a fact, not an error', () => {
    const placement = placeOffer(offerOf(126_000), G4)

    expect(placement.aboveMax).toBe(true)
    // (126,000 - 120,000) / 120,000 = 0.05
    expect(placement.vsMax).toBeCloseTo(0.05, 10)
    // Penetration is not clamped: (126,000 - 80,000) / 40,000 = 1.15
    expect(placement.rangePenetration).toBeCloseTo(1.15, 10)
  })

  it('reports an offer below the minimum as a fact, not an error', () => {
    const placement = placeOffer(offerOf(76_000), G4)

    expect(placement.belowMin).toBe(true)
    // (76,000 - 80,000) / 80,000 = -0.05
    expect(placement.vsMin).toBeCloseTo(-0.05, 10)
    expect(placement.rangePenetration).toBeCloseTo(-0.1, 10)
  })

  it('treats an offer exactly at the maximum as inside the range', () => {
    const placement = placeOffer(offerOf(120_000), G4)

    expect(placement.aboveMax).toBe(false)
    expect(placement.vsMax).toBe(0)
    expect(placement.rangePenetration).toBe(1)
  })

  it('treats an offer exactly at the minimum as inside the range', () => {
    const placement = placeOffer(offerOf(80_000), G4)

    expect(placement.belowMin).toBe(false)
    expect(placement.vsMin).toBe(0)
    expect(placement.rangePenetration).toBe(0)
  })

  it('grosses a part-time offer to full-time before placing it', () => {
    // A 0.5 FTE offer of $50,000 is a full-time rate of $100,000. Without the
    // gross-up it would read as severely green-circled and place at 0.50.
    const placement = placeOffer(offerOf(50_000, 0.5), G4)

    expect(placement.offerFte).toBe(100_000)
    expect(placement.compaRatio).toBe(1)
    expect(placement.rangePenetration).toBe(0.5)
  })

  it('keeps the actual salary separate from the full-time equivalent', () => {
    // Placement compares at $100,000; cost is the $50,000 that leaves the bank.
    const placement = placeOffer(offerOf(50_000, 0.5), G4)

    expect(placement.offerFte).toBe(100_000)
    expect(placement.offerActual).toBe(50_000)
  })

  it('returns nulls, not zeros, when the grade is missing', () => {
    const placement = placeOffer(offerOf(100_000), undefined)

    expect(placement.compaRatio).toBeNull()
    expect(placement.rangePenetration).toBeNull()
    expect(placement.band).toBeNull()
    expect(placement.vsMax).toBeNull()
    expect(placement.vsMin).toBeNull()
    // The offer itself is still known even when its grade is not.
    expect(placement.offerFte).toBe(100_000)
    expect(placement.offerActual).toBe(100_000)
  })

  it('returns nulls when the FTE is zero', () => {
    const placement = placeOffer(offerOf(100_000, 0), G4)

    expect(placement.offerFte).toBeNull()
    expect(placement.compaRatio).toBeNull()
  })

  it('returns a null compa-ratio when the midpoint is zero', () => {
    const brokenGrade: Grade = { ...G4, mid: 0 }
    const placement = placeOffer(offerOf(100_000), brokenGrade)

    expect(placement.compaRatio).toBeNull()
    // Penetration does not depend on the midpoint and survives.
    expect(placement.rangePenetration).toBe(0.5)
  })
})

describe('fullTimeEquivalent', () => {
  it('grosses up a part-time salary', () => {
    expect(fullTimeEquivalent(47_500, 0.5)).toBe(95_000)
  })

  it('leaves a full-time salary alone', () => {
    expect(fullTimeEquivalent(95_000, 1)).toBe(95_000)
  })

  it('returns null for a zero or negative FTE rather than dividing by it', () => {
    expect(fullTimeEquivalent(95_000, 0)).toBeNull()
    expect(fullTimeEquivalent(95_000, -0.5)).toBeNull()
  })

  it('returns null for a non-finite salary', () => {
    expect(fullTimeEquivalent(Number.NaN, 1)).toBeNull()
  })
})
