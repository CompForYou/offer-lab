import { describe, it, expect } from 'vitest'
import {
  serializeScenario,
  parseScenarioFile,
  scenarioFileName,
  SCENARIO_FILE_VERSION,
} from './scenario-file'
import { runOffer } from './run-offer'
import { sampleScenario } from '../data/sample-team'

describe('serializeScenario and parseScenarioFile', () => {
  it('makes a round trip without changing anything', () => {
    // Adoption condition 8.1: save the team once, drop the file back tomorrow.
    const original = sampleScenario()
    const parsed = parseScenarioFile(serializeScenario(original))

    expect(parsed.errors).toHaveLength(0)
    expect(parsed.scenario).toEqual(original)
  })

  it('produces identical findings after a round trip', () => {
    // The milestone test: reload and reach an identical screen.
    const original = sampleScenario()
    const reloaded = parseScenarioFile(serializeScenario(original)).scenario

    expect(runOffer(reloaded!)).toEqual(runOffer(original))
  })

  it('writes readable, versioned JSON', () => {
    const text = serializeScenario(sampleScenario(), '2024-11-01T09:00:00.000Z')
    const file = JSON.parse(text)

    expect(file.kind).toBe('offer-lab-scenario')
    expect(file.version).toBe(SCENARIO_FILE_VERSION)
    expect(file.savedAt).toBe('2024-11-01T09:00:00.000Z')
    // Indented so a comp team can open the artefact the tool produced.
    expect(text).toContain('\n  ')
  })

  it('keeps grouping attributes across the round trip', () => {
    const scenario = sampleScenario()
    scenario.incumbents = [
      { ...scenario.incumbents[0], attributes: { Department: 'Finance' } },
    ]
    const parsed = parseScenarioFile(serializeScenario(scenario))

    expect(parsed.scenario?.incumbents[0].attributes).toEqual({ Department: 'Finance' })
  })
})

describe('parseScenarioFile refusals', () => {
  it('refuses text that is not JSON', () => {
    const result = parseScenarioFile('this is not a scenario')

    expect(result.scenario).toBeNull()
    expect(result.errors[0].message).toContain('not valid JSON')
  })

  it('refuses a Merit Lab scenario by name', () => {
    const result = parseScenarioFile(
      JSON.stringify({ kind: 'merit-lab-scenario', version: 1, scenario: {} }),
    )

    expect(result.scenario).toBeNull()
    expect(result.errors[0].message).toContain('Merit Lab scenario')
  })

  it('refuses a file written by a newer version', () => {
    const text = serializeScenario(sampleScenario())
    const bumped = JSON.parse(text)
    bumped.version = SCENARIO_FILE_VERSION + 1

    const result = parseScenarioFile(JSON.stringify(bumped))
    expect(result.scenario).toBeNull()
    expect(result.errors[0].message).toContain('newer version')
  })

  it('refuses settings that are missing a threshold rather than defaulting it', () => {
    // A quietly defaulted threshold would change the findings without the user
    // changing anything, and they would have no way to tell.
    const file = JSON.parse(serializeScenario(sampleScenario()))
    delete file.scenario.settings.peerCompressionThreshold

    const result = parseScenarioFile(JSON.stringify(file))
    expect(result.scenario).toBeNull()
    expect(result.errors[0].message).toContain('peerCompressionThreshold')
  })

  it('refuses an unknown remediation rule', () => {
    const file = JSON.parse(serializeScenario(sampleScenario()))
    file.scenario.settings.remediationTarget = 'somethingElse'

    expect(parseScenarioFile(JSON.stringify(file)).scenario).toBeNull()
  })

  it('refuses a scenario with no structure', () => {
    const file = JSON.parse(serializeScenario(sampleScenario()))
    file.scenario.grades = []

    const result = parseScenarioFile(JSON.stringify(file))
    expect(result.scenario).toBeNull()
    expect(result.errors[0].message).toContain('no usable grades')
  })

  it('refuses an offer with no salary', () => {
    const file = JSON.parse(serializeScenario(sampleScenario()))
    delete file.scenario.offer.baseSalary

    expect(parseScenarioFile(JSON.stringify(file)).scenario).toBeNull()
  })
})

describe('parseScenarioFile tolerances', () => {
  it('loads a file with one broken row, and says how many were dropped', () => {
    const file = JSON.parse(serializeScenario(sampleScenario()))
    const total = file.scenario.incumbents.length
    file.scenario.incumbents.push({ id: '', gradeId: 'G4' })

    const result = parseScenarioFile(JSON.stringify(file))
    expect(result.scenario?.incumbents).toHaveLength(total)
    expect(result.warnings.some((w) => w.message.includes('could not be read'))).toBe(true)
  })

  it('warns when an incumbent references a grade the structure does not have', () => {
    const file = JSON.parse(serializeScenario(sampleScenario()))
    file.scenario.incumbents[0].gradeId = 'G9'

    const result = parseScenarioFile(JSON.stringify(file))
    expect(result.scenario).not.toBeNull()
    expect(result.warnings.some((w) => w.message.includes('G9'))).toBe(true)
  })

  it('warns when the offer references a missing grade', () => {
    const file = JSON.parse(serializeScenario(sampleScenario()))
    file.scenario.offer.gradeId = 'G9'

    const result = parseScenarioFile(JSON.stringify(file))
    expect(result.scenario).not.toBeNull()
    expect(result.warnings.some((w) => w.message.includes('G9'))).toBe(true)
  })

  it('names an untitled scenario rather than leaving it blank', () => {
    const file = JSON.parse(serializeScenario(sampleScenario()))
    file.scenario.name = ''

    expect(parseScenarioFile(JSON.stringify(file)).scenario?.name).toBe('Untitled scenario')
  })
})

describe('scenarioFileName', () => {
  it('sorts by date and says what it is', () => {
    const name = scenarioFileName(sampleScenario(), new Date('2024-11-01T00:00:00.000Z'))

    expect(name).toBe('offer-lab-sample-team-req-4412-2024-11-01.json')
  })

  it('survives a name with no usable characters', () => {
    const scenario = { ...sampleScenario(), name: '///' }
    const name = scenarioFileName(scenario, new Date('2024-11-01T00:00:00.000Z'))

    expect(name).toBe('offer-lab-scenario-2024-11-01.json')
  })
})
