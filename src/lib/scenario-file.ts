import type {
  Grade,
  Incumbent,
  Offer,
  OfferScenario,
  OfferSettings,
  RemediationTarget,
} from '../types/domain'
import type { ImportIssue } from './import-issue'

/**
 * Saving a scenario to a file and reading it back. docs/SPEC.md section 8.1.
 *
 * This is the feature that decides whether the tool gets used twice. Nothing is
 * persisted by default — no localStorage, no account, no server — so without a
 * file, a practitioner re-pastes forty-one people every morning and stops after
 * the second time. Writing a file is the whole of the persistence story, and it
 * keeps the data on their machine, which is the point.
 *
 * The file is JSON, readable in any text editor. A comp team that cannot open
 * the artefact a tool produced will not trust the tool.
 */

export const SCENARIO_FILE_VERSION = 1

export interface ScenarioFile {
  /** Identifies the file as ours, so a Merit Lab scenario is refused clearly. */
  kind: 'offer-lab-scenario'
  version: number
  /** When it was written, for the reader's benefit only. Never used in maths. */
  savedAt: string
  scenario: OfferScenario
}

export interface ScenarioParseResult {
  scenario: OfferScenario | null
  errors: ImportIssue[]
  warnings: ImportIssue[]
}

export function serializeScenario(
  scenario: OfferScenario,
  savedAt: string = new Date().toISOString(),
): string {
  const file: ScenarioFile = {
    kind: 'offer-lab-scenario',
    version: SCENARIO_FILE_VERSION,
    savedAt,
    scenario,
  }
  // Indented: the file is meant to be opened and read, not just re-imported.
  return JSON.stringify(file, null, 2)
}

/** A filename that sorts by date and says what it is. */
export function scenarioFileName(
  scenario: OfferScenario,
  savedAt: Date = new Date(),
): string {
  const date = savedAt.toISOString().slice(0, 10)
  const slug = (scenario.name || 'scenario')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `offer-lab-${slug || 'scenario'}-${date}.json`
}

/**
 * Read a scenario file.
 *
 * Every field is checked. A file that is almost right loads with warnings and a
 * usable scenario; a file that is wrong in a way that would change the numbers
 * is refused with a reason. What must never happen is a silent default: a
 * missing threshold quietly becoming 5% would produce findings the user did not
 * ask for and cannot account for.
 */
