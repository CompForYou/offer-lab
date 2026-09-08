import type { Offer } from '../types/domain'
import type { OfferResults } from '../lib/run-offer'
import { Panel, Figure, Disclosure } from './Panel'
import {
  formatCompaRatio,
  formatCurrency,
  formatPercent,
  formatPercentSigned,
  formatCount,
  pluralize,
  NO_VALUE,
} from '../lib/format'

/**
 * The right-hand column: what the offer does.
 *
 * Every count opens into the rows behind it, with the arithmetic visible. A
 * comp analyst asked "why is that seven?" has to be able to answer in one click,
 * in front of the hiring manager. See docs/SPEC.md section 10.
 */
export function ConsequencesColumn({
  results,
  offer,
}: {
  results: OfferResults
  offer: Offer
}) {
  return (
    <div className="space-y-3">
      <PlacementPanel results={results} />
      <FindingsPanel results={results} />
      <CostPanel results={results} offer={offer} />
      <PathsPanel results={results} />
    </div>
  )
}

function PlacementPanel({ results }: { results: OfferResults }) {
  const { placement, teamPosition, offerGrade } = results

  return (
    <Panel title="Placement" aside={offerGrade?.name ?? 'no grade loaded'}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Compa-ratio" value={formatCompaRatio(placement.compaRatio)} />
        <Figure
          label="Penetration"
          value={placement.rangePenetration === null ? NO_VALUE : formatPercent(placement.rangePenetration, 0)}
        />
        <Figure
          label="Rank in grade"
          value={
            teamPosition.offerRank === null
              ? NO_VALUE
              : `${ordinal(teamPosition.offerRank)} of ${teamPosition.rankOf}`
          }
        />
        <Figure
          label="Paid more than"
          value={`${formatCount(teamPosition.countPaidLess)} of ${formatCount(teamPosition.gradeHeadcount)}`}
        />
      </div>

      {(placement.aboveMax || placement.belowMin) && (
        <p className="mt-3 text-xs text-amber-300">
          {placement.aboveMax
            ? `Above the range maximum by ${formatPercent(placement.vsMax ?? 0, 1)}. Red-circled on arrival.`
            : `Below the range minimum by ${formatPercent(Math.abs(placement.vsMin ?? 0), 1)}. Green-circled on arrival.`}
        </p>
      )}
    </Panel>
  )
}

