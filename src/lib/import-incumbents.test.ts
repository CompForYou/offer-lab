import { describe, it, expect } from 'vitest'
import { importIncumbentsFromCsv } from './import-incumbents'
import { chooseColumn, scanHeaders } from './column-mapping'

const CLEAN = [
  'id,grade,base salary,fte,hire date,rating,manager id',
  'E1,G4,92000,1,2019-01-01,Exceeds,E10',
  'E2,G4,98000,1,2021-06-01,Meets,E10',
  'E10,G5,130000,1,2019-01-01,Exceeds,',
].join('\n')

describe('importIncumbentsFromCsv', () => {
  it('imports a clean file', () => {
    const result = importIncumbentsFromCsv(CLEAN)

    expect(result.errors).toHaveLength(0)
    expect(result.incumbents).toHaveLength(3)
    expect(result.incumbents[0]).toEqual({
      id: 'E1',
      gradeId: 'G4',
      baseSalary: 92_000,
      fte: 1,
      hireDate: '2019-01-01',
      performanceRating: 'Exceeds',
      managerId: 'E10',
    })
  })

  it('reads salaries as a payroll system writes them', () => {
    const text = 'id,grade,salary\nE1,G4,"$118,000.00"\nE2,G4,95 000'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents[0].baseSalary).toBe(118_000)
    expect(result.incumbents[1].baseSalary).toBe(95_000)
  })

  it('accepts tab-separated text pasted from a spreadsheet', () => {
    const text = 'id\tgrade\tsalary\nE1\tG4\t92000'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents).toHaveLength(1)
    expect(result.incumbents[0].baseSalary).toBe(92_000)
  })

  it('reads dates in the formats an export actually uses', () => {
    const text = [
      'id,grade,salary,hire date',
      'E1,G4,92000,2019-01-01',
      'E2,G4,92000,15/03/2020',
      'E3,G4,92000,3/15/2020',
    ].join('\n')
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents[0].hireDate).toBe('2019-01-01')
    expect(result.incumbents[1].hireDate).toBe('2020-03-15')
    expect(result.incumbents[2].hireDate).toBe('2020-03-15')
  })
})

describe('importIncumbentsFromCsv privacy rules', () => {
  it('drops a name column and says so', () => {
    const text = 'id,name,grade,salary\nE1,Alex Doe,G4,92000'
    const result = importIncumbentsFromCsv(text)

    expect(result.droppedNameColumns).toEqual(['name'])
    expect(result.warnings.some((issue) => issue.message.includes('never stores names'))).toBe(true)
    // The value is gone from every part of the record, attributes included.
    expect(JSON.stringify(result.incumbents)).not.toContain('Alex')
    expect(result.incumbents[0].attributes).toBeUndefined()
  })

  it('drops email and other contact columns too', () => {
    const text = 'id,work email,grade,salary\nE1,a@example.com,G4,92000'
    const result = importIncumbentsFromCsv(text)

    expect(result.droppedNameColumns).toEqual(['work email'])
    expect(JSON.stringify(result.incumbents)).not.toContain('example.com')
  })

  it('drops demographic columns and explains why', () => {
    const text = 'id,gender,date of birth,grade,salary\nE1,F,1985-04-02,G4,92000'
    const result = importIncumbentsFromCsv(text)

    expect(result.droppedDemographicColumns).toEqual(['gender', 'date of birth'])
    expect(JSON.stringify(result.incumbents)).not.toContain('1985')
  })

  it('keeps ordinary unrecognised columns as grouping attributes', () => {
    const text = 'id,grade,salary,department,location\nE1,G4,92000,Finance,Calgary'
    const result = importIncumbentsFromCsv(text)

    expect(result.attributeColumns).toEqual(['department', 'location'])
    expect(result.incumbents[0].attributes).toEqual({
      department: 'Finance',
      location: 'Calgary',
    })
  })
})

