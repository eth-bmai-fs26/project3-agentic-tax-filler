/**
 * @file AddRowTable.tsx
 *
 * A dynamic table component that lets the user add or remove rows on the fly.
 * It is used throughout the tax form wherever the user needs to enter a variable
 * number of items -- for example, listing multiple children, bank accounts, or
 * securities. Each row contains one input per column, and there is a "remove"
 * button at the end of every row plus an "Add Row" button below the table.
 *
 * The component does NOT manage its own data. Instead it reads and writes
 * through the shared FormContext, which keeps all form data in one central
 * place. This way, every table stays in sync with the rest of the application.
 */

import { useForm } from '../context/FormContext';

/**
 * Describes a single column in the table.
 *
 * @property key   - A unique identifier used to store the column's value
 *                   inside each row object (e.g. "name", "amount").
 * @property label - The human-readable header text shown at the top of
 *                   the column (e.g. "Full Name", "Amount (CHF)").
 * @property type  - Optional HTML input type such as "text", "number", or
 *                   "date". Defaults to "text" when not provided.
 */
interface Column {
  key: string;
  label: string;
  type?: string;
}

/**
 * Props accepted by the AddRowTable component.
 *
 * @property page    - The top-level form page this table belongs to
 *                     (e.g. "personal", "income"). Used to locate the
 *                     correct slice of form data in the context.
 * @property section - The section within the page (e.g. "children",
 *                     "bankAccounts"). Together with `page` it uniquely
 *                     identifies where the row data lives.
 * @property columns - An array of Column definitions that determine how
 *                     many input fields each row has and what types they use.
 * @property rows    - The current array of row data objects. Each object
 *                     maps column keys to their string values.
 * @property tableId - An HTML id attribute for the <table> element, useful
 *                     for styling and automated testing.
 */
interface AddRowTableProps {
  page: string;
  section: string;
  columns: Column[];
  rows: Record<string, string>[];
  tableId: string;
}

/**
 * AddRowTable -- renders a table with dynamic rows that can be added or removed.
 *
 * How it works:
 * 1. The table header is built from the `columns` array.
 * 2. Each existing row in `rows` is rendered with one <input> per column.
 * 3. A red "remove" button at the end of each row calls `removeRow` to delete it.
 * 4. An "Add Row" button below the table calls `addRow` to append a new empty row.
 *
 * All data mutations go through the FormContext helpers (`addRow`, `removeRow`,
 * `updateRowField`) so the rest of the app sees the changes immediately.
 *
 * @param props - See AddRowTableProps for details on each property.
 * @returns A JSX element containing the editable table and the "Add Row" button.
 */
export default function AddRowTable({ page, section, columns, rows, tableId }: AddRowTableProps) {
  // Pull helper functions from the shared form context.
  // - addRow:          appends a blank row to the specified page/section.
  // - removeRow:       deletes the row at a given index.
  // - updateRowField:  updates a single cell (identified by row index + column key).
  const { addRow, removeRow, updateRowField } = useForm();

  return (
    <div>
      <table className="add-row-table" id={tableId}>
        {/* ----- Table Header ----- */}
        {/* Render one <th> for every column, plus an extra narrow column
            on the right that will hold the "remove row" buttons. */}
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
            {/* Empty header cell that sits above the "remove" buttons column */}
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>

        {/* ----- Table Body ----- */}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {/* Render one input per column for this row */}
              {columns.map(col => (
                <td key={col.key}>
                  {/* The input's id is built from page, section, row index,
                      and column key so every field on the page is unique.
                      This id is also used by the AI agent to target fields. */}
                  <input
                    id={`field-${page}-${section}-${i}-${col.key}`}
                    type={col.type || 'text'}
                    value={row[col.key] || ''}
                    onChange={e => updateRowField(page, section, i, col.key, e.target.value)}
                    aria-label={`${col.label} (row ${i + 1})`}
                  />
                  {/* Screen-reader-only label (class "sr-only" hides it visually)
                      so assistive technologies can announce each input clearly. */}
                  <label htmlFor={`field-${page}-${section}-${i}-${col.key}`} className="sr-only">
                    {col.label} (row {i + 1})
                  </label>
                </td>
              ))}

              {/* Remove-row button for this row */}
              <td>
                <button id={`btn-remove-row-${page}-${section}-${i}`} className="btn-danger" onClick={() => removeRow(page, section, i)} aria-label={`Remove row ${i + 1}`}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* "Add Row" button -- appends a new blank row to the table via FormContext */}
      <button id={`btn-add-row-${page}-${section}`} className="btn-secondary add-row-btn" onClick={() => addRow(page, section)}>
        + Add Row
      </button>
    </div>
  );
}
