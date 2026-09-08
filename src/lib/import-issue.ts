/**
 * One problem with an imported file.
 *
 * `row` is the line number as the user sees it in their spreadsheet, counting
 * the header as row 1, so an error can be pointed at rather than described.
 * Null means the problem is with the file as a whole.
 *
 * Merit Lab declares this inside its employee importer. Here it lives on its
 * own, because the incumbent importer, the grade importer and the scenario
 * loader all report the same shape and none of them should have to import from
 * another importer to say so.
 */
export interface ImportIssue {
  row: number | null
  column: string | null
  message: string
}
