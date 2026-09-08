import type { Grade, OfferSettings } from '../types/domain'
import type { IncumbentView } from './incumbent-view'

/**
 * The clean offer ceiling — the highest offer that would flag nobody.
 * docs/SPEC.md section 7.7.
 *
 * From the peer rule, an incumbent is clear when
 *   peerGap >= threshold
 * which rearranges to
 *   offerFte <= incumbentFte / (1 + threshold)
 * so the binding constraint is the LOWEST-paid flaggable peer.
 *
 * Every figure here is a full-time equivalent. An offer at less than 1.0 FTE
 * converts by multiplying the ceiling by the offer's FTE.
 */

export type CeilingConstraint = 'peer' | 'vertical' | 'gradeMax'

export interface OfferCeiling {
  /**
   * Computed over tenure-qualified peers only, so it matches the flags exactly.
   * A ceiling computed on a different population from the flags would
   * contradict them on screen.
   */
  gatedCeiling: number | null
  /**
   * Computed over every peer, including recent hires and unknown tenure.
   *
   * On a young team the gated ceiling reads high BECAUSE it ignored people.
   * Publishing the ungated figure alongside is what stops the tenure gate
   * inflating the safe-offer number invisibly.
   */
  ungatedCeiling: number | null

  peerCeilingGated: number | null
  peerCeilingUngated: number | null
  verticalCeiling: number | null
  gradeMax: number | null

  /** Which constraint set the gated ceiling. */
  binding: CeilingConstraint | null
  /** The two differ, so both belong on screen. */
  gateRaisesCeiling: boolean

  /**
   * No offer inside the range avoids compression. The team and the structure
   * already disagree; the offer did not cause it and lowering it will not fix it.
   */
  belowGradeMin: boolean
  /** A market-competitive offer is not possible without paying to fix the team. */
  belowMarket: boolean
}

export function calculateOfferCeiling(
  peers: IncumbentView[],
  offerGrade: Grade | undefined,
  comparatorFteSalary: number | null,
  settings: OfferSettings,
  marketReference: number | undefined,
): OfferCeiling {
  const comparable = peers.filter(
    (peer): peer is IncumbentView & { fteSalary: number } => peer.fteSalary !== null,
  )

  const peerCeilingUngated = lowestClearingOffer(
    comparable.map((peer) => peer.fteSalary),
    settings.peerCompressionThreshold,
  )
  const peerCeilingGated = lowestClearingOffer(
    comparable.filter((peer) => peer.tenureQualified).map((peer) => peer.fteSalary),
    settings.peerCompressionThreshold,
  )

  const verticalCeiling =
    comparatorFteSalary !== null && comparatorFteSalary > 0
      ? comparatorFteSalary / (1 + settings.verticalDifferentialThreshold)
      : null

  const gradeMax =
    offerGrade !== undefined && Number.isFinite(offerGrade.max) ? offerGrade.max : null

  const gatedCeiling = smallest([peerCeilingGated, verticalCeiling, gradeMax])
  const ungatedCeiling = smallest([peerCeilingUngated, verticalCeiling, gradeMax])

  const gradeMin =
    offerGrade !== undefined && Number.isFinite(offerGrade.min) ? offerGrade.min : null

  return {
    gatedCeiling,
    ungatedCeiling,
    peerCeilingGated,
    peerCeilingUngated,
    verticalCeiling,
    gradeMax,
    binding: whichBinds(gatedCeiling, peerCeilingGated, verticalCeiling, gradeMax),
    gateRaisesCeiling:
      gatedCeiling !== null && ungatedCeiling !== null && gatedCeiling > ungatedCeiling,
    belowGradeMin: gatedCeiling !== null && gradeMin !== null && gatedCeiling < gradeMin,
    belowMarket:
      gatedCeiling !== null &&
      marketReference !== undefined &&
      Number.isFinite(marketReference) &&
      gatedCeiling < marketReference,
  }
}

/**
 * The highest offer that clears every salary in the population.
 *
 * Null for an empty population — there is then no constraint, and null is not
 * the same statement as zero. A caller that treated it as zero would report a
 * ceiling of nothing on a team of one new hire.
 */
function lowestClearingOffer(salaries: number[], threshold: number): number | null {
  if (salaries.length === 0) return null
  return Math.min(...salaries.map((salary) => salary / (1 + threshold)))
}

function smallest(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null)
  if (present.length === 0) return null
  return Math.min(...present)
}

/**
 * Which constraint produced the ceiling. Ties resolve to the peer constraint,
 * then vertical, then the maximum — the order a practitioner would name them,
 * and the order in which they are actionable.
 */
function whichBinds(
  ceiling: number | null,
  peer: number | null,
  vertical: number | null,
  gradeMax: number | null,
): CeilingConstraint | null {
  if (ceiling === null) return null
  if (peer !== null && peer === ceiling) return 'peer'
  if (vertical !== null && vertical === ceiling) return 'vertical'
  if (gradeMax !== null && gradeMax === ceiling) return 'gradeMax'
  return null
}
