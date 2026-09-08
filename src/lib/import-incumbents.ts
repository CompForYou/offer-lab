import type { Incumbent } from '../types/domain'
import { parseDelimitedText } from './csv'
import { parseCurrency, parseFte, normalizeDate } from './parse-values'
import {
  scanHeaders,
  missingRequiredFields,
  type ColumnMapping,
} from './column-mapping'
import type { ImportIssue } from './import-issue'

/**
 * Reading a team out of a pasted export. docs/SPEC.md milestone M2.
 *
 * A bad row costs that row, not the whole paste: valid rows import, invalid ones
 * are reported with their line number and left out. Somebody with one malformed
 * salary in forty rows should not have to start again.
 */

export interface IncumbentImportResult {
  incumbents: Incumbent[]
  /** Rows that could not be imported. These people are absent from the result. */
  errors: ImportIssue[]
  /** Rows that imported but deserve a second look. */
  warnings: ImportIssue[]
  /** Unrecognised headers, kept as grouping attributes. */
  attributeColumns: string[]
  /** Name and contact columns that were dropped, reported so the drop is visible. */
  droppedNameColumns: string[]
  /** Demographic columns that were dropped. */
  droppedDemographicColumns: string[]
  /** The mapping actually used, whether proposed or supplied. */
  mapping: ColumnMapping
}

export interface IncumbentImportOptions {
  /** Grade ids from the loaded structure. A row referencing anything else errors. */
  knownGradeIds?: string[]
  /**
   * Which column serves which field. Absent, the headers are matched
   * automatically. Supplied, it is obeyed exactly: the user has looked at their
   * own file and this module has not.
   */
  mapping?: ColumnMapping
  /** Rows with a hire date after this are reported. Defaults to no check. */
  today?: string
}

/** Below this median salary the file is probably hourly or monthly, not annual. */
const IMPLAUSIBLE_ANNUAL_SALARY_MEDIAN = 1_000

