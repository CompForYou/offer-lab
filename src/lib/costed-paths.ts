/**
 * Costed paths. docs/SPEC.md section 7.9.
 *
 * The tool names the ways through and prices each one. It does not rank them,
 * score them, or mark one recommended: that would discard context the
 * practitioner has and the tool does not.
 *
 * Always in the fixed order A, B, C — never sorted by cost, because sorting by
 * cost is ranking by another name.
 */

export type PathId = 'A' | 'B' | 'C'

export interface CostedPath {
  id: PathId
  label: string
  /** The base salary actually paid to the new hire under this path. */
  offerActual: number
  remediationCost: number
  totalFirstYearCost: number
  /** Path B only: how far below the entered offer this lands, in dollars. */
  offerReduction?: number
  /** Path B only: how far below the market reference this lands, in dollars. */
  belowMarketBy?: number
  /** How many incumbents this path pays to fix. */
  fixesHeadcount: number
}

export interface CostedPathsInput {
  /** The offer as entered, in actual payroll dollars. */
  offerActual: number
  /** The offer's FTE, used to convert a full-time ceiling into actual pay. */
  offerFte: number
  /** Cost of fixing every flagged incumbent. */
  fullRemediationCost: number
  fullRemediationHeadcount: number
  /** Cost of fixing only those paid less than the offer. */
  inversionRemediationCost: number
  inversionRemediationHeadcount: number
  /** Full-time equivalent. Null when there is no constraint. */
  gatedCeiling: number | null
  /** Full-time equivalent. */
  offerFteSalary: number | null
  marketReference?: number
}

export function buildCostedPaths(input: CostedPathsInput): CostedPath[] {
  const paths: CostedPath[] = []

  paths.push({
    id: 'A',
    label: 'Pay the offer, fix every flag',
    offerActual: input.offerActual,
    remediationCost: input.fullRemediationCost,
    totalFirstYearCost: input.offerActual + input.fullRemediationCost,
    fixesHeadcount: input.fullRemediationHeadcount,
  })

  // Path B is omitted rather than shown at zero when there is no ceiling: with
  // no constraint there is no lower offer to describe, and a zero would read as
  // "pay nothing", which is not what "no constraint" means.
  //
  // It is also omitted when the offer already sits at or below the ceiling.
  // There is then nothing to route around, and a path that quotes a HIGHER
  // number than the offer reads as advice to pay more — which is not what this
  // tool is for, and not what the path means.
  const alreadyClean =
    input.offerFteSalary !== null &&
    input.gatedCeiling !== null &&
    input.offerFteSalary <= input.gatedCeiling

  if (input.gatedCeiling !== null && input.offerFte > 0 && !alreadyClean) {
    const ceilingActual = input.gatedCeiling * input.offerFte
    const path: CostedPath = {
      id: 'B',
      label: 'Pay the ceiling, fix nothing',
      offerActual: ceilingActual,
      remediationCost: 0,
      totalFirstYearCost: ceilingActual,
      offerReduction: input.offerActual - ceilingActual,
      fixesHeadcount: 0,
    }
    if (input.marketReference !== undefined && Number.isFinite(input.marketReference)) {
      path.belowMarketBy = input.marketReference - input.gatedCeiling
    }
    paths.push(path)
  }

  // Path C exists because it is what practitioners actually do under budget
  // pressure: somebody paid LESS than a new hire is indefensible, while somebody
  // paid slightly more is merely uncomfortable. Pricing that middle route is
  // more useful than pretending the choice is binary.
  //
  // Omitted when it would duplicate path A — an identical row at an identical
  // price is noise, not a choice.
  if (input.inversionRemediationHeadcount > 0 &&
      input.inversionRemediationCost !== input.fullRemediationCost) {
    paths.push({
      id: 'C',
      label: 'Pay the offer, fix inversions only',
      offerActual: input.offerActual,
      remediationCost: input.inversionRemediationCost,
      totalFirstYearCost: input.offerActual + input.inversionRemediationCost,
      fixesHeadcount: input.inversionRemediationHeadcount,
    })
  }

  return paths
}
