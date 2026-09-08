import type { Grade, Offer, OfferSettings } from '../types/domain'
import { Panel } from './Panel'
import { formatPercent } from '../lib/format'

/**
 * The offer, and the thresholds the findings are judged against.
 *
 * Every control writes straight to state on change. There is no Calculate
 * button and no form to submit: the governing rule in SPEC section 10 is that
 * the consequences move as the offer moves.
 */
export function OfferPanel({
  offer,
  grades,
  settings,
  onOfferChange,
  onSettingsChange,
}: {
  offer: Offer
  grades: Grade[]
  settings: OfferSettings
  onOfferChange: (offer: Offer) => void
  onSettingsChange: (settings: OfferSettings) => void
}) {
  const ordered = [...grades].sort((a, b) => a.order - b.order)

  return (
    <Panel title="Offer" aside={offer.label}>
      <div className="space-y-3">
        <Field label="Reference">
          <input
            className={inputClass}
            value={offer.label}
            onChange={(event) => onOfferChange({ ...offer, label: event.target.value })}
            aria-label="Offer reference"
          />
        </Field>
        {/* Stated where it is acted on, not only in the documentation. */}
        <p className="text-[11px] leading-snug text-neutral-600">
          A requisition number, never a candidate’s name. This tool does not take names.
        </p>

        <Field label="Grade">
          <select
            className={inputClass}
            value={offer.gradeId}
            onChange={(event) => onOfferChange({ ...offer, gradeId: event.target.value })}
            aria-label="Offer grade"
          >
            {ordered.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Base salary">
          <NumberInput
            value={offer.baseSalary}
            onChange={(baseSalary) => onOfferChange({ ...offer, baseSalary })}
            ariaLabel="Offer base salary"
          />
        </Field>

        <Field label="Market reference">
          <NumberInput
            value={offer.marketReference ?? 0}
            onChange={(marketReference) =>
              onOfferChange({
                ...offer,
                marketReference: marketReference > 0 ? marketReference : undefined,
              })
            }
            ariaLabel="Market reference"
          />
        </Field>

        <div className="border-t border-neutral-800 pt-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
            Thresholds
          </div>
          <div className="space-y-2">
            <Slider
              label="Peer compression"
              value={settings.peerCompressionThreshold}
              min={0}
              max={0.2}
              step={0.005}
              format={(value) => formatPercent(value, 1)}
              onChange={(peerCompressionThreshold) =>
                onSettingsChange({ ...settings, peerCompressionThreshold })
              }
            />
            <Slider
              label="Vertical differential"
              value={settings.verticalDifferentialThreshold}
              min={0}
              max={0.4}
              step={0.01}
              format={(value) => formatPercent(value, 0)}
              onChange={(verticalDifferentialThreshold) =>
                onSettingsChange({ ...settings, verticalDifferentialThreshold })
              }
            />
            <Slider
              label="Tenure gate"
              value={settings.tenureQualifyingMonths}
              min={0}
              max={36}
              step={1}
              format={(value) => `${value} months`}
              onChange={(tenureQualifyingMonths) =>
                onSettingsChange({ ...settings, tenureQualifyingMonths })
              }
            />
          </div>
        </div>

        <Field label="Fix by">
          <select
            className={inputClass}
            value={settings.remediationTarget}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                remediationTarget: event.target.value as OfferSettings['remediationTarget'],
              })
            }
            aria-label="Remediation rule"
          >
            <option value="auto">Auto — differential in grade, compa-ratio across</option>
            <option value="restoreDifferential">Restoring the differential</option>
            <option value="parityWithOffer">Parity with the offer</option>
            <option value="compaRatioParity">Compa-ratio parity</option>
          </select>
        </Field>
      </div>
    </Panel>
  )
}

const inputClass =
  'w-full border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 focus:border-neutral-600 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * A salary field that lets the user type freely.
 *
 * The raw string is held while they type so that clearing the box does not
 * snap it back to zero mid-edit; state only takes a value once it parses.
 */
function NumberInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}) {
  return (
    <input
      className={inputClass}
      inputMode="numeric"
      value={value === 0 ? '' : String(value)}
      placeholder="—"
      aria-label={ariaLabel}
      onChange={(event) => {
        const digits = event.target.value.replace(/[^0-9.]/g, '')
        const parsed = digits === '' ? 0 : Number(digits)
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
    />
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs text-neutral-400">
        {label}
        <span className="text-neutral-200">{format(value)}</span>
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-neutral-400"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