export function importIncumbentsFromCsv(
  text: string,
  options: IncumbentImportOptions = {},
): IncumbentImportResult {
  const errors: ImportIssue[] = []
  const warnings: ImportIssue[] = []
  const incumbents: Incumbent[] = []

  const rows = parseDelimitedText(text)
  if (rows.length === 0) {
    return {
      incumbents,
      errors: [{ row: null, column: null, message: 'The pasted text is empty.' }],
      warnings,
      attributeColumns: [],
      droppedNameColumns: [],
      droppedDemographicColumns: [],
      mapping: scanHeaders([]).mapping,
    }
  }

  const headers = rows[0]
  const scan = scanHeaders(headers)
  const mapping = options.mapping ?? scan.mapping

  // The drop is announced, never silent. A user who pasted a file with names in
  // it needs to know the names did not make it in — that is the whole promise.
  for (const column of scan.droppedNameColumns) {
    warnings.push({
      row: 1,
      column,
      message: `Column "${column}" looks like a name or contact detail and was dropped. This tool never stores names.`,
    })
  }
  for (const column of scan.droppedDemographicColumns) {
    warnings.push({
      row: 1,
      column,
      message: `Column "${column}" looks like demographic data and was dropped. Compression and pay equity are different questions; this tool answers only the first.`,
    })
  }

  const missing = missingRequiredFields(mapping)
  if (missing.length > 0) {
    return {
      ...scan,
      incumbents,
      errors: [
        {
          row: 1,
          column: null,
          message: `No column found for ${missing
            .map((descriptor) => descriptor.label.toLowerCase())
            .join(', ')}. Found: ${headers.join(', ')}.`,
        },
      ],
      warnings,
      attributeColumns: [],
      mapping,
    }
  }

  if (mapping.columns.hireDate === null) {
    warnings.push({
      row: 1,
      column: null,
      message:
        'No hire date column found. Tenure is unknown, so nothing in this file can be flagged as compression.',
    })
  }
  if (mapping.columns.fte === null) {
    warnings.push({
      row: 1,
      column: null,
      message: 'No FTE column found. Everyone is treated as full time.',
    })
  }

  const cellAt = (cells: string[], field: keyof ColumnMapping['columns']): string => {
    const index = mapping.columns[field]
    if (index === null) return ''
    return (cells[index] ?? '').trim()
  }

  const seenIds = new Set<string>()

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    const lineNumber = i + 1

    const id = cellAt(cells, 'id')
    if (id === '') {
      errors.push({ row: lineNumber, column: 'id', message: 'No id. Row skipped.' })
      continue
    }
    if (seenIds.has(id)) {
      errors.push({
        row: lineNumber,
        column: 'id',
        message: `Duplicate id "${id}". Row skipped.`,
      })
      continue
    }

    const gradeId = cellAt(cells, 'gradeId')
    if (gradeId === '') {
      errors.push({
        row: lineNumber,
        column: 'gradeId',
        message: `"${id}" has no grade. Row skipped.`,
      })
      continue
    }
    if (options.knownGradeIds && !options.knownGradeIds.includes(gradeId)) {
      errors.push({
        row: lineNumber,
        column: 'gradeId',
        message: `"${id}" is in grade "${gradeId}", which is not in the structure. Row skipped.`,
      })
      continue
    }

    const rawSalary = cellAt(cells, 'baseSalary')
    const baseSalary = parseCurrency(rawSalary)
    if (baseSalary === null) {
      errors.push({
        row: lineNumber,
        column: 'baseSalary',
        message: `"${id}" has a salary of "${rawSalary}", which is not a number. Row skipped.`,
      })
      continue
    }
    if (baseSalary <= 0) {
      errors.push({
        row: lineNumber,
        column: 'baseSalary',
        message: `"${id}" has a salary of ${baseSalary}. Row skipped.`,
      })
      continue
    }

    const fte = parseFte(cellAt(cells, 'fte'))
    if (fte.error !== undefined) {
      errors.push({ row: lineNumber, column: 'fte', message: `"${id}": ${fte.error} Row skipped.` })
      continue
    }
    if (fte.warning !== undefined) {
      warnings.push({ row: lineNumber, column: 'fte', message: `"${id}": ${fte.warning}` })
    }

    const rawHireDate = cellAt(cells, 'hireDate')
    const hireDate = rawHireDate === '' ? undefined : normalizeDate(rawHireDate)
    if (rawHireDate !== '' && hireDate === undefined) {
      // Not fatal. A person with an unreadable hire date is still a real person
      // in the range; they simply cannot be flagged.
      warnings.push({
        row: lineNumber,
        column: 'hireDate',
        message: `"${id}" has a hire date of "${rawHireDate}", which could not be read. Tenure unknown.`,
      })
    }
    if (hireDate !== undefined && options.today !== undefined && hireDate > options.today) {
      warnings.push({
        row: lineNumber,
        column: 'hireDate',
        message: `"${id}" has a hire date of ${hireDate}, which is in the future.`,
      })
    }

    const performanceRating = cellAt(cells, 'performanceRating')
    const managerId = cellAt(cells, 'managerId')

    const incumbent: Incumbent = {
      id,
      gradeId,
      baseSalary,
      fte: fte.value,
    }
    if (hireDate !== undefined) incumbent.hireDate = hireDate
    if (performanceRating !== '') incumbent.performanceRating = performanceRating
    if (managerId !== '') incumbent.managerId = managerId

    const attributes = collectAttributes(headers, cells, mapping, scan.attributeColumns)
    if (Object.keys(attributes).length > 0) incumbent.attributes = attributes

    seenIds.add(id)
    incumbents.push(incumbent)
  }

  // A manager id pointing at nobody is a warning, not an error: the person is
  // real and their pay is real, and the vertical comparison simply falls back
  // to a grade median with a note on screen.
  const ids = new Set(incumbents.map((incumbent) => incumbent.id))
  for (const incumbent of incumbents) {
    if (incumbent.managerId !== undefined && !ids.has(incumbent.managerId)) {
      warnings.push({
        row: null,
        column: 'managerId',
        message: `"${incumbent.id}" reports to "${incumbent.managerId}", who is not in this file.`,
      })
    }
  }

  if (incumbents.length > 0 && medianSalary(incumbents) < IMPLAUSIBLE_ANNUAL_SALARY_MEDIAN) {
    warnings.push({
      row: null,
      column: 'baseSalary',
      message:
        'The median salary is very low for annual pay. If this file is hourly or monthly, every figure will be wrong.',
    })
  }

  return {
    incumbents,
    errors,
    warnings,
    attributeColumns: scan.attributeColumns,
    droppedNameColumns: scan.droppedNameColumns,
    droppedDemographicColumns: scan.droppedDemographicColumns,
    mapping,
  }
}

/**
 * Unrecognised columns are preserved so a department or location column becomes
 * a dimension without any configuration. Dropped name and demographic columns
 * never reach here — `scan.attributeColumns` excludes them.
 */
function collectAttributes(
  headers: string[],
  cells: string[],
  mapping: ColumnMapping,
  attributeColumns: string[],
): Record<string, string> {
  const claimed = new Set(
    Object.values(mapping.columns).filter((index): index is number => index !== null),
  )
  const attributes: Record<string, string> = {}

  headers.forEach((header, index) => {
    if (claimed.has(index)) return
    if (!attributeColumns.includes(header)) return
    const value = (cells[index] ?? '').trim()
    if (value !== '') attributes[header] = value
  })

  return attributes
}

function medianSalary(incumbents: Incumbent[]): number {
  const sorted = incumbents.map((incumbent) => incumbent.baseSalary).sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}
