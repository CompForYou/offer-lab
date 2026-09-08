import type { Grade, RemediationTarget } from '../types/domain'
import type { IncumbentView } from './incumbent-view'

/**
 * The cost to fix. docs/SPEC.md section 7.6.
 *
 * The output of this module is the number the tool exists to produce: what the
 * offer costs once you account for what it does to the people already there.
 */

/** The rule actually applied to one person. `auto` resolves to one of these. */
export type AppliedRule =
  | 'parityWithOffer'
  | 'restoreDifferential'
  | 'compaRatioParity'

export interface RemediationRow {
  incumbentId: string
  gradeId: string
  rule: AppliedRule

  currentFteSalary: number
  targetFteSalary: number
  /** The target, capped at this person's own range maximum. */
  payableTargetFte: number
  fundedAdjustmentFte: number
  /** Actual payroll dollars: the funded adjustment at this person's FTE. */
  adjustmentCost: number
  /** The rise as a proportion of their current salary. */
  adjustmentPercent: number | null
  /**
   * The part of the target that sits above their range maximum, in full-time
   * terms. Money cannot solve this inside the structure — it needs an exception.
   */
  blockedFte: number
  /** The blocked amount in actual payroll dollars. */
  blockedCost: number
}

export interface RemediationSummary {
  rows: RemediationRow[]

  remediationCost: number
  remediationHeadcount: number
  blockedCost: number
  blockedHeadcount: number

  /** Sum of ACTUAL base salary in the offer's grade. */
  gradePayroll: number
  costAsPercentOfGrade: number | null
  /** The offer plus the remediation it triggers. The headline. */
  totalFirstYearCost: number
  remediationPremium: number | null
}

/** Who gets costed, and the context each rule needs. */
export interface RemediationInput {
  /** The flagged people: peer-compression flags plus grade inversions. */
  flagged: IncumbentView[]
  offerFte: number
  offerActual: number
  offerCompaRatio: number | null
  offerGradeId: string
  peerCompressionThreshold: number
  target: RemediationTarget
  gradePayroll: number
  grades: Grade[]
}

/**
 * Cost the remediation.
 *
 * Never negative: remediation does not cut anyone's pay, so every adjustment has
 * a floor of zero. Someone already at or above their target costs nothing and
 * appears in the rows with a zero, rather than being dropped — a reader checking
 * the list should see who was considered, not only who cost money.
 *
 * The blocked amount is reported separately and NEVER rolled into the cost.
 * Adding it would quote a bill for an increase that needs an exception nobody
 * has approved.
 */
export function costRemediation(input: RemediationInput): RemediationSummary {
  const gradesById = new Map(input.grades.map((grade) => [grade.id, grade]))
  const rows: RemediationRow[] = []

  for (const view of input.flagged) {
    if (view.fteSalary === null) continue

    const rule = resolveRule(input.target, view.incumbent.gradeId, input.offerGradeId)
    const grade = gradesById.get(view.incumbent.gradeId)
    const targetFteSalary = targetFor(rule, input, grade)
    if (targetFteSalary === null) continue

    const gradeMax =
      grade !== undefined && Number.isFinite(grade.max) ? grade.max : Infinity

    const payableTargetFte = Math.min(targetFteSalary, gradeMax)
    const fundedAdjustmentFte = Math.max(0, payableTargetFte - view.fteSalary)
    const blockedFte = Math.max(0, targetFteSalary - gradeMax)
    const fte = view.incumbent.fte

    rows.push({
      incumbentId: view.incumbent.id,
      gradeId: view.incumbent.gradeId,
      rule,
      currentFteSalary: view.fteSalary,
      targetFteSalary,
      payableTargetFte,
      fundedAdjustmentFte,
      adjustmentCost: fundedAdjustmentFte * fte,
      adjustmentPercent:
        view.fteSalary > 0 ? fundedAdjustmentFte / view.fteSalary : null,
      blockedFte,
      blockedCost: blockedFte * fte,
    })
  }

  const remediationCost = rows.reduce((total, row) => total + row.adjustmentCost, 0)
  const blockedCost = rows.reduce((total, row) => total + row.blockedCost, 0)

  return {
    rows,
    remediationCost,
    remediationHeadcount: rows.filter((row) => row.adjustmentCost > 0).length,
    blockedCost,
    blockedHeadcount: rows.filter((row) => row.blockedFte > 0).length,
    gradePayroll: input.gradePayroll,
    costAsPercentOfGrade:
      input.gradePayroll > 0 ? remediationCost / input.gradePayroll : null,
    totalFirstYearCost: input.offerActual + remediationCost,
    remediationPremium:
      input.offerActual > 0 ? remediationCost / input.offerActual : null,
  }
}

/**
 * `auto` resolves per person: restore-differential inside the offer's grade,
 * compa-ratio parity outside it.
 *
 * A target of "the threshold ahead of the offer" applied to someone in another
 * grade prices one grade's employee off another grade's offer, which is
 * arithmetic without meaning. Compa-ratio parity treats them against their own
 * structure, which is the only defensible cross-grade rule.
 */
export function resolveRule(
  target: RemediationTarget,
  incumbentGradeId: string,
  offerGradeId: string,
): AppliedRule {
  if (target !== 'auto') return target
  return incumbentGradeId === offerGradeId ? 'restoreDifferential' : 'compaRatioParity'
}

function targetFor(
  rule: AppliedRule,
  input: RemediationInput,
  grade: Grade | undefined,
): number | null {
  switch (rule) {
    case 'parityWithOffer':
      return input.offerFte
    case 'restoreDifferential':
      return input.offerFte * (1 + input.peerCompressionThreshold)
    case 'compaRatioParity': {
      // Needs both the offer's compa-ratio and this person's own midpoint.
      // Without either there is no defensible target, so no row is produced
      // rather than a target invented from what is available.
      if (input.offerCompaRatio === null) return null
      if (grade === undefined || !Number.isFinite(grade.mid) || grade.mid <= 0) return null
      return input.offerCompaRatio * grade.mid
    }
  }
}