function FindingsPanel({ results }: { results: OfferResults }) {
  const { peerCompression, leapfrog, vertical } = results
  const inverted = peerCompression.flagged.filter((f) => f.status === 'inverted')
  const compressed = peerCompression.flagged.filter((f) => f.status === 'compressed')

  return (
    <Panel
      title="Consequences"
      aside={`${formatCount(peerCompression.findings.length)} in grade`}
    >
      <div className="space-y-3 text-xs">
        <Disclosure
          count={inverted.length}
          summary={
            <span>
              <span className="text-rose-300">{formatCount(inverted.length)}</span> paid less
              than the offer, and longer tenured
            </span>
          }
        >
          <FindingRows results={results} rows={inverted} />
        </Disclosure>

        <Disclosure
          count={compressed.length}
          summary={
            <span>
              <span className="text-amber-300">{formatCount(compressed.length)}</span> inside
              the compression threshold
            </span>
          }
        >
          <FindingRows results={results} rows={compressed} />
        </Disclosure>

        <Disclosure
          count={leapfrog.gradeInversions.length}
          summary={
            <span>
              <span className="text-rose-300">
                {formatCount(leapfrog.gradeInversions.length)}
              </span>{' '}
              in a higher grade already paid less than the offer
            </span>
          }
        >
          <ul className="space-y-1 text-neutral-400">
            {leapfrog.gradeInversions.map((row) => (
              <li key={row.incumbentId}>
                <span className="text-neutral-200">{row.incumbentId}</span> · {row.gradeId} ·{' '}
                {formatCurrency(row.fteSalary)} · {formatPercent(row.shortfall, 1)} below the
                offer
              </li>
            ))}
          </ul>
        </Disclosure>

        <div className="border-t border-neutral-800 pt-3">
          <VerticalLine results={results} />
        </div>

        {/* The standing counts. Permanent, so the gate never shrinks the
            population invisibly. SPEC section 7.4. */}
        <div className="border-t border-neutral-800 pt-3 text-[11px] leading-relaxed text-neutral-500">
          <div>
            {pluralize(peerCompression.gateExcluded, 'person', 'people')} in the grade{' '}
            {peerCompression.gateExcluded === 1 ? 'is' : 'are'} below the tenure gate and{' '}
            {peerCompression.gateExcluded === 1 ? 'is' : 'are'} never flagged
            {peerCompression.recentHiresInZone > 0 && (
              <> — {formatCount(peerCompression.recentHiresInZone)} of them sit inside the zone</>
            )}
            .
          </div>
          <div>
            {pluralize(peerCompression.tenureUnknown, 'person', 'people')}{' '}
            {peerCompression.tenureUnknown === 1 ? 'has' : 'have'} no hire date, so{' '}
            {peerCompression.tenureUnknown === 1 ? 'their' : 'their'} tenure is unknown.
          </div>
          {vertical.source === 'gradeAboveMedian' && (
            <div>
              The level above is the median of {vertical.comparatorGradeId} over{' '}
              {pluralize(vertical.comparatorHeadcount ?? 0, 'person', 'people')}, not a named
              manager.
            </div>
          )}
        </div>

        <p className="border-t border-neutral-800 pt-3 text-[11px] leading-snug text-neutral-600">
          These findings come from pay, grade and tenure. The tool does not know scope,
          criticality, or who is leaving in March. A flag means two salaries are close and one
          person has been here longer — not that the pay is wrong.
        </p>
      </div>
    </Panel>
  )
}

function VerticalLine({ results }: { results: OfferResults }) {
  const { vertical } = results

  if (vertical.verticalGap === null) {
    return (
      <div className="text-neutral-500">
        No comparator for the level above, so vertical compression is not assessed.
      </div>
    )
  }

  const who =
    vertical.source === 'manager'
      ? `the named manager ${vertical.comparatorId}`
      : `the ${vertical.comparatorGradeId} median`

  return (
    <div className={vertical.flagged ? 'text-amber-300' : 'text-neutral-400'}>
      {vertical.offerExceedsComparator
        ? `The offer is ${formatPercent(Math.abs(vertical.verticalGap), 1)} above ${who}.`
        : `${formatPercentSigned(vertical.verticalGap, 1)} differential to ${who}.`}
      {vertical.flagged && !vertical.offerExceedsComparator && ' Below the differential you set.'}
    </div>
  )
}