export function parseScenarioFile(text: string): ScenarioParseResult {
  const errors: ImportIssue[] = []
  const warnings: ImportIssue[] = []
  const fail = (message: string): ScenarioParseResult => ({
    scenario: null,
    errors: [{ row: null, column: null, message }],
    warnings,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail('That file is not valid JSON. It may not be a scenario file.')
  }

  if (!isRecord(parsed)) return fail('That file does not contain a scenario.')

  if (parsed.kind === 'merit-lab-scenario') {
    return fail(
      'That is a Merit Lab scenario. Offer Lab cannot read one yet — load the team and structure separately.',
    )
  }
  if (parsed.kind !== 'offer-lab-scenario') {
    return fail('That file is not an Offer Lab scenario.')
  }
  if (typeof parsed.version !== 'number') {
    return fail('That scenario file has no version and cannot be read safely.')
  }
  if (parsed.version > SCENARIO_FILE_VERSION) {
    return fail(
      `That scenario was written by a newer version of Offer Lab (file version ${parsed.version}, this version reads ${SCENARIO_FILE_VERSION}).`,
    )
  }

  const raw = parsed.scenario
  if (!isRecord(raw)) return fail('That scenario file has no scenario in it.')

  const grades = readGrades(raw.grades, errors)
  if (grades === null) return { scenario: null, errors, warnings }

  const incumbents = readIncumbents(raw.incumbents, grades, errors, warnings)
  if (incumbents === null) return { scenario: null, errors, warnings }

  const offer = readOffer(raw.offer, errors)
  if (offer === null) return { scenario: null, errors, warnings }

  const settings = readSettings(raw.settings, errors)
  if (settings === null) return { scenario: null, errors, warnings }

  if (!grades.some((grade) => grade.id === offer.gradeId)) {
    warnings.push({
      row: null,
      column: null,
      message: `The offer is in grade "${offer.gradeId}", which is not in the saved structure.`,
    })
  }

  return {
    scenario: {
      name: typeof raw.name === 'string' && raw.name !== '' ? raw.name : 'Untitled scenario',
      grades,
      incumbents,
      offer,
      settings,
    },
    errors,
    warnings,
  }
}

function readGrades(value: unknown, errors: ImportIssue[]): Grade[] | null {
  if (!Array.isArray(value)) {
    errors.push({ row: null, column: null, message: 'The scenario has no salary structure.' })
    return null
  }

  const grades: Grade[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    if (typeof entry.id !== 'string' || entry.id === '') continue
    if (!areFiniteNumbers(entry.min, entry.mid, entry.max, entry.order)) continue

    grades.push({
      id: entry.id,
      name: typeof entry.name === 'string' ? entry.name : entry.id,
      order: entry.order as number,
      min: entry.min as number,
      mid: entry.mid as number,
      max: entry.max as number,
    })
  }

  if (grades.length === 0) {
    errors.push({ row: null, column: null, message: 'The saved structure has no usable grades.' })
    return null
  }
  return grades
}

function readIncumbents(
  value: unknown,
  grades: Grade[],
  errors: ImportIssue[],
  warnings: ImportIssue[],
): Incumbent[] | null {
  if (!Array.isArray(value)) {
    errors.push({ row: null, column: null, message: 'The scenario has no team.' })
    return null
  }

  const gradeIds = new Set(grades.map((grade) => grade.id))
  const incumbents: Incumbent[] = []
  let skipped = 0

  for (const entry of value) {
    if (!isRecord(entry)) { skipped++; continue }
    if (typeof entry.id !== 'string' || entry.id === '') { skipped++; continue }
    if (typeof entry.gradeId !== 'string') { skipped++; continue }
    if (typeof entry.baseSalary !== 'number' || !Number.isFinite(entry.baseSalary)) {
      skipped++
      continue
    }

    const fte = typeof entry.fte === 'number' && entry.fte > 0 && entry.fte <= 1 ? entry.fte : 1

    const incumbent: Incumbent = {
      id: entry.id,
      gradeId: entry.gradeId,
      baseSalary: entry.baseSalary,
      fte,
    }
    if (typeof entry.hireDate === 'string') incumbent.hireDate = entry.hireDate
    if (typeof entry.performanceRating === 'string') {
      incumbent.performanceRating = entry.performanceRating
    }
    if (typeof entry.managerId === 'string') incumbent.managerId = entry.managerId
    if (isRecord(entry.attributes)) {
      incumbent.attributes = Object.fromEntries(
        Object.entries(entry.attributes).map(([key, val]) => [key, String(val)]),
      )
    }

    if (!gradeIds.has(incumbent.gradeId)) {
      warnings.push({
        row: null,
        column: null,
        message: `"${incumbent.id}" is in grade "${incumbent.gradeId}", which is not in the saved structure.`,
      })
    }

    incumbents.push(incumbent)
  }

  if (skipped > 0) {
    warnings.push({
      row: null,
      column: null,
      message: `${skipped} saved ${skipped === 1 ? 'row was' : 'rows were'} incomplete and could not be read.`,
    })
  }
  return incumbents
}

function readOffer(value: unknown, errors: ImportIssue[]): Offer | null {
  if (!isRecord(value)) {
    errors.push({ row: null, column: null, message: 'The scenario has no offer.' })
    return null
  }
  if (typeof value.gradeId !== 'string' || value.gradeId === '') {
    errors.push({ row: null, column: null, message: 'The saved offer has no grade.' })
    return null
  }
  if (typeof value.baseSalary !== 'number' || !Number.isFinite(value.baseSalary)) {
    errors.push({ row: null, column: null, message: 'The saved offer has no salary.' })
    return null
  }

  const offer: Offer = {
    label: typeof value.label === 'string' ? value.label : 'Offer',
    gradeId: value.gradeId,
    baseSalary: value.baseSalary,
    fte: typeof value.fte === 'number' && value.fte > 0 && value.fte <= 1 ? value.fte : 1,
  }
  if (typeof value.startDate === 'string') offer.startDate = value.startDate
  if (typeof value.managerId === 'string') offer.managerId = value.managerId
  if (typeof value.marketReference === 'number' && Number.isFinite(value.marketReference)) {
    offer.marketReference = value.marketReference
  }
  if (typeof value.marketReferenceLabel === 'string') {
    offer.marketReferenceLabel = value.marketReferenceLabel
  }
  return offer
}

const REMEDIATION_TARGETS: RemediationTarget[] = [
  'auto', 'parityWithOffer', 'restoreDifferential', 'compaRatioParity',
]

/**
 * Settings are required in full.
 *
 * A missing threshold could be defaulted, and that is exactly what must not
 * happen: the findings would change without the user having changed anything,
 * and they would have no way to tell. A file that cannot say what thresholds
 * produced its numbers is not a scenario.
 */
function readSettings(value: unknown, errors: ImportIssue[]): OfferSettings | null {
  if (!isRecord(value)) {
    errors.push({ row: null, column: null, message: 'The scenario has no settings.' })
    return null
  }

  const numeric = (
    field: 'peerCompressionThreshold' | 'verticalDifferentialThreshold' | 'tenureQualifyingMonths',
  ): number | null => {
    const raw = value[field]
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      errors.push({
        row: null,
        column: null,
        message: `The saved settings have no usable ${field}. Without it the findings would differ from the ones that were saved.`,
      })
      return null
    }
    return raw
  }

  const peer = numeric('peerCompressionThreshold')
  const vertical = numeric('verticalDifferentialThreshold')
  const tenure = numeric('tenureQualifyingMonths')
  if (peer === null || vertical === null || tenure === null) return null

  const target = value.remediationTarget
  if (typeof target !== 'string' || !REMEDIATION_TARGETS.includes(target as RemediationTarget)) {
    errors.push({
      row: null,
      column: null,
      message: 'The saved settings have no usable remediation rule.',
    })
    return null
  }

  const settings: OfferSettings = {
    peerCompressionThreshold: peer,
    verticalDifferentialThreshold: vertical,
    tenureQualifyingMonths: tenure,
    remediationTarget: target as RemediationTarget,
    strongRatings: Array.isArray(value.strongRatings)
      ? value.strongRatings.filter((rating): rating is string => typeof rating === 'string')
      : [],
  }
  if (typeof value.currency === 'string') settings.currency = value.currency
  if (typeof value.locale === 'string') settings.locale = value.locale
  return settings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function areFiniteNumbers(...values: unknown[]): boolean {
  return values.every((value) => typeof value === 'number' && Number.isFinite(value))
}
