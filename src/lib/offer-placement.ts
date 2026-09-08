import type { CompaRatioBand, Grade, Offer } from '../types/domain'
import { calculateCompaRatio } from './compa-ratio'
import { calculateRangePenetration } from './range-penetration'
import { assignCompaRatioBand, DEFAULT_COMPA_RATIO_BANDS } from './compa-ratio-bands'

/**
 * Offer placement — where the proposed salary sits in its own range.
 * docs/SPEC.md section 7.1.
 *
 * Everything here is a comparison against a range, so everything uses the
 * FULL-TIME EQUIVALENT salary. A 0.5 FTE offer of $59,000 is compared as
 * $118,000, because the range is expressed in full-time terms. Cost figures
 * elsewhere use the actual $59,000.
 */
export interface OfferPlacement {
  /** The offer grossed to full-time. Null when the FTE is zero or invalid. */
  offerFte: number | null
  /** What actually hits payroll: the offer exactly as entered. */
  offerActual: number
  compaRatio: number | null
  rangePenetration: number | null
  band: CompaRatioBand | null
  /** (offerFte - gradeMax) / gradeMax. Positive means over the top. */
  vsMax: number | null
  /** (offerFte - gradeMin) / gradeMin. Negative means under the floor. */
  vsMin: number | null
  /** Red-circled on arrival. */
  aboveMax: boolean
  /** Green-circled on arrival. */
  belowMin: boolean
}

/**
 * Place an offer in its grade.
 *
 * An offer above the maximum or below the minimum is reported as a fact, not an
 * error. People do hire above the maximum, usually for a reason, and a tool that
 * scolds them for it gets closed.
 *
 * When the grade is missing every range-dependent figure is null rather than
 * zero. A zero compa-ratio would flow into a band lookup and understate the
 * finding; a null forces the caller to say "no grade" on screen.
 */
export function placeOffer(
  offer: Offer,
  grade: Grade | undefined,
  bands: CompaRatioBand[] = DEFAULT_COMPA_RATIO_BANDS,
): OfferPlacement {
  const offerFte = fullTimeEquivalent(offer.baseSalary, offer.fte)
  const offerActual = Number.isFinite(offer.baseSalary) ? offer.baseSalary : 0

  if (grade === undefined || offerFte === null) {
    return {
      offerFte,
      offerActual,
      compaRatio: null,
      rangePenetration: null,
      band: null,
      vsMax: null,
      vsMin: null,
      aboveMax: false,
      belowMin: false,
    }
  }

  const compaRatio = calculateCompaRatio(offer.baseSalary, grade.mid, offer.fte)
  const rangePenetration = calculateRangePenetration(
    offer.baseSalary,
    grade.min,
    grade.max,
    offer.fte,
  )

  return {
    offerFte,
    offerActual,
    compaRatio,
    rangePenetration,
    band: assignCompaRatioBand(compaRatio, bands),
    vsMax: relativeTo(offerFte, grade.max),
    vsMin: relativeTo(offerFte, grade.min),
    aboveMax: Number.isFinite(grade.max) && offerFte > grade.max,
    belowMin: Number.isFinite(grade.min) && offerFte < grade.min,
  }
}

/**
 * A salary grossed to its full-time equivalent.
 *
 * Exported because every module in this library that compares a salary to a
 * range or to another salary needs exactly this, and duplicating the guard
 * clauses is how one of them ends up dividing by zero.
 *
 * Returns null for a zero, negative, or non-finite FTE.
 */
export function fullTimeEquivalent(
  baseSalary: number,
  fte: number,
): number | null {
  if (!Number.isFinite(baseSalary)) return null
  if (!Number.isFinite(fte) || fte <= 0) return null
  return baseSalary / fte
}

/** (value - reference) / reference. Null when the reference cannot divide. */
function relativeTo(value: number, reference: number): number | null {
  if (!Number.isFinite(reference) || reference <= 0) return null
  return (value - reference) / reference
}
