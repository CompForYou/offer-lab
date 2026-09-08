import type { Grade, Incumbent, Offer, OfferSettings } from '../types/domain'
import { fullTimeEquivalent } from './offer-placement'
import { calculateTenureMonths, isTenureQualified } from './tenure'

/**
 * One incumbent with everything the findings need, worked out once.
 *
 * Leapfrog, peer compression, the ceiling, and remediation all need the same
 * four facts about each person: their full-time equivalent salary, their grade,
 * their tenure, and whether that tenure qualifies them to be flagged. Computing
 * them in one place means the four cannot drift apart and contradict each other
 * on screen, which is the failure mode that destroys trust in a tool.
 */
export interface IncumbentView {
  incumbent: Incumbent
  grade: Grade | undefined

  /**
   * Salary grossed to full-time, for every comparison.
   * Null when the FTE is zero or the salary is not a number.
   */
  fteSalary: number | null
  /** Actual pay at their FTE, for every cost. */
  actualSalary: number

  /** Null means no hire date, which is not the same as zero months. */
  tenureMonths: number | null
  tenureKnown: boolean
  /** Tenure is known AND at or above the gate. Only these can be flagged. */
  tenureQualified: boolean

  /** False when the salary cannot be compared at all. Excluded from findings. */
  comparable: boolean
  /** In the same grade as the offer — the peer population. */
  inOfferGrade: boolean
  /** In a grade ABOVE the offer's by declared order — the inversion population. */
  aboveOfferGrade: boolean
}

/**
 * Build the view for every incumbent.
 *
 * Ordering by grade uses the declared `order` field, never the midpoint.
 * Inference from midpoint breaks on parallel job families with overlapping
 * midpoints, and an inferred hierarchy cannot be audited by a reader.
 *
 * `asAtDate` is resolved by the caller (offer start date, else today) so this
 * function stays pure and its tests do not depend on the clock.
 */
export function buildIncumbentViews(
  incumbents: Incumbent[],
  grades: Grade[],
  offer: Offer,
  settings: OfferSettings,
  asAtDate: string,
): IncumbentView[] {
  const gradesById = new Map(grades.map((grade) => [grade.id, grade]))
  const offerGrade = gradesById.get(offer.gradeId)

  return incumbents.map((incumbent) => {
    const grade = gradesById.get(incumbent.gradeId)
    const fteSalary = fullTimeEquivalent(incumbent.baseSalary, incumbent.fte)
    const tenureMonths = calculateTenureMonths(incumbent.hireDate, asAtDate)

    return {
      incumbent,
      grade,
      fteSalary,
      actualSalary: Number.isFinite(incumbent.baseSalary) ? incumbent.baseSalary : 0,
      tenureMonths,
      tenureKnown: tenureMonths !== null,
      tenureQualified: isTenureQualified(tenureMonths, settings.tenureQualifyingMonths),
      comparable: fteSalary !== null,
      inOfferGrade: incumbent.gradeId === offer.gradeId,
      aboveOfferGrade:
        grade !== undefined &&
        offerGrade !== undefined &&
        grade.order > offerGrade.order,
    }
  })
}

/** The peer population: comparable incumbents in the offer's own grade. */
export function peersInOfferGrade(views: IncumbentView[]): IncumbentView[] {
  return views.filter((view) => view.inOfferGrade && view.comparable)
}
