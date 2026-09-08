/**
 * The compensation math library.
 *
 * Every function here is pure: numbers in, numbers out, no dependency on the
 * interface and no side effects. Nothing rounds — rounding belongs at display
 * time only, in format.ts. Percentages are decimals (0.035, not 3.5).
 *
 * Comparisons gross up to full-time equivalent; costs use actual pay.
 *
 * Formulas follow docs/SPEC.md section 7.
 */

// Copied unchanged from Merit Lab. See SPEC section 4.
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

// Offer Lab's own maths.
export {
  completedMonthsBetween,
  calculateTenureMonths,
  isTenureQualified,
  resolveAsAtDate,
  todayIso,
} from './tenure'
export {
  placeOffer,
  fullTimeEquivalent,
  type OfferPlacement,
} from './offer-placement'
export {
  buildIncumbentViews,
  peersInOfferGrade,
  type IncumbentView,
} from './incumbent-view'
export { positionInTeam, type TeamPosition } from './team-position'
export {
  findLeapfrogs,
  type LeapfrogRow,
  type LeapfrogSummary,
} from './leapfrog'
export {
  findPeerCompression,
  type PeerFinding,
  type PeerStatus,
  type PeerCompressionSummary,
} from './peer-compression'
export {
  findVerticalCompression,
  type ComparatorSource,
  type VerticalCompression,
} from './vertical-compression'
export {
  costRemediation,
  resolveRule,
  type AppliedRule,
  type RemediationRow,
  type RemediationSummary,
  type RemediationInput,
} from './remediation'
export {
  calculateOfferCeiling,
  type CeilingConstraint,
  type OfferCeiling,
} from './offer-ceiling'
export {
  buildCostedPaths,
  type PathId,
  type CostedPath,
  type CostedPathsInput,
} from './costed-paths'
export { runOffer, type OfferResults } from './run-offer'
