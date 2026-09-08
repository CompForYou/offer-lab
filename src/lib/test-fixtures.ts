/**
 * The canonical test team. Synthetic, generated here, never real pay data.
 *
 * One team, one structure, one offer, sized so every expected value in the tests
 * can be worked out by hand and checked by a compensation reader. It is built to
 * contain each case the findings have to handle at least once:
 *
 *   E1  inverted, long tenured, the binding constraint on the gated ceiling
 *   E2  inverted, tenured
 *   E3  compressed, tenured
 *   E4  clear
 *   E5  inverted but hired six months ago — the recent-hire case the gate exists
 *       for, and the reason the gated and ungated ceilings differ
 *   E6  compressed but no hire date — the tenure-unknown case
 *   E7  clear, comfortably ahead
 *   E8  inverted, tenured, and 0.5 FTE — the gross-up case
 *   E9  a GRADE INVERSION: sits in G5 yet is paid less than a G4 offer
 *   E10 the named manager, used as the vertical comparator
 *   E11 a grade below, in scope for nothing
 *
 * This file is excluded from the app build in tsconfig.app.json. It exists only
 * so the test files share one team instead of drifting apart.
 */

import type { Grade, Incumbent, Offer, OfferSettings } from '../types/domain'

export const G3: Grade = {
  id: 'G3', name: 'Grade 3', order: 3, min: 68_000, mid: 85_000, max: 102_000,
}
export const G4: Grade = {
  id: 'G4', name: 'Grade 4', order: 4, min: 80_000, mid: 100_000, max: 120_000,
}
export const G5: Grade = {
  id: 'G5', name: 'Grade 5', order: 5, min: 96_000, mid: 120_000, max: 144_000,
}

export const GRADES: Grade[] = [G5, G3, G4] // deliberately unordered

/** Tenure is measured to the offer's start date, so every figure below is fixed. */
export const AS_AT = '2024-09-01'

export const TEAM: Incumbent[] = [
  // Offer grade. FTE salary, peer gap against a $100,000 offer, tenure at AS_AT.
  { id: 'E1', gradeId: 'G4', baseSalary: 92_000, fte: 1, hireDate: '2019-01-01', performanceRating: 'Exceeds' },
  { id: 'E2', gradeId: 'G4', baseSalary: 98_000, fte: 1, hireDate: '2021-06-01', performanceRating: 'Meets' },
  { id: 'E3', gradeId: 'G4', baseSalary: 103_000, fte: 1, hireDate: '2020-03-01', performanceRating: 'Meets' },
  { id: 'E4', gradeId: 'G4', baseSalary: 106_000, fte: 1, hireDate: '2022-09-01', performanceRating: 'Meets' },
  { id: 'E5', gradeId: 'G4', baseSalary: 88_000, fte: 1, hireDate: '2024-03-01', performanceRating: 'Meets' },
  { id: 'E6', gradeId: 'G4', baseSalary: 101_500, fte: 1, performanceRating: 'Meets' },
  { id: 'E7', gradeId: 'G4', baseSalary: 115_000, fte: 1, hireDate: '2018-01-01', performanceRating: 'Exceeds' },
  { id: 'E8', gradeId: 'G4', baseSalary: 47_500, fte: 0.5, hireDate: '2019-06-01', performanceRating: 'Outstanding' },

  // A grade above, paid less than the offer: grade inversion.
  { id: 'E9', gradeId: 'G5', baseSalary: 97_000, fte: 1, hireDate: '2017-01-01', performanceRating: 'Meets' },
  // The vertical comparator.
  { id: 'E10', gradeId: 'G5', baseSalary: 130_000, fte: 1, hireDate: '2019-01-01', performanceRating: 'Exceeds' },

  // A grade below. In scope for nothing.
  { id: 'E11', gradeId: 'G3', baseSalary: 76_000, fte: 1, hireDate: '2023-01-01', performanceRating: 'Meets' },
]

export const OFFER: Offer = {
  label: 'Req 4412',
  gradeId: 'G4',
  baseSalary: 100_000,
  fte: 1,
  startDate: AS_AT,
  managerId: 'E10',
  marketReference: 104_000,
  marketReferenceLabel: '50th percentile',
}

export const SETTINGS: OfferSettings = {
  peerCompressionThreshold: 0.05,
  verticalDifferentialThreshold: 0.15,
  tenureQualifyingMonths: 12,
  remediationTarget: 'auto',
  strongRatings: ['Exceeds', 'Outstanding'],
}

/** Convenience for tests that need one incumbent changed. */
export function teamWith(overrides: Partial<Incumbent> & { id: string }): Incumbent[] {
  return TEAM.map((person) =>
    person.id === overrides.id ? { ...person, ...overrides } : person,
  )
}