describe('importIncumbentsFromCsv validation', () => {
  it('skips a row rather than the file when one salary is unreadable', () => {
    const text = 'id,grade,salary\nE1,G4,92000\nE2,G4,not a number\nE3,G4,98000'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents.map((i) => i.id)).toEqual(['E1', 'E3'])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(3) // as numbered in their spreadsheet
  })

  it('rejects a duplicate id and keeps the first', () => {
    const text = 'id,grade,salary\nE1,G4,92000\nE1,G4,98000'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents).toHaveLength(1)
    expect(result.incumbents[0].baseSalary).toBe(92_000)
    expect(result.errors[0].message).toContain('Duplicate id')
  })

  it('rejects a grade that is not in the structure', () => {
    const text = 'id,grade,salary\nE1,G4,92000\nE2,G9,98000'
    const result = importIncumbentsFromCsv(text, { knownGradeIds: ['G4', 'G5'] })

    expect(result.incumbents.map((i) => i.id)).toEqual(['E1'])
    expect(result.errors[0].message).toContain('not in the structure')
  })

  it('rejects a row with no id and one with no grade', () => {
    const text = 'id,grade,salary\n,G4,92000\nE2,,98000'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents).toHaveLength(0)
    expect(result.errors).toHaveLength(2)
  })

  it('reads FTE as a percentage when it is above 1, and warns', () => {
    const text = 'id,grade,salary,fte\nE1,G4,47500,50'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents[0].fte).toBe(0.5)
    expect(result.warnings.some((issue) => issue.column === 'fte')).toBe(true)
  })

  it('keeps a row whose hire date cannot be read, as tenure unknown', () => {
    // The person is real and their pay is real. They simply cannot be flagged.
    const text = 'id,grade,salary,hire date\nE1,G4,92000,sometime in 2019'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents).toHaveLength(1)
    expect(result.incumbents[0].hireDate).toBeUndefined()
    expect(result.errors).toHaveLength(0)
    expect(result.warnings.some((issue) => issue.message.includes('Tenure unknown'))).toBe(true)
  })

  it('reports a hire date in the future', () => {
    const text = 'id,grade,salary,hire date\nE1,G4,92000,2030-01-01'
    const result = importIncumbentsFromCsv(text, { today: '2024-09-01' })

    expect(result.warnings.some((issue) => issue.message.includes('in the future'))).toBe(true)
  })

  it('reports a manager id that matches nobody', () => {
    const text = 'id,grade,salary,manager id\nE1,G4,92000,GHOST'
    const result = importIncumbentsFromCsv(text)

    expect(result.incumbents).toHaveLength(1)
    expect(result.warnings.some((issue) => issue.message.includes('GHOST'))).toBe(true)
  })

  it('warns when there is no hire date column at all', () => {
    const result = importIncumbentsFromCsv('id,grade,salary\nE1,G4,92000')

    expect(
      result.warnings.some((issue) => issue.message.includes('nothing in this file can be flagged')),
    ).toBe(true)
  })

  it('warns when the salaries look hourly rather than annual', () => {
    const text = 'id,grade,salary\nE1,G4,45\nE2,G4,52'
    const result = importIncumbentsFromCsv(text)

    expect(result.warnings.some((issue) => issue.message.includes('hourly or monthly'))).toBe(true)
  })

  it('refuses the file when a required column is missing', () => {
    const result = importIncumbentsFromCsv('id,department\nE1,Finance')

    expect(result.incumbents).toHaveLength(0)
    expect(result.errors[0].message).toContain('grade')
    expect(result.errors[0].message).toContain('base salary')
  })

  it('reports empty text as empty', () => {
    expect(importIncumbentsFromCsv('').errors[0].message).toBe('The pasted text is empty.')
  })

  it('survives a deliberately messy real-world export', () => {
    // Adoption condition 8.3: mixed header casing, a name column, money as
    // text, blank rows, a duplicate id, one bad salary.
    const messy = [
      'Employee_ID,Full Name,Pay Grade,Curr_Ann_Base_Amt,FTE,Original Hire Date,Cost Centre',
      'E1,Alex Doe,G4,"$92,000.00",1,15/01/2019,Finance',
      '',
      'E2,Sam Roe,G4,98000,1,2021-06-01,Finance',
      'E2,Sam Roe,G4,98000,1,2021-06-01,Finance',
      'E3,Jo Poe,G4,tbc,1,2020-03-01,Finance',
      '',
    ].join('\n')
    const result = importIncumbentsFromCsv(messy)

    expect(result.incumbents.map((i) => i.id)).toEqual(['E1', 'E2'])
    expect(result.incumbents[0].baseSalary).toBe(92_000)
    expect(result.incumbents[0].hireDate).toBe('2019-01-15')
    expect(result.incumbents[0].attributes).toEqual({ 'Cost Centre': 'Finance' })
    expect(result.droppedNameColumns).toEqual(['Full Name'])
    // Two rejections, both explained, neither silent.
    expect(result.errors).toHaveLength(2)
    expect(JSON.stringify(result.incumbents)).not.toContain('Alex')
  })
})

describe('importIncumbentsFromCsv with a corrected mapping', () => {
  it('obeys a mapping the user set, over what it inferred', () => {
    // Two money columns. The automatic match takes "salary"; the user knows the
    // offer should be modelled against the proposed figure instead.
    const headers = ['id', 'grade', 'salary', 'proposed salary']
    const text = [headers.join(','), 'E1,G4,88000,92000'].join('\n')

    const auto = importIncumbentsFromCsv(text)
    expect(auto.incumbents[0].baseSalary).toBe(88_000)
    expect(auto.mapping.quality.baseSalary).toBe('strong')

    const corrected = chooseColumn(scanHeaders(headers).mapping, 'baseSalary', 3)
    const fixed = importIncumbentsFromCsv(text, { mapping: corrected })
    expect(fixed.incumbents[0].baseSalary).toBe(92_000)
    expect(fixed.mapping.quality.baseSalary).toBe('chosen')
  })
})
