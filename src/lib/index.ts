/**
 * The compensation math library.
 *
 * Every function here is pure: numbers in, numbers out, no dependency on the
 * interface and no side effects. Nothing rounds — rounding belongs at display
 * time only. Percentages are decimals (0.035, not 3.5).
 *
 * Everything currently exported was copied unchanged from Merit Lab, with its
 * tests. Offer Lab's own formulas — offer placement, leapfrog, compression, and
 * the cost to remediate it — follow docs/SPEC.md section 7 and are added here as
 * they are built and tested.
 */

export { calculateCompaRatio } from './compa-ratio'
export { calculateRangePenetration } from './range-penetration'
export { calculateRangeSpread } from './range-spread'
export {
  calculateMidpointProgression,
  calculateStructureProgressions,
  type GradeProgression,
} from './midpoint-progression'
export {
  assignCompaRatioBand,
  DEFAULT_COMPA_RATIO_BANDS,
} from './compa-ratio-bands'
export { mean, median } from './statistics'
export * from './format'
