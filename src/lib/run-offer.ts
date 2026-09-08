import type { CompaRatioBand, Grade, OfferScenario } from '../types/domain'
import { DEFAULT_COMPA_RATIO_BANDS } from './compa-ratio-bands'
import { placeOffer, type OfferPlacement } from './offer-placement'
import {
  buildIncumbentViews,
  peersInOfferGrade,
  type IncumbentView,
} from './incumbent-view'
import { positionInTeam, type TeamPosition } from './team-position'
import { findLeapfrogs, type LeapfrogSummary } from './leapfrog'
import { findPeerCompression, type PeerCompressionSummary } from './peer-compression'
import {
  findVerticalCompression,
  type VerticalCompression,
} from './vertical-compression'
import { costRemediation, type RemediationSummary } from './remediation'
import { calculateOfferCeiling, type OfferCeiling } from './offer-ceiling'
import { buildCostedPaths, type CostedPath } from './costed-paths'
import { resolveAsAtDate, todayIso } from './tenure'

/**
 * One scenario, run end to end. docs/SPEC.md section 7.
 *
 * Everything on screen derives from this single call, so every figure the
 * practitioner sees came from the same population and the same tenure date. The
 * failure this prevents is the one that destroys trust: two numbers on the same
 * screen computed over slightly different sets of people.
 */
export interface OfferResults {
  asAtDate: string
  offerGrade: Grade | undefined
  views: IncumbentView[]
  placement: OfferPlacement
  teamPosition: TeamPosition
  leapfrog: LeapfrogSummary
  peerCompression: PeerCompressionSummary
  vertical: VerticalCompression
  remediation: RemediationSummary
  ceiling: OfferCeiling
  paths: CostedPath[]

  /** Team-wide data-quality counts, for the standing figures on screen. */
  teamHeadcount: number
  teamTenureUnknown: number
  teamGateExcluded: number
  /** Incumbents whose grade id matches no grade in the structure. */
  orphanedIncumbents: number
}

export function runOffer(
  scenario: OfferScenario,
  bands: CompaRatioBand[] = DEFAULT_COMPA_RATIO_BANDS,
  today: string = todayIso(),
): OfferResults {
  const { incumbents, grades, offer, settings } = scenario

  const asAtDate = resolveAsAtDate(offer.startDate, today)
  const offerGrade = grades.find((grade) => grade.id === offer.gradeId)

  const views = buildIncumbentViews(incumbents, grades, offer, settings, asAtDate)
  const peers = peersInOfferGrade(views)

  const placement = placeOffer(offer, offerGrade, bands)
  const offerFte = placement.offerFte

  const teamPosition = positionInTeam(peers, offerFte, offerGrade?.mid)
  const leapfrog = findLeapfrogs(views, offerFte, settings)
  const peerCompression = findPeerCompression(peers, offerFte, settings)
  const vertical = findVerticalCompression(views, offer, grades, offerFte, settings)

  // The flagged population is the peer-compression flags plus the grade
  // inversions. Both are people whose pay the offer has made indefensible; they
  // differ only in which grade they sit in, which is exactly what the `auto`
  // remediation rule keys off.
  const flaggedIds = new Set([
    ...peerCompression.flagged.map((finding) => finding.incumbentId),
    ...leapfrog.gradeInversions
      .filter((row) => row.tenureQualified)
      .map((row) => row.incumbentId),
  ])
  const flagged = views.filter((view) => flaggedIds.has(view.incumbent.id))

  const remediationInput = {
    flagged,
    offerFte: offerFte ?? 0,
    offerActual: placement.offerActual,
    offerCompaRatio: placement.compaRatio,
    offerGradeId: offer.gradeId,
    peerCompressionThreshold: settings.peerCompressionThreshold,
    target: settings.remediationTarget,
    gradePayroll: teamPosition.gradePayroll,
    grades,
  }
  const remediation = costRemediation(remediationInput)

  // Path C costs only the people paid LESS than the offer.
  const invertedOnly = flagged.filter(
    (view) => offerFte !== null && view.fteSalary !== null && view.fteSalary < offerFte,
  )
  const inversionRemediation = costRemediation({
    ...remediationInput,
    flagged: invertedOnly,
  })

  const ceiling = calculateOfferCeiling(
    peers,
    offerGrade,
    vertical.comparatorFteSalary,
    settings,
    offer.marketReference,
  )

  const paths = buildCostedPaths({
    offerActual: placement.offerActual,
    offerFte: offer.fte,
    fullRemediationCost: remediation.remediationCost,
    fullRemediationHeadcount: remediation.remediationHeadcount,
    inversionRemediationCost: inversionRemediation.remediationCost,
    inversionRemediationHeadcount: inversionRemediation.remediationHeadcount,
    gatedCeiling: ceiling.gatedCeiling,
    offerFteSalary: offerFte,
    marketReference: offer.marketReference,
  })

  return {
    asAtDate,
    offerGrade,
    views,
    placement,
    teamPosition,
    leapfrog,
    peerCompression,
    vertical,
    remediation,
    ceiling,
    paths,

    teamHeadcount: views.length,
    teamTenureUnknown: views.filter((view) => !view.tenureKnown).length,
    teamGateExcluded: views.filter((view) => view.tenureKnown && !view.tenureQualified)
      .length,
    orphanedIncumbents: views.filter((view) => view.grade === undefined).length,
  }
}
