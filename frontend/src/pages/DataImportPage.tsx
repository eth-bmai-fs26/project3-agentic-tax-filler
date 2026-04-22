/**
 * @file DataImportPage.tsx
 *
 * This page is a placeholder for two features that are not yet implemented:
 *
 *   1. Data Import: In a real Swiss tax filing system, taxpayers can import
 *      data from their previous year's tax return to pre-fill many fields.
 *      Some employers also provide data files that can be uploaded directly.
 *      This saves time by avoiding re-entering information that has not changed.
 *
 *   2. Provisional Tax Calculation: A tool that estimates how much tax the
 *      taxpayer will owe based on the data entered so far. This helps
 *      taxpayers understand their tax liability before officially submitting.
 *
 * Both features are currently UI mockups with non-functional buttons.
 * This page is accessible from the sidebar navigation.
 */

/**
 * DataImportPage - Placeholder page for data import and tax calculation features.
 *
 * This is a static UI mockup. The "Import Data" button does not have
 * an onClick handler yet. The provisional tax calculation section
 * does not have any interactive elements at all.
 *
 * @returns The data import page UI with import and calculation sections
 */
export default function DataImportPage() {
  return (
    <div>
      <h1>Data Import / Provisional Tax Calculation</h1>

      {/* Data import section: would allow uploading a prior year's tax file
          or an employer-provided data file to pre-populate form fields */}
      <div className="form-section">
        <h2>Import Prior Year Data</h2>
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 16 }}>
          Import data from your previous tax return or upload a data file from your employer.
        </p>
        <button className="btn-primary">Import Data</button>
      </div>

      {/* Provisional tax calculation section: would compute an estimated
          tax amount based on the income, deductions, and wealth entered so far */}
      <div className="form-section">
        <h2>Provisional Tax Calculation</h2>
        <p style={{ color: '#555', fontSize: '0.9rem' }}>
          Calculate a provisional estimate of your tax liability based on current data.
        </p>
      </div>
    </div>
  );
}
