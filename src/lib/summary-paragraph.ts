import type { OfferResults } from './run-offer'
import type { Offer } from '../types/domain'
import {
  formatCompaRatio,
  formatCurrency,
  formatPercent,
  pluralize,
  formatCount,
} from './format'

/**
 * The finding as a paragraph somebody can paste into an email.
 * docs/SPEC.md section 8.2.
 *
 * The practitioner's actual deliverable is a message to a hiring manager. If
 * the finding cannot leave the tool, the tool is a detour on the way to writing
 * it by hand — so this produces the artefact they were going to have to write
 * anyway, with the numbers already in it.
 *
 * Plain language, no jargon that needs the glossary, no term the reader would
 * have to look up. It goes to a hiring manager, not to another comp analyst.
 *
 * Nothing is transmitted: the caller puts this on the clipboard, which is local.
 */
export function summaryParagraph(results: OfferResults, offer: Offer): string {
  const sentences: string[] = []

  sentences.push(placementSentence(results, offer))

  const compression = compressionSentence(results)
  if (compression !== null) sentences.push(compression)

  const inversion = gradeInversionSentence(results)
  if (inversion !== null) sentences.push(inversion)

  const cost = costSentence(results)
  if (cost !== null) sentences.push(cost)

  const ceiling = ceilingSentence(results, offer)
  if (ceiling !== null) sentences.push(ceiling)

  const quality = dataQualitySentence(results)
  if (quality !== null) sentences.push(quality)

  return sentences.join(' ')
}

function placementSentence(results: OfferResults, offer: Offer): string {
  const { placement, teamPosition, offerGrade } = results
  const salary = formatCurrency(placement.offerActual)
  const grade = offerGrade?.name ?? offer.gradeId

  if (placement.compaRatio === null) {
    return `An offer of ${salary} for ${offer.label} in ${grade}, which has no salary range loaded, so it cannot be placed.`
  }

  const parts = [
    `An offer of ${salary} for ${offer.label} sits at a compa-ratio of ${formatCompaRatio(placement.compaRatio)} in ${grade}`,
  ]

  if (placement.rangePenetration !== null) {
    parts.push(`, ${formatPercent(placement.rangePenetration, 0)} of the way through the range`)
  }
  if (teamPosition.gradeHeadcount > 0) {
    parts.push(
      `, and above ${teamPosition.countPaidLess} of the ${teamPosition.gradeHeadcount} people already in it`,
    )
  }
  parts.push('.')

  let sentence = parts.join('')
  if (placement.aboveMax) {
    sentence += ' It is above the top of the range and would need an exception.'
  } else if (placement.belowMin) {
    sentence += ' It is below the bottom of the range.'
  }
  return sentence
}

function compressionSentence(results: OfferResults): string | null {
  const { peerCompression } = results
  const flagged = peerCompression.flagged

  if (flagged.length === 0) {
    if (peerCompression.findings.length === 0) return null
    return 'It does not sit close enough to anyone already in the grade to create a pay compression problem.'
  }

  const inverted = flagged.filter((finding) => finding.status === 'inverted').length
  const compressed = flagged.length - inverted

  const clauses: string[] = []
  if (inverted > 0) {
    clauses.push(
      `${pluralize(inverted, 'longer-serving colleague', 'longer-serving colleagues')} would be paid less than the new hire`,
    )
  }
  if (compressed > 0) {
    // "and 2 more sit..." after an inversion clause, "2 colleagues sit..." alone.
    // "more" has no plural, so it is never handed to pluralize.
    const subject = inverted > 0
      ? `${formatCount(compressed)} more`
      : pluralize(compressed, 'colleague', 'colleagues')
    clauses.push(`${subject} ${compressed === 1 ? 'sits' : 'sit'} within touching distance of it`)
  }

  return `${capitalize(clauses.join(', and '))}.`
}

function gradeInversionSentence(results: OfferResults): string | null {
  const inversions = results.leapfrog.gradeInversions.filter((row) => row.tenureQualified)
  if (inversions.length === 0) return null

  return `${pluralize(inversions.length, 'person', 'people')} a whole grade above ${
    inversions.length === 1 ? 'is' : 'are'
  } already paid less than this offer, which the offer exposes rather than causes.`
}

function costSentence(results: OfferResults): string | null {
  const { remediation, placement } = results
  if (remediation.remediationHeadcount === 0) return null

  let sentence =
    `Bringing ${pluralize(remediation.remediationHeadcount, 'person', 'people')} back to a defensible position would cost ` +
    `${formatCurrency(remediation.remediationCost)} a year, so the first-year cost of this hire is ` +
    `${formatCurrency(remediation.totalFirstYearCost)} rather than ${formatCurrency(placement.offerActual)}.`

  if (remediation.blockedHeadcount > 0) {
    sentence +=
      ` A further ${formatCurrency(remediation.blockedCost)} cannot be paid without going over ` +
      `${remediation.blockedHeadcount === 1 ? 'that person’s' : 'those people’s'} range maximum, so money alone does not close it.`
  }
  return sentence
}

function ceilingSentence(results: OfferResults, offer: Offer): string | null {
  const { ceiling } = results
  if (ceiling.gatedCeiling === null) return null

  const ceilingActual = ceiling.gatedCeiling * offer.fte

  if (ceiling.belowGradeMin) {
    return (
      `No offer inside this range avoids the problem: the highest clean offer would be ` +
      `${formatCurrency(ceilingActual)}, which is below the bottom of the range. The team and the structure ` +
      `already disagree, and lowering the offer will not fix that.`
    )
  }

  let sentence = `The highest offer that would flag nobody is ${formatCurrency(ceilingActual)}.`

  if (ceiling.belowMarket && offer.marketReference !== undefined) {
    const label = offer.marketReferenceLabel ?? 'the market reference'
    sentence +=
      ` That is below ${label} of ${formatCurrency(offer.marketReference)}, so a market-competitive ` +
      `offer is not possible here without also spending on the existing team.`
  }
  return sentence
}

/**
 * What the tool could not see. Last, and never omitted when it applies: a
 * finding that does not say how much of the team it could not assess is a
 * finding that overstates itself.
 */
function dataQualitySentence(results: OfferResults): string | null {
  const clauses: string[] = []

  if (results.peerCompression.tenureUnknown > 0) {
    clauses.push(
      `${pluralize(results.peerCompression.tenureUnknown, 'person', 'people')} in the grade ${
        results.peerCompression.tenureUnknown === 1 ? 'has' : 'have'
      } no hire date on file`,
    )
  }
  if (results.peerCompression.gateExcluded > 0) {
    clauses.push(
      `${pluralize(results.peerCompression.gateExcluded, 'person', 'people')} joined too recently to compare fairly`,
    )
  }

  if (clauses.length === 0) return null
  return `${capitalize(clauses.join(', and '))}, so they are reported but not counted in the figures above.`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
