import { normalizeHeader } from './csv'

/**
 * Deciding which column in a pasted file is which.
 *
 * Automatic header matching gets a clean export right and a real one wrong. An
 * HRIS extract does not have a column called "base salary"; it has
 * `Curr_Ann_Base_Amt` next to `Prev_Ann_Base_Amt`, and a column called `Level`
 * that might mean job family rather than grade. Two things follow.
 *
 * First, the user must be able to correct a mapping without leaving the tool.
 * Renaming columns in a spreadsheet and pasting again is where a first session
 * ends, and adoption condition 8.3 says the tool has to eat a real export.
 *
 * Second, a confident wrong answer costs more than an admitted uncertainty. A
 * file mapped silently to the wrong salary column still produces a placement, a
 * compression finding and a cost, all wrong and none obviously so. So every
 * match records how it was arrived at, and a loose match is shown as loose.
 */

export type IncumbentField =
  | 'id'
  | 'gradeId'
  | 'baseSalary'
  | 'fte'
  | 'hireDate'
  | 'performanceRating'
  | 'managerId'

/**
 * How a column came to be assigned.
 *
 * `exact` is the field's canonical name. `strong` is a specific alias with one
 * plausible meaning. `loose` is an alias a reasonable file could use for
 * something else — `level` might be a job family, `pay` might be total
 * compensation. `chosen` means the user set it, which outranks any inference.
 */
export type MatchQuality = 'exact' | 'strong' | 'loose' | 'chosen' | 'none'

export interface FieldDescriptor {
  field: IncumbentField
  label: string
  required: boolean
  /** What the tool does with this column. */
  purpose: string
  /** What happens when it is absent. Empty for required fields. */
  whenAbsent: string
}

export const INCUMBENT_FIELDS: FieldDescriptor[] = [
  {
    field: 'id',
    label: 'Incumbent id',
    required: true,
    purpose: 'Identifies a person in the findings and the export. Never a name.',
    whenAbsent: '',
  },
  {
    field: 'gradeId',
    label: 'Grade',
    required: true,
    purpose: 'Links the person to a range, which every comparison depends on.',
    whenAbsent: '',
  },
  {
    field: 'baseSalary',
    label: 'Base salary',
    required: true,
    purpose: 'Annualized base pay at this person’s FTE.',
    whenAbsent: '',
  },
  {
    field: 'fte',
    label: 'FTE',
    required: false,
    purpose: 'Grosses part-time pay up before any comparison to a range.',
    whenAbsent: 'Everyone is treated as full time.',
  },
  {
    field: 'hireDate',
    label: 'Hire date',
    required: false,
    purpose: 'Drives tenure, which decides whether a finding can be flagged.',
    whenAbsent: 'Tenure is unknown, so nobody in this file can be flagged.',
  },
  {
    field: 'performanceRating',
    label: 'Performance rating',
    required: false,
    purpose: 'Separates the leapfrogs that will start a conversation.',
    whenAbsent: 'Strong-performer leapfrogs cannot be identified.',
  },
  {
    field: 'managerId',
    label: 'Manager id',
    required: false,
    purpose: 'Lets the vertical comparison name a manager instead of a grade median.',
    whenAbsent: 'The grade above’s median is used, and the tool says so.',
  },
]

/**
 * Header aliases, normalised. `strong` aliases have one plausible reading;
 * `loose` ones are plausible for something else and are reported as such.
 */
const ALIASES: Record<IncumbentField, { strong: string[]; loose: string[] }> = {
  id: {
    strong: ['id', 'employeeid', 'incumbentid', 'personid', 'personnumber', 'empid',
      'employeenumber', 'workerid', 'associateid', 'payrollid', 'employeeno'],
    loose: ['number', 'ref', 'reference', 'code'],
  },
  gradeId: {
    strong: ['grade', 'gradeid', 'salarygrade', 'paygrade', 'gradecode', 'band',
      'payband', 'salaryband', 'jobgrade'],
    loose: ['level', 'joblevel', 'tier'],
  },
  baseSalary: {
    strong: ['basesalary', 'salary', 'annualsalary', 'basepay', 'annualbase',
      'currentsalary', 'currannbaseamt', 'baseamount', 'annualbasesalary'],
    loose: ['pay', 'compensation', 'amount', 'rate', 'total'],
  },
  fte: {
    strong: ['fte', 'fulltimeequivalent', 'ftepercent', 'workingtimepercent'],
    loose: ['hours', 'schedule', 'parttime'],
  },
  hireDate: {
    strong: ['hiredate', 'startdate', 'dateofhire', 'datehired', 'originalhiredate',
      'servicedate', 'continuousservicedate', 'joindate'],
    loose: ['date', 'since', 'seniority'],
  },
  performanceRating: {
    strong: ['performancerating', 'rating', 'performance', 'perfrating',
      'reviewrating', 'appraisalrating'],
    loose: ['score', 'result', 'assessment'],
  },
  managerId: {
    strong: ['managerid', 'managerno', 'supervisorid', 'reportsto', 'reportstoid',
      'linemanagerid', 'managernumber'],
    loose: ['manager', 'supervisor', 'lead'],
  },
}

