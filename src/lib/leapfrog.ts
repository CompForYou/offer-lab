import type { OfferSettings } from '../types/domain'
import type { IncumbentView } from './incumbent-view'

/**
 * Leapfrog and grade inversion. docs/SPEC.md section 7.3.
 *
 * Leapfrog is the plain fact that the offer is paid more than someone already
 * in the grade. It is not a judgement — a new hire out-earning a recent joiner
 * is unremarkable. What generates a conversation is leapfrogging someone
 * tenured, and leapfrogging someone tenured who performs well.
 */

export interface LeapfrogRow {
  incumbentId: string
  gradeId: string
  fteSalary: number
  /** How far below the offer they sit, as a proportion of the offer. */
  shortfall: number
  tenureMonths: number | null
  tenureKnown: boolean
  tenureQualified: boolean
  performanceRating?: string
  strongPerformer: boolean
}

export interface LeapfrogSummary {
  /** Everyone in the offer's grade paid less than the offer. */
  leapfrogged: LeapfrogRow[]
  /** Of those, the tenure-qualified. */
  qualifiedLeapfrogs: LeapfrogRow[]
  /** Of those, the ones nominated as strong performers. */
  strongLeapfrogs: LeapfrogRow[]
  /**
   * Incumbents in a HIGHER grade paid less than the offer.
   *
   * Reported separately and never merged into the leapfrog count. A person in a
   * higher grade earning less than a new hire in a lower one is a structural
   * problem the offer did not create but does expose, and it is louder than
   * anything happening inside a single grade.
   */
  gradeInversions: LeapfrogRow[]
}

export function findLeapfrogs(
  views: IncumbentView[],
  offerFte: number | null,
  settings: OfferSettings,
): LeapfrogSummary {
  if (offerFte === null || offerFte <= 0) {
    return {
      leapfrogged: [],
      qualifiedLeapfrogs: [],
      strongLeapfrogs: [],
      gradeInversions: [],
    }
  }

  const paidLess = (view: IncumbentView): boolean =>
    view.comparable && view.fteSalary !== null && view.fteSalary < offerFte

  const leapfrogged = views
    .filter((view) => view.inOfferGrade && paidLess(view))
    .map((view) => toRow(view, offerFte, settings))

  const gradeInversions = views
    .filter((view) => view.aboveOfferGrade && paidLess(view))
    .map((view) => toRow(view, offerFte, settings))

  const qualifiedLeapfrogs = leapfrogged.filter((row) => row.tenureQualified)

  return {
    leapfrogged,
    qualifiedLeapfrogs,
    strongLeapfrogs: qualifiedLeapfrogs.filter((row) => row.strongPerformer),
    gradeInversions,
  }
}

function toRow(
  view: IncumbentView,
  offerFte: number,
  settings: OfferSettings,
): LeapfrogRow {
  const fteSalary = view.fteSalary as number
  const rating = view.incumbent.performanceRating

  return {
    incumbentId: view.incumbent.id,
    gradeId: view.incumbent.gradeId,
    fteSalary,
    shortfall: (offerFte - fteSalary) / offerFte,
    tenureMonths: view.tenureMonths,
    tenureKnown: view.tenureKnown,
    tenureQualified: view.tenureQualified,
    performanceRating: rating,
    // No nominated ratings means nobody is a strong performer, rather than
    // everybody. An empty list is "not told", not "all of them".
    strongPerformer: rating !== undefined && settings.strongRatings.includes(rating),
  }
}
