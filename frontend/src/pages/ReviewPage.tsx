/**
 * @file ReviewPage.tsx
 *
 * This is the final page of the tax return where the user can review
 * all entered data before submitting. It displays a read-only summary
 * of every section (Personal, Income, Deductions, Wealth, Attachments)
 * and highlights any validation warnings for missing required fields.
 *
 * At the bottom, the user can click "Submit & Export JSON" to download
 * the complete form data as a JSON file. This JSON file represents
 * the completed tax return.
 *
 * The page also performs basic validation, checking for commonly
 * required fields like name, AHV number, gross salary, and
 * salary statement upload. Warnings are shown as a banner at the top.
 *
 * Navigation: attachments -> review (final page)
 */

import { useForm } from '../context/FormContext';

/**
 * ReviewRow - A single label-value pair in the review summary.
 *
 * Renders a row with a label on the left and a value on the right.
 * If the value is empty/falsy, the entire row is hidden (returns null)
 * to avoid showing blank entries in the review.
 *
 * @param label - The field label (e.g. "Name", "Gross Salary")
 * @param value - The field value to display (e.g. "Anna Meier", "CHF 85,000")
 * @returns A review row div, or null if value is empty
 */
function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="review-row">
      <span className="review-label">{label}</span>
      <span className="review-value">{value}</span>
    </div>
  );
}

/**
 * ReviewPage - The final review and submission page.
 *
 * This component:
 * 1. Reads the entire form data from FormContext
 * 2. Runs basic validation checks and collects warnings
 * 3. Displays all form data in read-only review sections
 * 4. Provides a "Submit & Export JSON" button to download the data
 *
 * @returns The review page UI with all sections summarized
 */