/**
 * Headers that look like they hold a person's name.
 *
 * A name column is DROPPED on import with a visible notice, never stored and
 * never mapped. This tool models decisions about specific human beings, and the
 * single thing that makes it safe to open on a work laptop is that it has never
 * held one of their names. See CLAUDE.md constraint 5.
 */
const NAME_HEADERS = [
  'name', 'fullname', 'employeename', 'firstname', 'lastname', 'surname',
  'givenname', 'familyname', 'preferredname', 'displayname', 'legalname',
  'forename', 'middlename', 'knownas', 'email', 'emailaddress', 'workemail',
  'username', 'login',
]

/**
 * Headers that would carry demographic data.
 *
 * Also dropped, and for a harder reason than names: compression and pay equity
 * are different questions with different legal exposure, and a tool that holds
 * both invites someone to answer one with the other. See CLAUDE.md constraint 6.
 */
const DEMOGRAPHIC_HEADERS = [
  'gender', 'sex', 'ethnicity', 'race', 'age', 'dateofbirth', 'dob', 'birthdate',
  'disability', 'nationality', 'maritalstatus', 'religion', 'sexualorientation',
  'veteranstatus', 'pronouns',
]

export interface ColumnMapping {
  /** Field to column index, or null when no column serves it. */
  columns: Record<IncumbentField, number | null>
  /** How each assignment was arrived at. */
  quality: Record<IncumbentField, MatchQuality>
}

export interface HeaderScan {
  mapping: ColumnMapping
  /** Column indexes holding names or contact details. Dropped on import. */
  droppedNameColumns: string[]
  /** Column indexes holding demographic data. Dropped on import. */
  droppedDemographicColumns: string[]
  /** Unclaimed, non-dropped headers, kept as grouping attributes. */
  attributeColumns: string[]
}

const EMPTY_MAPPING = (): ColumnMapping => ({
  columns: {
    id: null, gradeId: null, baseSalary: null, fte: null,
    hireDate: null, performanceRating: null, managerId: null,
  },
  quality: {
    id: 'none', gradeId: 'none', baseSalary: 'none', fte: 'none',
    hireDate: 'none', performanceRating: 'none', managerId: 'none',
  },
})

/**
 * Propose a mapping from the header row.
 *
 * Matching runs in quality order across all fields — every exact match is taken
 * before any strong one, and every strong one before any loose one — so a file
 * with both `grade` and `level` assigns `grade`, rather than whichever appeared
 * first. A column is claimed once; a field is filled once.
 */
export function scanHeaders(headers: string[]): HeaderScan {
  const mapping = EMPTY_MAPPING()
  const normalized = headers.map(normalizeHeader)

  const droppedNameColumns: string[] = []
  const droppedDemographicColumns: string[] = []
  const blocked = new Set<number>()

  normalized.forEach((header, index) => {
    if (NAME_HEADERS.includes(header)) {
      droppedNameColumns.push(headers[index])
      blocked.add(index)
    } else if (DEMOGRAPHIC_HEADERS.includes(header)) {
      droppedDemographicColumns.push(headers[index])
      blocked.add(index)
    }
  })

  const claimed = new Set<number>(blocked)
  const fields = INCUMBENT_FIELDS.map((descriptor) => descriptor.field)

  const take = (
    quality: Exclude<MatchQuality, 'chosen' | 'none'>,
    matches: (field: IncumbentField, header: string) => boolean,
  ): void => {
    for (const field of fields) {
      if (mapping.columns[field] !== null) continue
      const index = normalized.findIndex(
        (header, i) => !claimed.has(i) && matches(field, header),
      )
      if (index === -1) continue
      mapping.columns[field] = index
      mapping.quality[field] = quality
      claimed.add(index)
    }
  }

  take('exact', (field, header) => header === normalizeHeader(field))
  take('strong', (field, header) => ALIASES[field].strong.includes(header))
  take('loose', (field, header) => ALIASES[field].loose.includes(header))

  return {
    mapping,
    droppedNameColumns,
    droppedDemographicColumns,
    attributeColumns: headers.filter((_header, index) => !claimed.has(index)),
  }
}

/** Apply a user's correction. A chosen column outranks anything inferred. */
export function chooseColumn(
  mapping: ColumnMapping,
  field: IncumbentField,
  columnIndex: number | null,
): ColumnMapping {
  const columns = { ...mapping.columns }
  const quality = { ...mapping.quality }

  // A column can serve only one field. Assigning it here releases it elsewhere,
  // so the user never has to unset the old field first.
  if (columnIndex !== null) {
    for (const other of Object.keys(columns) as IncumbentField[]) {
      if (other !== field && columns[other] === columnIndex) {
        columns[other] = null
        quality[other] = 'none'
      }
    }
  }

  columns[field] = columnIndex
  quality[field] = columnIndex === null ? 'none' : 'chosen'

  return { columns, quality }
}

/** Required fields with no column. The import cannot proceed without these. */
export function missingRequiredFields(mapping: ColumnMapping): FieldDescriptor[] {
  return INCUMBENT_FIELDS.filter(
    (descriptor) => descriptor.required && mapping.columns[descriptor.field] === null,
  )
}
