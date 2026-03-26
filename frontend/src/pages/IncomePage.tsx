/**
 * @file IncomePage.tsx
 *
 * This file contains all the "Income" section form pages for the tax return.
 * Like PersonalPage, it uses a single component that renders different
 * content based on the `sub` prop.
 *
 * The income section includes these sub-pages (in order):
 *   1. "employment"  - Gross salary, social contributions, self-employment
 *   2. "pensions"    - AHV/IV pension, BVG pension, other pensions, capital withdrawals
 *   3. "securities"  - Investment income (dividends and interest)
 *   4. "property"    - Rental value (Eigenmietwert), rental income, maintenance costs
 *   5. "other"       - Alimony received, miscellaneous other income
 *
 * Swiss-specific terminology used in this file:
 * - Bruttolohn:      Gross salary before any deductions
 * - AHV/IV/EO:       Swiss social security contributions (old-age, disability, loss of earnings)
 * - BVG:             Occupational pension fund (second pillar of Swiss pension system)
 * - Eigenmietwert:   Imputed rental value -- if you own and live in your home,
 *                    Swiss tax law treats it as if you're renting it to yourself
 *
 * Navigation: bank-details -> employment -> pensions -> securities -> property -> other -> deductions
 */

import { useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import FormNav from '../components/FormNav';

/**
 * Props for the IncomePage component.
 */
interface IncomePageProps {
  /** Which sub-page to display (e.g. 'employment', 'pensions', 'securities') */
  sub: string;
}

/**
 * IncomePage - Renders one of several income-related form sub-pages.
 *
 * Unlike PersonalPage, this component does not need to read form data
 * directly (no useForm() call) because the FormField components handle
 * reading and writing form values internally via FormContext.
 *
 * @param sub - The sub-page identifier (e.g. 'employment', 'pensions', etc.)
 * @returns The JSX for the requested sub-page, or null if no match
 */
export default function IncomePage({ sub }: IncomePageProps) {
  const navigate = useNavigate();

  /* ---- Employment ----
     Main employment income page. Includes both employed and self-employed
     income sections. The self-employment section has revenue, expenses,
     and net income fields. */
  if (sub === 'employment') {
    return (
      <div>
        <h1>Employment Income</h1>

        <FormSection title="Employment Income (Erwerbseinkommen)" id="section-income-employment">
          <div className="form-grid">
            <FormField page="income" section="employment" name="bruttolohn" label="Gross Salary (Bruttolohn)" type="number" required />
            <FormField page="income" section="employment" name="ahvcontributions" label="AHV/IV/EO Contributions" type="number" />
            <FormField page="income" section="employment" name="bvgcontributions" label="BVG/Pension Fund Contributions" type="number" />
          </div>
        </FormSection>

        <FormSection title="Self-Employment (Selbständige Erwerbstätigkeit)" id="section-income-selfemployment">
          {/* <FormField page="income" section="selfemployment" name="enabled" label="I have self-employment income" type="checkbox" /> */}
            <div className="form-grid" style={{ marginTop: 16 }}>
              <FormField page="income" section="selfemployment" name="revenue" label="Revenue" type="number" />
              <FormField page="income" section="selfemployment" name="expenses" label="Business Expenses" type="number" />
              <FormField page="income" section="selfemployment" name="netincome" label="Net Income" type="number" />
            </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/personal/bank-details')}
          backLabel="← Bank Details"
          onNext={() => navigate('/income/pensions')}
          nextLabel="Next: Pensions →"
        />
      </div>
    );
  }

  /* ---- Pensions & Insurance ----
     Switzerland has a 3-pillar pension system:
     - Pillar 1 (AHV/IV): State pension, mandatory for all workers
     - Pillar 2 (BVG):    Occupational pension, mandatory for employed workers
     - Pillar 3 (3a/3b):  Private pension savings (handled in deductions)
     This page covers pension income received from Pillars 1 and 2,
     plus capital withdrawals from pension funds. */
  if (sub === 'pensions') {
    return (
      <div>
        <h1>Pensions & Insurance</h1>

        <FormSection title="AHV / IV Pension" id="section-income-ahv">
          <div className="form-grid">
            <FormField page="income" section="pension" name="ahvpension" label="AHV/IV Pension" type="number" />
          </div>
        </FormSection>

        <FormSection title="Occupational Pension (BVG)" id="section-income-bvg">
          <div className="form-grid">
            <FormField page="income" section="pension" name="bvgpension" label="BVG Pension" type="number" />
          </div>
        </FormSection>

        <FormSection title="Other Pensions" id="section-income-otherpension">
          <div className="form-grid">
            <FormField page="income" section="pension" name="otherpension" label="Other Pension Income" type="number" />
          </div>
        </FormSection>

        <FormSection title="Capital Withdrawals from Pension" id="section-income-capitalwithdrawals">
          <div className="form-grid">
            <FormField page="income" section="capitalwithdrawals" name="amount" label="Capital Withdrawal Amount" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/income')}
          backLabel="← Employment"
          onNext={() => navigate('/income/securities-income')}
          nextLabel="Next: Securities Income →"
        />
      </div>
    );
  }

  /* ---- Securities Income ----
     Investment income from stocks, bonds, funds, etc.
     Dividends and interest are reported separately because they
     may be taxed differently in the Swiss tax system. */
  if (sub === 'securities') {
    return (
      <div>
        <h1>Securities Income</h1>

        <FormSection title="Investment Income" id="section-income-investment">
          <div className="form-grid">
            <FormField page="income" section="investment" name="dividends" label="Dividends" type="number" />
            <FormField page="income" section="investment" name="interest" label="Interest" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/income/pensions')}
          backLabel="← Pensions"
          onNext={() => navigate('/income/property-income')}
          nextLabel="Next: Property Income →"
        />
      </div>
    );
  }

  /* ---- Property Income ----
     If the taxpayer owns property, they must declare:
     - Eigenmietwert (imputed rental value): the theoretical rent they
       would pay if they rented their own home. This is a uniquely Swiss
       concept -- homeowners are taxed on this notional income.
     - Rental income: actual rent received from tenants
     - Maintenance costs: deductible costs for property upkeep */
  if (sub === 'property') {
    return (
      <div>
        <h1>Property Income</h1>

        <FormSection title="Rental Value / Rental Income" id="section-income-rental">
          <div className="form-grid">
            <FormField page="income" section="rental" name="eigenmietwert" label="Imputed Rental Value (Eigenmietwert)" type="number" />
            <FormField page="income" section="rental" name="rentalincome" label="Rental Income" type="number" />
            <FormField page="income" section="rental" name="maintenancecosts" label="Property Maintenance Costs" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/income/securities-income')}
          backLabel="← Securities Income"
          onNext={() => navigate('/income/other')}
          nextLabel="Next: Other Income →"
        />
      </div>
    );
  }

  /* ---- Other Income ----
     Catches income that does not fit into the previous categories:
     - Alimony received (taxable income in Switzerland)
     - Any other miscellaneous income sources */
  if (sub === 'other') {
    return (
      <div>
        <h1>Other Income</h1>

        <FormSection title="Alimony Received" id="section-income-alimony">
          <div className="form-grid">
            <FormField page="income" section="alimony" name="amount" label="Alimony Amount" type="number" />
          </div>
        </FormSection>

        <FormSection title="Other Income" id="section-income-other">
          <div className="form-grid">
            <FormField page="income" section="otherincome" name="description" label="Description" fullWidth />
            <FormField page="income" section="otherincome" name="amount" label="Amount" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/income/property-income')}
          backLabel="← Property Income"
          onNext={() => navigate('/deductions')}
          nextLabel="Next: Deductions →"
        />
      </div>
    );
  }

  return null;
}
