import type { OfferSettings } from '../types/domain'
import type { IncumbentView } from './incumbent-view'

/**
 * Peer compression — the offer against the people already in its grade.
 * docs/SPEC.md section 7.4.
 */

export type PeerStatus = 'inverted' | 'compressed' | 'clear'

export interface PeerFinding {
  incumbentId: string
  fteSalary: number
  actualSalary: number
  /**
   * (incumbentFte - offerFte) / offerFte.
   *
   * THE DENOMINATOR IS THE OFFER, everywhere in this tool. The offer is the
   * variable under the practitioner's control and the thing on the slider, so
   * holding the denominator fixed keeps every gap on screen comparable as it
   * moves. Merit Lab divides by the lower salary instead, which makes the same
   * pair of salaries read 4.00% here and 3.85% there. That difference is stated
   * in the interface rather than left to be discovered.
   */
  peerGap: number
  status: PeerStatus
  tenureMonths: number | null
  tenureKnown: boolean
  tenureQualified: boolean
  /** Known tenure, but below the gate. */
  recentHire: boolean
  /** In the zone AND tenure-qualified. Only these are costed. */
  flagged: boolean
}

export interface PeerCompressionSummary {
  /** Every comparable incumbent in the offer's grade, in the input order. */
  findings: PeerFinding[]
  flagged: PeerFinding[]

  invertedCount: number
  compressedCount: number
  clearCount: number

  /**
   * The three standing counts. These are permanent on-screen figures, not
   * drill-downs: a gate that shrinks the population invisibly is how a tool
   * starts lying about how much it looked at.
   */
  recentHiresInZone: number
  gateExcluded: number
  tenureUnknown: number
}

/**
 * Classify every peer against the offer.
 *
 * A finding is FLAGGED only when it is in the zone (inverted or compressed) and
 * the incumbent's tenure qualifies. Someone hired last month sitting near a new
 * hire is not compression — it is two people priced by the same market in the
 * same quarter, and flagging it trains people to ignore the flags.
 *
 * Nobody is dropped. Recent hires and people with no hire date appear in
 * `findings` with their status, marked and counted, never flagged.
 */
export function findPeerCompression(
  peers: IncumbentView[],
  offerFte: number | null,
  settings: OfferSettings,
): PeerCompressionSummary {
  if (offerFte === null || offerFte <= 0) {
    return {
      findings: [],
      flagged: [],
      invertedCount: 0,
      compressedCount: 0,
      clearCount: 0,
      recentHiresInZone: 0,
      gateExcluded: 0,
      tenureUnknown: 0,
    }
  }

  const findings: PeerFinding[] = []

  for (const peer of peers) {
    if (peer.fteSalary === null) continue

    const peerGap = (peer.fteSalary - offerFte) / offerFte
    const status = classify(peerGap, settings.peerCompressionThreshold)
    const inZone = status !== 'clear'
    const recentHire = peer.tenureKnown && !peer.tenureQualified

    findings.push({
      incumbentId: peer.incumbent.id,
      fteSalary: peer.fteSalary,
      actualSalary: peer.actualSalary,
      peerGap,
      status,
      tenureMonths: peer.tenureMonths,
      tenureKnown: peer.tenureKnown,
      tenureQualified: peer.tenureQualified,
      recentHire,
      flagged: inZone && peer.tenureQualified,
    })
  }

  return {
    findings,
    flagged: findings.filter((finding) => finding.flagged),
    invertedCount: findings.filter((f) => f.status === 'inverted').length,
    compressedCount: findings.filter((f) => f.status === 'compressed').length,
    clearCount: findings.filter((f) => f.status === 'clear').length,

    // The case the gate is weakest against: two people hired eight months apart
    // at very different rates because the market moved between them. Real, and
    // suppressed by the gate, so it gets its own number.
    recentHiresInZone: findings.filter((f) => f.recentHire && f.status !== 'clear').length,
    // What the gate removed from consideration, whether in the zone or not.
    gateExcluded: findings.filter((f) => f.recentHire).length,
    tenureUnknown: findings.filter((f) => !f.tenureKnown).length,
  }
}

/**
 * Lower bound inclusive at zero: an incumbent paid exactly the offer is
 * compressed, not inverted. They are not paid less, so calling it inversion
 * would overstate it — but they are certainly not clear.
 */
function classify(peerGap: number, threshold: number): PeerStatus {
  if (peerGap < 0) return 'inverted'
  if (peerGap < threshold) return 'compressed'
  return 'clear'
}
