/**
 * @file WealthPage.tsx
 *
 * This file contains all the "Wealth" section form pages for the tax return.
 * In Switzerland, both income AND wealth are taxed, so taxpayers must declare
 * all their assets (and debts) at year-end.
 *
 * The wealth section includes these sub-pages (in order):
 *   1. "securities"  - Securities register (stocks, bonds, funds) + bank accounts
 *   2. "movable"     - Cash, gold, precious metals + business/corporation shares
 *   3. "insurance"   - Life and pension insurance policies (surrender values)
 *   4. "vehicles"    - Motor vehicles (cars, motorcycles, etc.)
 *   5. "real-estate" - Real estate properties + other assets
 *   6. "debts"       - Outstanding debts and liabilities
 *
 * Most sub-pages use the AddRowTable component for dynamic tables where
 * the user can add multiple entries (e.g. multiple bank accounts, securities).
 *
 * Swiss-specific terminology:
 * - Wertschriftenverzeichnis: Securities register (official name for the list
 *   of all stocks, bonds, and fund positions)
 * - ISIN: International Securities Identification Number (globally unique ID)
 * - Steuerwert: Tax assessment value of a property (set by the canton)
 * - Eigenmietwert: Imputed rental value of owner-occupied property
 * - Schuldenverzeichnis: Debt register
 *
 * Navigation: other-deductions -> securities -> movable -> insurance ->
 *             vehicles -> real-estate -> debts -> attachments
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import AddRowTable from '../components/AddRowTable';
import FormNav from '../components/FormNav';

/**
 * Column definitions for the securities (stocks, bonds, funds) table.
 * Each security has a name, ISIN identifier, quantity held,
 * total value in CHF, and gross return (dividends + interest earned).
 */
const securityColumns = [
  { key: 'name', label: 'Name' },
  { key: 'isin', label: 'ISIN' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'value', label: 'Value (CHF)' },
  { key: 'grossReturn', label: 'Gross Return' },
];

/**
 * Column definitions for bank accounts table.
 * The balance is reported as of December 31 (tax year end),
 * and interest is the total earned during the year.
 */
const bankColumns = [
  { key: 'bankName', label: 'Bank Name' },
  { key: 'balance', label: 'Balance Dec 31' },
  { key: 'interest', label: 'Interest' },
];

/**
 * Column definitions for business and corporation shares table.
 * These are shares in private companies (not publicly traded),
 * which require separate reporting from securities.
 */
const businessShareColumns = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'description', label: 'Exact Description' },
  { key: 'wealthAmount', label: 'Wealth Amount (CHF)' },
  { key: 'incomeAmount', label: 'Income Amount (CHF)' },
];

/** Column definitions for life/pension insurance policies table */
const insuranceColumns = [
  { key: 'company', label: 'Insurance Company' },
  { key: 'policyNumber', label: 'Policy Number' },
  { key: 'surrenderValue', label: 'Surrender Value (CHF)' },
];

/** Column definitions for motor vehicles table */
const vehicleColumns = [
  { key: 'type', label: 'Type' },
  { key: 'brand', label: 'Brand / Model' },
  { key: 'year', label: 'Year' },
  { key: 'value', label: 'Value (CHF)' },
];

/** Column definitions for the debts table */
const debtColumns = [
  { key: 'creditor', label: 'Creditor' },
  { key: 'amount', label: 'Amount (CHF)' },
];

/**
 * Props for the WealthPage component.
 */
interface WealthPageProps {
  /** Which sub-page to display (e.g. 'securities', 'movable', 'debts') */
  sub: string;
}

/**
 * WealthPage - Renders one of several wealth/asset declaration sub-pages.
 *
 * Reads form data from FormContext to populate dynamic tables
 * (securities, bank accounts, etc.) via AddRowTable.
 *
 * @param sub - The sub-page identifier
 * @returns The JSX for the requested sub-page, or null if no match
 */