export default function ReviewPage() {
  const { data } = useForm();

  // Validation: check for commonly required fields and collect warning messages.
  // These warnings are displayed as a banner at the top of the page to alert
  // the user about potentially incomplete sections before they submit.
  const warnings: string[] = [];
  if (!data.personal.main.firstName) warnings.push('First name is missing');
  if (!data.personal.main.lastName) warnings.push('Last name is missing');
  if (!data.personal.main.ahvnumber) warnings.push('AHV number is missing');
  if (!data.personal.main.maritalstatus) warnings.push('Marital status is not selected');
  if (!data.income.employment.bruttolohn) warnings.push('Gross salary (Bruttolohn) is missing');
  if (!data.attachments.uploads.lohnausweis) warnings.push('Salary statement (Lohnausweis) not uploaded');
  if (!data.personal.bankdetails.iban) warnings.push('Bank details for refund not provided');

  /**
   * Exports the complete form data as a downloadable JSON file.
   * Uses the same Blob + anchor element pattern as the Dashboard's download.
   * The file is named "zh-tax-filing-2025.json" (zh = Zurich canton).
   */
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zh-tax-filing-2025.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build the taxpayer's full name for display in the review
  const fullName = [data.personal.main.firstName, data.personal.main.lastName].filter(Boolean).join(' ');

  return (
    <div>
      <h1>Review & Submit</h1>

      {warnings.length > 0 && (
        <div className="alert-banner" style={{ marginBottom: 20, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <strong>Validation Warnings:</strong>
          {warnings.map((w, i) => (
            <span key={i}>&#8226; {w}</span>
          ))}
        </div>
      )}

      {/* --- Personal Information Section ---
           Shows the taxpayer's basic info. Partner details are only shown
           if the marital status is "married". Children names are displayed
           as a comma-separated list if any children were entered. */}
      <section className="review-section">
        <h2>Personal Information</h2>
        <ReviewRow label="Name" value={fullName} />
        {/* Build a formatted address from individual address fields */}
        <ReviewRow label="Address" value={[data.personal.main.street, data.personal.main.streetNumber, data.personal.main.zip, data.personal.main.city].filter(Boolean).join(', ')} />
        <ReviewRow label="Date of Birth" value={data.personal.main.dateofbirth} />
        <ReviewRow label="AHV Number" value={data.personal.main.ahvnumber} />
        <ReviewRow label="Marital Status" value={data.personal.main.maritalstatus} />
        <ReviewRow label="Religion" value={data.personal.main.religion} />
        <ReviewRow label="Occupation" value={data.personal.main.occupation} />
        <ReviewRow label="Employer" value={data.personal.main.employer} />
        <ReviewRow label="Phone" value={data.personal.main.phone} />
        <ReviewRow label="Email" value={data.personal.main.email} />
        {/* Conditionally show partner details only if married */}
        {data.personal.main.maritalstatus === 'married' && (
          <>
            <ReviewRow label="Partner Name" value={[data.personal.partner.firstName, data.personal.partner.lastName].filter(Boolean).join(' ')} />
            <ReviewRow label="Partner DOB" value={data.personal.partner.dateofbirth} />
            <ReviewRow label="Partner AHV" value={data.personal.partner.ahvnumber} />
          </>
        )}
        {/* Show children names only if any were entered */}
        {data.personal.children.length > 0 && (
          <ReviewRow label="Children" value={data.personal.children.map(c => c.name).filter(Boolean).join(', ')} />
        )}
        <ReviewRow label="Bank IBAN" value={data.personal.bankdetails.iban} />
      </section>

      {/* --- Income Section ---
           Each field is prefixed with "CHF" for display.
           Self-employment details are only shown if the user enabled
           the self-employment toggle on the income page. */}
      <section className="review-section">
        <h2>Income</h2>
        <ReviewRow label="Gross Salary" value={data.income.employment.bruttolohn ? `CHF ${data.income.employment.bruttolohn}` : ''} />
        <ReviewRow label="AHV Contributions" value={data.income.employment.ahvcontributions ? `CHF ${data.income.employment.ahvcontributions}` : ''} />
        <ReviewRow label="BVG Contributions" value={data.income.employment.bvgcontributions ? `CHF ${data.income.employment.bvgcontributions}` : ''} />
        {/* Self-employment details are conditionally rendered */}
        {data.income.selfemployment.enabled && (
          <>
            <ReviewRow label="Self-Empl. Revenue" value={data.income.selfemployment.revenue ? `CHF ${data.income.selfemployment.revenue}` : ''} />
            <ReviewRow label="Self-Empl. Expenses" value={data.income.selfemployment.expenses ? `CHF ${data.income.selfemployment.expenses}` : ''} />
            <ReviewRow label="Self-Empl. Net" value={data.income.selfemployment.netincome ? `CHF ${data.income.selfemployment.netincome}` : ''} />
          </>
        )}
        <ReviewRow label="AHV Pension" value={data.income.pension.ahvpension ? `CHF ${data.income.pension.ahvpension}` : ''} />
        <ReviewRow label="BVG Pension" value={data.income.pension.bvgpension ? `CHF ${data.income.pension.bvgpension}` : ''} />
        <ReviewRow label="Other Pension" value={data.income.pension.otherpension ? `CHF ${data.income.pension.otherpension}` : ''} />
        <ReviewRow label="Dividends" value={data.income.investment.dividends ? `CHF ${data.income.investment.dividends}` : ''} />
        <ReviewRow label="Interest" value={data.income.investment.interest ? `CHF ${data.income.investment.interest}` : ''} />
        <ReviewRow label="Rental Value" value={data.income.rental.eigenmietwert ? `CHF ${data.income.rental.eigenmietwert}` : ''} />
        <ReviewRow label="Rental Income" value={data.income.rental.rentalincome ? `CHF ${data.income.rental.rentalincome}` : ''} />
      </section>

      <section className="review-section">
        <h2>Deductions</h2>
        <ReviewRow label="Professional Expenses" value={data.deductions.berufsauslagen.type === 'flat-rate' ? 'Flat-rate CHF 2,000' : 'Effective (itemized)'} />
        <ReviewRow label="Commuting Costs" value={data.deductions.fahrkosten.amount ? `CHF ${data.deductions.fahrkosten.amount}` : ''} />
        <ReviewRow label="Meal Allowance" value={data.deductions.verpflegung.amount ? `CHF ${data.deductions.verpflegung.amount}` : ''} />
        <ReviewRow label="Pillar 3a" value={data.deductions.pillar3a.amount ? `CHF ${data.deductions.pillar3a.amount}` : ''} />
        <ReviewRow label="Insurance" value={data.deductions.insurance.amount ? `CHF ${data.deductions.insurance.amount}` : ''} />
        <ReviewRow label="Debt Interest" value={data.deductions.schuldzinsen.amount ? `CHF ${data.deductions.schuldzinsen.amount}` : ''} />
        <ReviewRow label="Childcare" value={data.deductions.kinderbetreuungskosten.amount ? `CHF ${data.deductions.kinderbetreuungskosten.amount}` : ''} />
        <ReviewRow label="Education" value={data.deductions.weiterbildungskosten.amount ? `CHF ${data.deductions.weiterbildungskosten.amount}` : ''} />
        <ReviewRow label="Donations" value={data.deductions.donations.amount ? `CHF ${data.deductions.donations.amount}` : ''} />
        <ReviewRow label="Medical" value={data.deductions.medical.amount ? `CHF ${data.deductions.medical.amount}` : ''} />
        <ReviewRow label="Alimony Paid" value={data.deductions.unterhaltsbeitraege.amount ? `CHF ${data.deductions.unterhaltsbeitraege.amount}` : ''} />
      </section>

      <section className="review-section">
        <h2>Wealth</h2>
        <ReviewRow label="Securities" value={data.wealth.securities.length > 0 ? `${data.wealth.securities.length} position(s)` : ''} />
        <ReviewRow label="Bank Accounts" value={data.wealth.bankaccounts.length > 0 ? `${data.wealth.bankaccounts.length} account(s)` : ''} />
        <ReviewRow label="Cash / Gold" value={data.wealth.movableassets.cashgold ? `CHF ${data.wealth.movableassets.cashgold}` : ''} />
        <ReviewRow label="Business Shares" value={data.wealth.businessshares.length > 0 ? `${data.wealth.businessshares.length} share(s)` : ''} />
        <ReviewRow label="Insurance Policies" value={data.wealth.insurances.length > 0 ? `${data.wealth.insurances.length} policy(ies)` : ''} />
        <ReviewRow label="Vehicles" value={data.wealth.vehicles.length > 0 ? `${data.wealth.vehicles.length} vehicle(s)` : ''} />
        <ReviewRow label="Real Estate Value" value={data.wealth.realestate.eigenmietwert ? `CHF ${data.wealth.realestate.eigenmietwert}` : ''} />
        <ReviewRow label="Real Estate Tax Value" value={data.wealth.realestate.steuerwert ? `CHF ${data.wealth.realestate.steuerwert}` : ''} />
        <ReviewRow label="Debts" value={data.wealth.debts.length > 0 ? `${data.wealth.debts.length} debt(s)` : ''} />
      </section>

      <section className="review-section">
        <h2>Attachments</h2>
        <ReviewRow label="Salary Statement" value={data.attachments.uploads.lohnausweis || 'Not uploaded'} />
        <ReviewRow label="Bank Statements" value={data.attachments.uploads.bankstatements || 'Not uploaded'} />
        <ReviewRow label="Pillar 3a" value={data.attachments.uploads.pillar3a || 'Not uploaded'} />
        <ReviewRow label="Deduction Receipts" value={data.attachments.uploads.deductions || 'Not uploaded'} />
        <ReviewRow label="Property Assessment" value={data.attachments.uploads.property || 'Not uploaded'} />
        <ReviewRow label="Other" value={data.attachments.uploads.other || 'Not uploaded'} />
      </section>

      {/* Navigation buttons: Back goes to previous page via browser history,
           Submit triggers the JSON export/download.
           The submit button has a special id="submit-export" which the AI agent
           uses to programmatically click it when submitting the form. */}
      <div className="page-nav">
        <button className="btn-secondary" onClick={() => window.history.back()} data-testid="nav-back" aria-label="Back">&larr; Back</button>
        <button className="btn-primary" onClick={handleExport} id="submit-export" data-testid="nav-next" aria-label="Submit">
          Submit & Export JSON
        </button>
      </div>
    </div>
  );
}
