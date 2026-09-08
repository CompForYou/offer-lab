import type { Grade, Offer, OfferSettings } from '../types/domain'
import type { IncumbentView } from './incumbent-view'
import { median } from './statistics'

/**
 * Vertical compression — the offer against the level above it.
 * docs/SPEC.md section 7.5.
 *
 * This one matters more than peer compression in a specific way: it removes the
 * financial reason to accept a promotion.
 */

/** Where the comparator salary came from. Always stated on screen. */
export type ComparatorSource = 'manager' | 'gradeAboveMedian' | 'none'

export interface VerticalCompression {
  source: ComparatorSource
  /** Set only when the source is a named manager. */
  comparatorId?: string
  /** Set only when the source is a grade median. */
  comparatorGradeId?: string
  /** How many salaries the median was taken over. Set for a grade median. */
  comparatorHeadcount?: number
  comparatorFteSalary: number | null

  /** (comparatorFte - offerFte) / offerFte. Null when there is no comparator. */
  verticalGap: number | null
  flagged: boolean
  /** The offer is paid more than the level above it. Reported in its own right. */
  offerExceedsComparator: boolean
}

/**
 * Compare the offer to the level above.
 *
 * The comparator is the named manager when the offer has a `managerId` that
 * resolves to a comparable incumbent. Otherwise it is the median full-time
 * equivalent salary of the grade immediately above the offer's by declared
 * `order`, and the result says so.
 *
 * A grade median is a proxy, not a manager. Labelling a proxy as a manager
 * comparison is the kind of thing that destroys trust in a tool the first time
 * somebody checks it against the org chart.
 *
 * Falling back to the grade median never reaches past the immediately adjacent
 * grade. If that grade is empty there is no comparator, and the answer is "no
 * comparator" rather than a number borrowed from two levels up.
 */
export function findVerticalCompression(
  views: IncumbentView[],
  offer: Offer,
  grades: Grade[],
  offerFte: number | null,
  settings: OfferSettings,
): VerticalCompression {
  const comparator = resolveComparator(views, offer, grades)

  if (comparator.comparatorFteSalary === null || offerFte === null || offerFte <= 0) {
    return { ...comparator, verticalGap: null, flagged: false, offerExceedsComparator: false }
  }

  const verticalGap = (comparator.comparatorFteSalary - offerFte) / offerFte

  return {
    ...comparator,
    verticalGap,
    flagged: verticalGap < settings.verticalDifferentialThreshold,
    offerExceedsComparator: verticalGap < 0,
  }
}

type ComparatorOnly = Pick<
  VerticalCompression,
  'source' | 'comparatorId' | 'comparatorGradeId' | 'comparatorHeadcount' | 'comparatorFteSalary'
>

function resolveComparator(
  views: IncumbentView[],
  offer: Offer,
  grades: Grade[],
): ComparatorOnly {
  if (offer.managerId !== undefined) {
    const manager = views.find(
      (view) => view.incumbent.id === offer.managerId && view.comparable,
    )
    if (manager !== undefined) {
      return {
        source: 'manager',
        comparatorId: manager.incumbent.id,
        comparatorFteSalary: manager.fteSalary,
      }
    }
    // A managerId that resolves to nobody falls through to the grade median
    // rather than returning no comparator: the practitioner still gets an
    // answer, and the label tells them which one they got.
  }

  const gradeAbove = findGradeAbove(offer.gradeId, grades)
  if (gradeAbove === undefined) return { source: 'none', comparatorFteSalary: null }

  const salaries = views
    .filter((view) => view.incumbent.gradeId === gradeAbove.id && view.comparable)
    .map((view) => view.fteSalary as number)

  if (salaries.length === 0) return { source: 'none', comparatorFteSalary: null }

  return {
    source: 'gradeAboveMedian',
    comparatorGradeId: gradeAbove.id,
    comparatorHeadcount: salaries.length,
    comparatorFteSalary: median(salaries),
  }
}

/** The grade with the next `order` up. Never inferred from midpoint. */
function findGradeAbove(gradeId: string, grades: Grade[]): Grade | undefined {
  const current = grades.find((grade) => grade.id === gradeId)
  if (current === undefined) return undefined

  return grades
    .filter((grade) => grade.order > current.order)
    .sort((a, b) => a.order - b.order)[0]
}
