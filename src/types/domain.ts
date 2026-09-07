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
