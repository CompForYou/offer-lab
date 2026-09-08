import { useMemo, useState } from 'react'
import type { Offer, OfferScenario, OfferSettings } from './types/domain'
import type { ImportIssue } from './lib/import-issue'
import { runOffer } from './lib/run-offer'
import { summaryParagraph } from './lib/summary-paragraph'
import { importIncumbentsFromCsv } from './lib/import-incumbents'
import {
  serializeScenario,
  parseScenarioFile,
  scenarioFileName,
} from './lib/scenario-file'
import { downloadText, readFileAsText } from './lib/download'
import { setCurrencyFormat } from './lib/format'
import { sampleScenario, SAMPLE_GRADES, DEFAULT_SETTINGS } from './data/sample-team'
import { OfferPanel } from './components/OfferPanel'
import { TeamPanel } from './components/TeamPanel'
import { ConsequencesColumn } from './components/ConsequencesColumn'
import { Panel, Button } from './components/Panel'

/**
 * One screen. Offer and team on the left, consequences on the right, both
 * visible at all times.
 *
 * There is no Calculate button and no loading state. Every figure recomputes on
 * every keystroke, which is possible only because there is no server — and it
 * is the entire reason this feels different from the software people already
 * have. See docs/SPEC.md section 10.
 */

/** An empty starting point, so the tool opens on something rather than nothing. */
function blankScenario(): OfferScenario {
  const offer: Offer = {
    label: 'Req 0000',
    gradeId: SAMPLE_GRADES[3].id,
    baseSalary: 0,
    fte: 1,
  }
  return {
    name: 'Untitled',
    incumbents: [],
    grades: SAMPLE_GRADES,
    offer,
    settings: DEFAULT_SETTINGS,
  }
}

export default function App() {
  const [scenario, setScenario] = useState<OfferScenario>(blankScenario)
  const [issues, setIssues] = useState<{ errors: ImportIssue[]; warnings: ImportIssue[] }>({
    errors: [],
    warnings: [],
  })
  const [copied, setCopied] = useState(false)

  setCurrencyFormat({
    currency: scenario.settings.currency ?? 'USD',
    locale: scenario.settings.locale ?? 'en-US',
  })

  // Everything on screen derives from this one call, so no two figures can be
  // computed over different populations or different tenure dates.
  const results = useMemo(() => runOffer(scenario), [scenario])
  const loaded = scenario.incumbents.length > 0

  const update = (next: Partial<OfferScenario>): void => {
    setScenario((current) => ({ ...current, ...next }))
    setCopied(false)
  }

  const handlePaste = (text: string): void => {
    const result = importIncumbentsFromCsv(text, {
      knownGradeIds: scenario.grades.map((grade) => grade.id),
    })
    setIssues({ errors: result.errors, warnings: result.warnings })
    if (result.incumbents.length > 0) {
      update({ incumbents: result.incumbents, name: 'Pasted team' })
    }
  }

  const handleLoadFile = async (file: File): Promise<void> => {
    const text = await readFileAsText(file)
    const result = parseScenarioFile(text)
    setIssues({ errors: result.errors, warnings: result.warnings })
    if (result.scenario !== null) {
      setScenario(result.scenario)
      setCopied(false)
    }
  }

  const handleCopy = async (): Promise<void> => {
    // The clipboard is local. Nothing is transmitted, here or anywhere else.
    await navigator.clipboard.writeText(summaryParagraph(results, scenario.offer))
    setCopied(true)
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-5 text-neutral-300 antialiased">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-sm font-medium tracking-tight text-neutral-100">
            Offer Lab
            <span className="ml-2 font-normal text-neutral-500">
              what this hire does to the team you already have
            </span>
          </h1>
          <p className="text-[11px] text-neutral-600">
            Everything runs in your browser. Nothing you enter is transmitted or stored.
          </p>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <OfferPanel
              offer={scenario.offer}
              grades={scenario.grades}
              settings={scenario.settings}
              onOfferChange={(offer) => update({ offer })}
              onSettingsChange={(settings: OfferSettings) => update({ settings })}
            />
            <TeamPanel
              scenario={scenario}
              gradeHeadcount={results.teamPosition.gradeHeadcount}
              issues={issues}
              onPaste={handlePaste}
              onLoadSample={() => {
                setScenario(sampleScenario())
                setIssues({ errors: [], warnings: [] })
                setCopied(false)
              }}
              onSave={() =>
                downloadText(
                  scenarioFileName(scenario),
                  serializeScenario(scenario),
                  'application/json',
                )
              }
              onLoadFile={(file) => void handleLoadFile(file)}
              onClearIssues={() => setIssues({ errors: [], warnings: [] })}
            />
          </div>

          {loaded ? (
            <div className="space-y-3">
              <ConsequencesColumn results={results} offer={scenario.offer} />
              <Panel
                title="The finding, in a paragraph"
                aside={copied ? 'copied' : 'for the email you were about to write'}
              >
                <p className="text-xs leading-relaxed text-neutral-300">
                  {summaryParagraph(results, scenario.offer)}
                </p>
                <div className="mt-3">
                  <Button onClick={() => void handleCopy()}>
                    {copied ? 'Copied to clipboard' : 'Copy'}
                  </Button>
                </div>
              </Panel>
            </div>
          ) : (
            <Panel title="Nothing loaded yet">
              <p className="max-w-prose text-xs leading-relaxed text-neutral-400">
                Load the sample team to see what the tool does, or paste your own. Your data
                never leaves this browser tab — there is no server to send it to — so nothing is
                kept when you close it. Save a file if you want it tomorrow.
              </p>
            </Panel>
          )}
        </div>

        <footer className="mt-6 text-[11px] text-neutral-600">
          A companion to{' '}
          <a
            className="underline underline-offset-4 hover:text-neutral-400"
            href="https://compforyou.github.io/merit-lab/"
          >
            Merit Lab
          </a>
          . The compensation math is in <code>src/lib</code>, and every formula has a unit test.
        </footer>
      </div>
    </main>
  )
}