function FindingRows({
  results,
  rows,
}: {
  results: OfferResults
  rows: OfferResults['peerCompression']['flagged']
}) {
  const costById = new Map(
    results.remediation.rows.map((row) => [row.incumbentId, row]),
  )

  return (
    <ul className="space-y-1 text-neutral-400">
      {rows.map((row) => {
        const cost = costById.get(row.incumbentId)
        return (
          <li key={row.incumbentId}>
            <span className="text-neutral-200">{row.incumbentId}</span> ·{' '}
            {formatCurrency(row.fteSalary)}
            {row.fteSalary !== row.actualSalary && ' full-time equivalent'} ·{' '}
            {formatPercentSigned(row.peerGap, 1)} ·{' '}
            {row.tenureMonths === null ? 'tenure unknown' : `${row.tenureMonths} months`}
            {cost !== undefined && cost.adjustmentCost > 0 && (
              <> · fix {formatCurrency(cost.adjustmentCost)}</>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function CostPanel({ results, offer }: { results: OfferResults; offer: Offer }) {
  const { remediation, ceiling } = results
  const ceilingActual = ceiling.gatedCeiling === null ? null : ceiling.gatedCeiling * offer.fte
  const ungatedActual =
    ceiling.ungatedCeiling === null ? null : ceiling.ungatedCeiling * offer.fte

  return (
    <Panel title="Cost to fix" aside={ruleLabel(results)}>
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label="Remediation"
          value={formatCurrency(remediation.remediationCost)}
          note={`${pluralize(remediation.remediationHeadcount, 'person', 'people')} · ${formatPercent(remediation.costAsPercentOfGrade, 1)} of grade payroll`}
          tone={remediation.remediationCost > 0 ? 'attention' : 'plain'}
        />
        <Figure
          label="Total first year"
          value={formatCurrency(remediation.totalFirstYearCost)}
          note={`the offer plus what it triggers`}
          size="large"
        />
      </div>

      {remediation.blockedHeadcount > 0 && (
        <p className="mt-3 text-xs text-amber-300">
          {formatCurrency(remediation.blockedCost)} cannot be paid without going over the range
          maximum for {pluralize(remediation.blockedHeadcount, 'person', 'people')}. Money alone
          does not close that part.
        </p>
      )}

      <div className="mt-3 border-t border-neutral-800 pt-3 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-neutral-400">Highest offer that flags nobody</span>
          <span className="text-neutral-100">{formatCurrency(ceilingActual)}</span>
        </div>
        {ceiling.gateRaisesCeiling && (
          <div className="mt-1 flex items-baseline justify-between text-neutral-500">
            <span>Counting everyone, including recent hires</span>
            <span>{formatCurrency(ungatedActual)}</span>
          </div>
        )}
        {ceiling.belowGradeMin && (
          <p className="mt-2 text-amber-300">
            That is below the range minimum. No offer inside this range avoids compression — the
            team and the structure already disagree, and lowering the offer will not fix it.
          </p>
        )}
        {ceiling.belowMarket && !ceiling.belowGradeMin && offer.marketReference !== undefined && (
          <p className="mt-2 text-amber-300">
            Below {offer.marketReferenceLabel ?? 'your market reference'} of{' '}
            {formatCurrency(offer.marketReference)}. A market-competitive offer is not possible
            here without also spending on the team.
          </p>
        )}
      </div>
    </Panel>
  )
}

function PathsPanel({ results }: { results: OfferResults }) {
  return (
    <Panel title="Ways through" aside="not ranked">
      <table className="w-full text-xs">
        <tbody>
          {results.paths.map((path) => (
            <tr key={path.id} className="border-b border-neutral-800 last:border-0">
              <td className="py-1.5 pr-2 align-top text-neutral-500">{path.id}</td>
              <td className="py-1.5 pr-2 align-top text-neutral-300">
                {path.label}
                {path.belowMarketBy !== undefined && path.belowMarketBy > 0 && (
                  <span className="block text-neutral-600">
                    {formatCurrency(path.belowMarketBy)} under the market reference
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right align-top tabular-nums text-neutral-100">
                {formatCurrency(path.totalFirstYearCost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] leading-snug text-neutral-600">
        Priced, never ranked. The trade-off is yours to make and you have context this tool does
        not.
      </p>
    </Panel>
  )
}

function ruleLabel(results: OfferResults): string {
  const rules = new Set(results.remediation.rows.map((row) => row.rule))
  if (rules.size === 0) return 'nothing to fix'
  if (rules.size > 1) return 'differential in grade, compa-ratio across'
  const only = [...rules][0]
  return only === 'restoreDifferential'
    ? 'restoring the differential'
    : only === 'parityWithOffer'
      ? 'parity with the offer'
      : 'compa-ratio parity'
}

function ordinal(value: number): string {
  const remainderTen = value % 10
  const remainderHundred = value % 100
  if (remainderTen === 1 && remainderHundred !== 11) return `${value}st`
  if (remainderTen === 2 && remainderHundred !== 12) return `${value}nd`
  if (remainderTen === 3 && remainderHundred !== 13) return `${value}rd`
  return `${value}th`
}
