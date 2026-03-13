import { useForm } from '../context/FormContext';

interface Column {
  key: string;
  label: string;
  type?: string;
}

interface AddRowTableProps {
  page: string;
  section: string;
  columns: Column[];
  rows: Record<string, string>[];
  tableId: string;
}

export default function AddRowTable({ page, section, columns, rows, tableId }: AddRowTableProps) {
  const { addRow, removeRow, updateRowField } = useForm();

  return (
    <div>
      <table className="add-row-table" id={tableId}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key}>
                  <input
                    id={`field-${page}-${section}-${i}-${col.key}`}
                    type={col.type || 'text'}
                    value={row[col.key] || ''}
                    onChange={e => updateRowField(page, section, i, col.key, e.target.value)}
                    aria-label={`${col.label} (row ${i + 1})`}
                  />
                  <label htmlFor={`field-${page}-${section}-${i}-${col.key}`} className="sr-only">
                    {col.label} (row {i + 1})
                  </label>
                </td>
              ))}
              <td>
                <button className="btn-danger" onClick={() => removeRow(page, section, i)} aria-label={`Remove row ${i + 1}`}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-secondary add-row-btn" onClick={() => addRow(page, section)}>
        + Add Row
      </button>
    </div>
  );
}
