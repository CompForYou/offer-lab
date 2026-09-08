import { describe, it, expect } from 'vitest'
import {
  scanHeaders,
  chooseColumn,
  missingRequiredFields,
  INCUMBENT_FIELDS,
} from './column-mapping'

describe('scanHeaders', () => {
  it('matches a clean export exactly', () => {
    const scan = scanHeaders(['id', 'gradeId', 'baseSalary', 'fte', 'hireDate'])

    expect(scan.mapping.columns.id).toBe(0)
    expect(scan.mapping.columns.baseSalary).toBe(2)
    expect(scan.mapping.quality.baseSalary).toBe('exact')
  })

  it('matches the aliases a real HRIS uses', () => {
    const scan = scanHeaders([
      'Employee_ID', 'Pay Grade', 'Curr_Ann_Base_Amt', 'FTE', 'Original Hire Date',
    ])

    expect(scan.mapping.columns.id).toBe(0)
    expect(scan.mapping.columns.gradeId).toBe(1)
    expect(scan.mapping.columns.baseSalary).toBe(2)
    expect(scan.mapping.columns.hireDate).toBe(4)
    expect(scan.mapping.quality.baseSalary).toBe('strong')
  })

  it('prefers a strong match over a loose one, wherever it appears', () => {
    // "level" is loose for grade and appears first; "grade" is strong. Matching
    // runs in quality order across all fields, so position does not decide it.
    const scan = scanHeaders(['id', 'level', 'grade', 'salary'])

    expect(scan.mapping.columns.gradeId).toBe(2)
    expect(scan.mapping.quality.gradeId).toBe('strong')
    // And the loose column is left alone as an attribute rather than consumed.
    expect(scan.attributeColumns).toContain('level')
  })

  it('takes a loose match when nothing better exists, and says it is loose', () => {
    const scan = scanHeaders(['ref', 'level', 'pay'])

    expect(scan.mapping.columns.id).toBe(0)
    expect(scan.mapping.columns.gradeId).toBe(1)
    expect(scan.mapping.columns.baseSalary).toBe(2)
    expect(scan.mapping.quality.baseSalary).toBe('loose')
  })

  it('prefers the current salary column over a previous one', () => {
    // "previous salary" is not an alias at all, so it never competes.
    const scan = scanHeaders(['id', 'grade', 'previous salary', 'current salary'])

    expect(scan.mapping.columns.baseSalary).toBe(3)
    expect(scan.attributeColumns).toContain('previous salary')
  })

  it('claims each column once', () => {
    const scan = scanHeaders(['id', 'employee id', 'grade', 'salary'])
    const claimed = Object.values(scan.mapping.columns).filter((c) => c !== null)

    expect(new Set(claimed).size).toBe(claimed.length)
  })

  it('lists name and contact headers as dropped, never as mapped', () => {
    const scan = scanHeaders(['id', 'Full Name', 'email', 'grade', 'salary'])

    expect(scan.droppedNameColumns).toEqual(['Full Name', 'email'])
    expect(scan.attributeColumns).not.toContain('Full Name')
    expect(Object.values(scan.mapping.columns)).not.toContain(1)
    expect(Object.values(scan.mapping.columns)).not.toContain(2)
  })

  it('lists demographic headers as dropped', () => {
    const scan = scanHeaders(['id', 'gender', 'ethnicity', 'grade', 'salary'])

    expect(scan.droppedDemographicColumns).toEqual(['gender', 'ethnicity'])
    expect(scan.attributeColumns).not.toContain('gender')
  })

  it('keeps everything else as a grouping attribute', () => {
    const scan = scanHeaders(['id', 'grade', 'salary', 'department', 'office'])

    expect(scan.attributeColumns).toEqual(['department', 'office'])
  })

  it('returns an empty mapping for no headers', () => {
    const scan = scanHeaders([])

    expect(Object.values(scan.mapping.columns).every((c) => c === null)).toBe(true)
    expect(scan.attributeColumns).toEqual([])
  })
})

describe('chooseColumn', () => {
  it('records a user choice as outranking inference', () => {
    const scan = scanHeaders(['id', 'grade', 'salary', 'bonus'])
    const corrected = chooseColumn(scan.mapping, 'baseSalary', 3)

    expect(corrected.columns.baseSalary).toBe(3)
    expect(corrected.quality.baseSalary).toBe('chosen')
  })

  it('releases a column from whichever field held it', () => {
    // The user should never have to unset the old field first.
    const scan = scanHeaders(['id', 'grade', 'salary'])
    const corrected = chooseColumn(scan.mapping, 'managerId', 0)

    expect(corrected.columns.managerId).toBe(0)
    expect(corrected.columns.id).toBeNull()
    expect(corrected.quality.id).toBe('none')
  })

  it('clears a field without disturbing the others', () => {
    const scan = scanHeaders(['id', 'grade', 'salary'])
    const corrected = chooseColumn(scan.mapping, 'gradeId', null)

    expect(corrected.columns.gradeId).toBeNull()
    expect(corrected.quality.gradeId).toBe('none')
    expect(corrected.columns.id).toBe(0)
  })

  it('does not modify the mapping it was given', () => {
    const scan = scanHeaders(['id', 'grade', 'salary'])
    chooseColumn(scan.mapping, 'baseSalary', 0)

    expect(scan.mapping.columns.baseSalary).toBe(2)
  })
})

describe('missingRequiredFields', () => {
  it('names the required fields with no column', () => {
    const scan = scanHeaders(['id', 'department'])
    const missing = missingRequiredFields(scan.mapping).map((f) => f.field)

    expect(missing).toEqual(['gradeId', 'baseSalary'])
  })

  it('is empty when the three required fields are present', () => {
    const scan = scanHeaders(['id', 'grade', 'salary'])

    expect(missingRequiredFields(scan.mapping)).toEqual([])
  })

  it('treats only id, grade and salary as required', () => {
    // Everything else degrades to a stated default rather than failing: a file
    // without a hire date is still a perfectly good file for placing an offer.
    const required = INCUMBENT_FIELDS.filter((f) => f.required).map((f) => f.field)

    expect(required).toEqual(['id', 'gradeId', 'baseSalary'])
  })
})
