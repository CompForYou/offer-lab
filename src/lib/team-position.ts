import type { IncumbentView } from './incumbent-view'
import { median } from './statistics'

/**
 * Where the offer sits in the team it is joining. docs/SPEC.md section 7.2.
 *
 * Comparisons use full-time equivalent salary; `gradePayroll` uses actual pay,
 * because it is the denominator for a cost.
 */
export interface TeamPosition {
  /** Comparable incumbents in the offer's grade. */
  gradeHeadcount: number
  countPaidLess: number
  countPaidSame: number
  countPaidMore: number
  /** countPaidLess / gradeHeadcount. Null for an empty grade. */
  offerPercentile: number | null
  /**
   * The offer's rank by pay, 1 = highest paid, counting the offer itself.
   * An offer nobody out-earns ranks 1st of headcount + 1.
   */
  offerRank: number | null
  rankOf: number

  medianFteSalary: number | null
  medianCompaRatio: number | null
  lowestPaidFte: number | null
  highestPaidFte: number | null
  /** Sum of ACTUAL base salary in the offer's grade. */
  gradePayroll: number
}

/**
 * Position the offer against its grade.
 *
 * `countPaidLess`, `countPaidSame` and `countPaidMore` always sum to
 * `gradeHeadcount`, so the table on screen reconciles. An incumbent whose salary
 * cannot be grossed to full-time — a zero FTE, a salary that is not a number —
 * is not comparable and is excluded from the headcount entirely rather than
 * silently counted as zero. The importer rejects those rows on entry; this is
 * the second line of defence.
 */
export function positionInTeam(
  peers: IncumbentView[],
  offerFte: number | null,
  gradeMid: number | undefined,
): TeamPosition {
  const salaries = peers
    .map((peer) => peer.fteSalary)
    .filter((salary): salary is number => salary !== null)

  const gradePayroll = peers.reduce((total, peer) => total + peer.actualSalary, 0)

  const empty: TeamPosition = {
    gradeHeadcount: salaries.length,
    countPaidLess: 0,
    countPaidSame: 0,
    countPaidMore: 0,
    offerPercentile: null,
    offerRank: null,
    rankOf: salaries.length + 1,
    medianFteSalary: median(salaries),
    medianCompaRatio: medianCompaRatio(salaries, gradeMid),
    lowestPaidFte: salaries.length > 0 ? Math.min(...salaries) : null,
    highestPaidFte: salaries.length > 0 ? Math.max(...salaries) : null,
    gradePayroll,
  }

  if (offerFte === null) return empty

  const countPaidLess = salaries.filter((salary) => salary < offerFte).length
  const countPaidSame = salaries.filter((salary) => salary === offerFte).length
  const countPaidMore = salaries.filter((salary) => salary > offerFte).length

  return {
    ...empty,
    countPaidLess,
    countPaidSame,
    countPaidMore,
    offerPercentile: salaries.length > 0 ? countPaidLess / salaries.length : null,
    // Rank 1 is the highest paid. Ties share the better rank, so an offer level
    // with two people ranks above both rather than below them.
    offerRank: countPaidMore + 1,
  }
}

function medianCompaRatio(
  salaries: number[],
  gradeMid: number | undefined,
): number | null {
  if (gradeMid === undefined || !Number.isFinite(gradeMid) || gradeMid <= 0) return null
  return median(salaries.map((salary) => salary / gradeMid))
}
