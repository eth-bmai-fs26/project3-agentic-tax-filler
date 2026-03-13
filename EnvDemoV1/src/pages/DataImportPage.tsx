export default function DataImportPage() {
  return (
    <div>
      <h1>Data Import / Provisional Tax Calculation</h1>
      <div className="form-section">
        <h2>Import Prior Year Data</h2>
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 16 }}>
          Import data from your previous tax return or upload a data file from your employer.
        </p>
        <button className="btn-primary">Import Data</button>
      </div>
      <div className="form-section">
        <h2>Provisional Tax Calculation</h2>
        <p style={{ color: '#555', fontSize: '0.9rem' }}>
          Calculate a provisional estimate of your tax liability based on current data.
        </p>
      </div>
    </div>
  );
}
