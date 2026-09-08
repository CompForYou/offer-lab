/**
 * Shared domain types.
 *
 * The types in this file arrived with the math library copied from Merit Lab and
 * are deliberately identical there and here: a grade is a grade, and a salary
 * structure exported from one tool must load into the other without translation.
 *
 * Offer Lab's own types — the incumbent team, the offer, the compression
 * findings — are added here as docs/SPEC.md is agreed and built.
 */

/** A level in the salary structure. */
export interface Grade {
  id: string
  name: string
  /**
   * Position in the structure, 1 = lowest. Explicit rather than inferred from
   * midpoint: inference breaks on parallel job families with overlapping
   * midpoints, and an inferred hierarchy cannot be audited by a reader.
   *
   * When an imported structure has no order column, the importer derives one
   * from ascending midpoint and states on screen that it did so.
   */
  order: number
  min: number
  mid: number
  max: number
}

/**
 * A compa-ratio band — a slice of the range used for reporting placement.
 *
 * Bounds are INCLUSIVE at the lower bound and EXCLUSIVE at the upper, so a
 * compa-ratio of exactly 0.90 falls in the 0.90-1.00 band, not the 0.80-0.90 one.
 * A null bound is unbounded in that direction.
 */
export interface CompaRatioBand {
  id: string
  label: string
  lowerBound: number | null
  upperBound: number | null
}

/**
 * Someone already on the team — the population the offer lands into.
 *
 * `id` is an identifier and must never be a name. See docs/SPEC.md section 11.
 */
export interface Incumbent {
  id: string
  gradeId: string
  /**
   * ACTUAL annualized base salary at this person's FTE, in dollars.
   * A 0.5 FTE incumbent paid 47,500 has a baseSalary of 47,500, not 95,000.
   * Comparisons gross this up; costs use it as-is.
   */
  baseSalary: number
  /** 0 to 1. */
  fte: number
  /**
   * ISO date, yyyy-mm-dd. Drives tenure, which gates the compression flags.
   * Optional because most exports lack it — but its absence is reported on
   * screen, never assumed in either direction.
   */
  hireDate?: string
  /** Matched against the rating values nominated in settings.strongRatings. */
  performanceRating?: string
  /** Another incumbent's id. Used for the vertical comparator. */
  managerId?: string
  /** Unrecognised import columns, preserved for grouping. Never a name. */
  attributes?: Record<string, string>
}

/**
 * The proposed hire.
 *
 * `label` is a req number or similar. It must never be a candidate's name:
 * this tool models an offer to a real person who has not been hired yet, and
 * that person's name has no business in a browser tab. See SPEC section 2.
 */
export interface Offer {
  label: string
  gradeId: string
  /** Proposed annualized base salary at the offer's FTE, in dollars. */
  baseSalary: number
  /** 0 to 1. */
  fte: number
  /** ISO date. The "as at" date for incumbent tenure. Defaults to today. */
  startDate?: string
  /** The incumbent id this role would report to, if known. */
  managerId?: string
  /** One market number in dollars, full-time equivalent. */
  marketReference?: number
  /** What that number is — "50th percentile", "competing offer". Free text. */
  marketReferenceLabel?: string
}

/**
 * How a flagged incumbent's target salary is chosen. See SPEC section 7.6.
 *
 * `auto` is the default and resolves per incumbent: restore-differential inside
 * the offer's grade, compa-ratio parity outside it. A target of "5% ahead of the
 * offer" applied to another grade prices one grade's employee off another
 * grade's offer, which is arithmetic without meaning.
 */
export type RemediationTarget =
  | 'auto'
  | 'parityWithOffer'
  | 'restoreDifferential'
  | 'compaRatioParity'

export interface OfferSettings {
  /** Decimal. An incumbent less than this far ahead of the offer is compressed. */
  peerCompressionThreshold: number
  /** Decimal. Differential wanted between the offer and the level above. */
  verticalDifferentialThreshold: number
  /** Below this tenure an incumbent is reported but never flagged. */
  tenureQualifyingMonths: number
  remediationTarget: RemediationTarget
  /** The rating values that count as strong. Empty means none nominated. */
  strongRatings: string[]
  /** ISO 4217 code for display. The maths is unit-agnostic. */
  currency?: string
  /** BCP 47 locale for display. */
  locale?: string
}

/** Everything needed to reproduce a run. This is what export/import writes. */
export interface OfferScenario {
  name: string
  incumbents: Incumbent[]
  grades: Grade[]
  offer: Offer
  settings: OfferSettings
}
