import { useRef, useState } from 'react'
import type { OfferScenario } from '../types/domain'
import type { ImportIssue } from '../lib/import-issue'
import { Panel, Button } from './Panel'
import { formatCount, pluralize } from '../lib/format'

/**
 * The team, and getting it in and out.
 *
 * Save and load sit here rather than in a menu because they are what make the
 * tool usable twice. Nothing persists on its own — no account, no storage — so
 * a file is the whole of the persistence story, and it stays on the user's
 * machine. See docs/SPEC.md section 8.1.
 */
export function TeamPanel({
  scenario,
  gradeHeadcount,
  issues,
  onPaste,
  onLoadSample,
  onSave,
  onLoadFile,
  onClearIssues,
}: {
  scenario: OfferScenario
  gradeHeadcount: number
  issues: { errors: ImportIssue[]; warnings: ImportIssue[] }
  onPaste: (text: string) => void
  onLoadSample: () => void
  onSave: () => void
  onLoadFile: (file: File) => void
  onClearIssues: () => void
}) {
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <Panel
      title="Team"
      aside={`${formatCount(gradeHeadcount)} in grade · ${formatCount(scenario.incumbents.length)} total`}
    >
      <div className="flex flex-wrap gap-2">
        <Button onClick={onLoadSample}>Load sample team</Button>
        <Button variant="quiet" onClick={() => setPasting((open) => !open)}>
          {pasting ? 'Cancel' : 'Paste a team'}
        </Button>
        <Button variant="quiet" onClick={onSave}>
          Save
        </Button>
        <Button variant="quiet" onClick={() => fileInput.current?.click()}>
          Load
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Load a saved scenario"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file !== undefined) onLoadFile(file)
            event.target.value = ''
          }}
        />
      </div>

      {pasting && (
        <div className="mt-3">
          <textarea
            className="h-32 w-full border border-neutral-800 bg-neutral-950 p-2 font-mono text-xs text-neutral-200 focus:border-neutral-600 focus:outline-none"
            placeholder={'id,grade,salary,fte,hire date,rating,manager id\nA-402,G4,108500,1,2016-04-18,Exceeds,A-511'}
            value={text}
            aria-label="Paste team data"
            onChange={(event) => setText(event.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              onClick={() => {
                onPaste(text)
                setPasting(false)
                setText('')
              }}
            >
              Import
            </Button>
            <span className="text-[11px] text-neutral-600">
              CSV or straight out of a spreadsheet. Name, contact and demographic columns are
              dropped.
            </span>
          </div>
        </div>
      )}

      {(issues.errors.length > 0 || issues.warnings.length > 0) && (
        <IssueList issues={issues} onClear={onClearIssues} />
      )}
    </Panel>
  )
}

/**
 * What the import did. Errors and warnings, with line numbers, never a modal:
 * the user is loading data, not making a mistake.
 */
function IssueList({
  issues,
  onClear,
}: {
  issues: { errors: ImportIssue[]; warnings: ImportIssue[] }
  onClear: () => void
}) {
  const total = issues.errors.length + issues.warnings.length

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-neutral-500">
          {pluralize(total, 'note')} from the import
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-neutral-500 hover:text-neutral-300"
        >
          dismiss
        </button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] leading-snug">
        {issues.errors.map((issue, index) => (
          <li key={`e${index}`} className="text-rose-300">
            {issue.row !== null && <span className="text-neutral-600">row {issue.row} · </span>}
            {issue.message}
          </li>
        ))}
        {issues.warnings.map((issue, index) => (
          <li key={`w${index}`} className="text-amber-300/80">
            {issue.row !== null && <span className="text-neutral-600">row {issue.row} · </span>}
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