export default function WealthPage({ sub }: WealthPageProps) {
  const { data } = useForm();
  const navigate = useNavigate();

  /* ---- Securities Register ----
     This sub-page combines two related tables:
     1. Securities (stocks, bonds, funds) with ISIN codes and values
     2. Bank accounts with year-end balances and interest earned
     Both are part of the official "Wertschriftenverzeichnis". */
  if (sub === 'securities') {
    return (
      <div>
        <h1>Securities Register</h1>

        <FormSection title="Securities (Wertschriftenverzeichnis)" id="section-wealth-securities">
          <AddRowTable
            page="wealth"
            section="securities"
            columns={securityColumns}
            rows={data.wealth.securities as unknown as Record<string, string>[]}
            tableId="field-wealth-securities-table"
          />
        </FormSection>

        <FormSection title="Bank Accounts" id="section-wealth-bankaccounts">
          <AddRowTable
            page="wealth"
            section="bankaccounts"
            columns={bankColumns}
            rows={data.wealth.bankaccounts as unknown as Record<string, string>[]}
            tableId="field-wealth-bankaccounts-table"
          />
        </FormSection>

        <FormNav
          onBack={() => navigate('/deductions/other')}
          backLabel="← Deductions"
          onNext={() => navigate('/wealth/movable')}
          nextLabel="Next: Movable Assets →"
        />
      </div>
    );
  }

  /* ---- Movable Assets ----
     Covers physical valuable items: cash, gold, precious metals,
     and shares in private businesses or corporations.
     Note: normal household goods do NOT need to be declared. */
  if (sub === 'movable') {
    return (
      <div>
        <h1>Movable Assets</h1>

        <FormSection title="Cash, Gold and Other Precious Metals" id="section-wealth-cashgold">
          <div className="form-grid">
            <FormField page="wealth" section="movableassets" name="cashgold" label="Amount (CHF)" type="number" />
          </div>
          <div className="info-note">
            Normal household goods do not need to be declared.
          </div>
        </FormSection>

        <FormSection title="Business & Corporation Shares" id="section-wealth-businessshares">
          <AddRowTable
            page="wealth"
            section="businessshares"
            columns={businessShareColumns}
            rows={data.wealth.businessshares as unknown as Record<string, string>[]}
            tableId="field-wealth-businessshares-table"
          />
        </FormSection>

        <FormNav
          onBack={() => navigate('/wealth')}
          backLabel="← Securities"
          onNext={() => navigate('/wealth/insurance')}
          nextLabel="Next: Insurance →"
        />
      </div>
    );
  }

  /* ---- Life & Pension Insurance ----
     Life insurance policies and pension insurance have a "surrender value"
     (Rueckkaufswert) which counts as part of the taxpayer's wealth.
     This is the amount the taxpayer would receive if they cancelled the policy. */
  if (sub === 'insurance') {
    return (
      <div>
        <h1>Life & Pension Insurance</h1>

        <FormSection title="Life and Pension Insurance Policies" id="section-wealth-insurances">
          <AddRowTable
            page="wealth"
            section="insurances"
            columns={insuranceColumns}
            rows={data.wealth.insurances as unknown as Record<string, string>[]}
            tableId="field-wealth-insurances-table"
          />
        </FormSection>

        <FormNav
          onBack={() => navigate('/wealth/movable')}
          backLabel="← Movable Assets"
          onNext={() => navigate('/wealth/vehicles')}
          nextLabel="Next: Vehicles →"
        />
      </div>
    );
  }

  /* ---- Motor Vehicles ---- */
  if (sub === 'vehicles') {
    return (
      <div>
        <h1>Motor Vehicles</h1>

        <FormSection title="Motor Vehicles (Motorfahrzeuge)" id="section-wealth-vehicles">
          <AddRowTable
            page="wealth"
            section="vehicles"
            columns={vehicleColumns}
            rows={data.wealth.vehicles as unknown as Record<string, string>[]}
            tableId="field-wealth-vehicles-table"
          />
        </FormSection>

        <FormNav
          onBack={() => navigate('/wealth/insurance')}
          backLabel="← Insurance"
          onNext={() => navigate('/wealth/real-estate')}
          nextLabel="Next: Real Estate →"
        />
      </div>
    );
  }

  /* ---- Real Estate ----
     For each property owned, the taxpayer must declare:
     - Address of the property
     - Eigenmietwert: imputed rental value (for owner-occupied properties)
     - Steuerwert: the official tax assessment value set by the canton
     Also includes a section for any other assets not covered elsewhere. */
  if (sub === 'real-estate') {
    return (
      <div>
        <h1>Real Estate</h1>

        <FormSection title="Real Estate (Liegenschaften)" id="section-wealth-realestate">
          <div className="form-grid">
            <FormField page="wealth" section="realestate" name="address" label="Property Address" fullWidth />
            <FormField page="wealth" section="realestate" name="eigenmietwert" label="Imputed Rental Value (Eigenmietwert)" type="number" />
            <FormField page="wealth" section="realestate" name="steuerwert" label="Tax Value (Steuerwert)" type="number" />
          </div>
        </FormSection>

        <FormSection title="Other Assets" id="section-wealth-otherassets">
          <div className="form-grid">
            <FormField page="wealth" section="otherassets" name="description" label="Description" fullWidth />
            <FormField page="wealth" section="otherassets" name="value" label="Value (CHF)" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/wealth/vehicles')}
          backLabel="← Vehicles"
          onNext={() => navigate('/wealth/debts')}
          nextLabel="Next: Debts →"
        />
      </div>
    );
  }

  /* ---- Debts ----
     The debt register (Schuldenverzeichnis) lists all outstanding debts.
     Debts reduce the taxpayer's net wealth, so declaring them lowers the
     wealth tax. Common entries include mortgages and personal loans. */
  if (sub === 'debts') {
    return (
      <div>
        <h1>Debts</h1>

        <FormSection title="Debts (Schuldenverzeichnis)" id="section-wealth-debts">
          <AddRowTable
            page="wealth"
            section="debts"
            columns={debtColumns}
            rows={data.wealth.debts as unknown as Record<string, string>[]}
            tableId="field-wealth-debts-table"
          />
        </FormSection>

        <FormNav
          onBack={() => navigate('/wealth/real-estate')}
          backLabel="← Real Estate"
          onNext={() => navigate('/attachments')}
          nextLabel="Next: Attachments →"
        />
      </div>
    );
  }

  return null;
}
