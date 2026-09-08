import { describe, it, expect, afterEach } from 'vitest'
import { summaryParagraph } from './summary-paragraph'
import { runOffer } from './run-offer'
import { resetCurrencyFormat } from './format'
import { sampleScenario } from '../data/sample-team'
import { GRADES, OFFER, SETTINGS, TEAM } from './test-fixtures'
import type { OfferScenario } from '../types/domain'

afterEach(resetCurrencyFormat)

const FIXTURE: OfferScenario = {
  name: 'Req 4412',
  incumbents: TEAM,
  grades: GRADES,
  offer: OFFER,
  settings: SETTINGS,
}

function paragraphFor(scenario: OfferScenario, today = '2024-09-01'): string {
  return summaryParagraph(runOffer(scenario, undefined, today), scenario.offer)
}

describe('summaryParagraph', () => {
  it('states where the offer lands and how many it is above', () => {
    const text = paragraphFor(FIXTURE)

    expect(text).toContain('An offer of $100,000 for Req 4412')
    expect(text).toContain('compa-ratio of 1.00')
    expect(text).toContain('above 4 of the 8 people already in it')
  })

  it('states the compression in words a hiring manager reads', () => {
    const text = paragraphFor(FIXTURE)

    // Three inverted (E1, E2, E8) and one compressed (E3).
    expect(text).toContain('3 longer-serving colleagues would be paid less than the new hire')
    expect(text).toContain('1 more sits within touching distance of it')
  })

  it('names the grade inversion as exposed rather than caused', () => {
    expect(paragraphFor(FIXTURE)).toContain('already paid less than this offer, which the offer exposes rather than causes')
  })

  it('gives the cost and the total, contrasted with the offer alone', () => {
    const text = paragraphFor(FIXTURE)

    expect(text).toContain('would cost $50,000 a year')
    expect(text).toContain('first-year cost of this hire is $150,000 rather than $100,000')
  })

  it('states the ceiling and that it falls below market', () => {
    const text = paragraphFor(FIXTURE)

    expect(text).toContain('highest offer that would flag nobody is $87,619')
    expect(text).toContain('below 50th percentile of $104,000')
    expect(text).toContain('not possible here without also spending on the existing team')
  })

  it('closes by saying what it could not assess', () => {
    const text = paragraphFor(FIXTURE)

    expect(text).toContain('1 person in the grade has no hire date on file')
    expect(text).toContain('1 person joined too recently to compare fairly')
    expect(text).toContain('reported but not counted in the figures above')
  })

  it('says plainly when there is no compression to report', () => {
    const clean = { ...FIXTURE, offer: { ...OFFER, baseSalary: 80_000 } }
    const text = paragraphFor(clean)

    expect(text).toContain('does not sit close enough to anyone')
    expect(text).not.toContain('would cost')
  })

  it('reports an offer above the range maximum', () => {
    const high = { ...FIXTURE, offer: { ...OFFER, baseSalary: 130_000 } }

    expect(paragraphFor(high)).toContain('above the top of the range and would need an exception')
  })

  it('reports the blocked amount when money cannot close the gap', () => {
    const high = { ...FIXTURE, offer: { ...OFFER, baseSalary: 125_000 } }
    const text = paragraphFor(high)

    expect(text).toContain('cannot be paid without going over')
    expect(text).toContain('money alone does not close it')
  })

  it('says when no offer inside the range is clean', () => {
    const broken = {
      ...FIXTURE,
      incumbents: TEAM.map((p) => (p.id === 'E1' ? { ...p, baseSalary: 78_000 } : p)),
    }
    const text = paragraphFor(broken)

    expect(text).toContain('No offer inside this range avoids the problem')
    expect(text).toContain('lowering the offer will not fix that')
  })

  it('reads as prose on the sample scenario, with no placeholders left in', () => {
    const text = paragraphFor(sampleScenario(), '2024-11-01')

    expect(text).not.toMatch(/undefined|NaN|\[object|null/)
    expect(text).toMatch(/^An offer of \$112,000 for Req 4412/)
    expect(text.split('. ').length).toBeGreaterThanOrEqual(4)
    // "3 mores" — pluralizing a word that has no plural.
    expect(text).not.toMatch(/\bmores\b/)
  })

  it('states plainly when the grade has no range loaded', () => {
    const noGrade = { ...FIXTURE, offer: { ...OFFER, gradeId: 'G9' } }

    expect(paragraphFor(noGrade)).toContain('which has no salary range loaded, so it cannot be placed')
  })
})
