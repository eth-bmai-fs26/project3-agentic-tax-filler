/**
 * @file DeductionsPage.tsx
 *
 * This file contains all the "Deductions" section form pages.
 * Deductions reduce the taxpayer's taxable income, so entering them
 * correctly is important for minimizing the tax bill.
 *
 * The deductions section includes these sub-pages (in order):
 *   1. "commuting"      - Commuting costs + meal allowance
 *   2. "professional"   - Professional expenses (flat-rate vs. effective/itemized)
 *   3. "debt-interest"  - Interest paid on debts (e.g. mortgage interest)
 *   4. "alimony"        - Alimony/maintenance payments + childcare + dual-income
 *   5. "insurance"      - Insurance premiums + Pillar 3a contributions
 *   6. "medical"        - Medical expenses above a threshold
 *   7. "other"          - Charitable donations + other deductions
 *
 * This page has some of the most complex conditional rendering in the app:
 * - The "professional expenses" sub-page switches between a flat-rate display
 *   and an itemized table based on the user's chosen deduction type.
 * - The "alimony" sub-page conditionally shows childcare costs (only if
 *   there are children under 14) and a dual-income deduction (only if married).
 *
 * Swiss-specific terminology:
 * - Berufsauslagen:           Professional expenses
 * - Fahrkosten:               Commuting costs
 * - Verpflegungsmehrkosten:   Additional meal costs (when eating away from home)
 * - Schuldzinsen:             Debt interest
 * - Unterhaltsbeitraege:      Alimony/maintenance payments
 * - Kinderbetreuungskosten:   Childcare costs
 * - Zweiverdienerabzug:       Dual-income deduction (for married couples where both work)
 * - Pillar 3a:                Private pension savings (tax-deductible up to a limit)
 *
 * Navigation: other-income -> commuting -> professional -> debt-interest ->
 *             alimony -> insurance -> medical -> other -> wealth
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import AddRowTable from '../components/AddRowTable';
import FormNav from '../components/FormNav';

/**
 * Options for the professional expenses deduction type dropdown.
 * - "flat-rate" (Pauschale): a fixed percentage of net salary is deducted
 *   automatically (3% of net salary, min CHF 2,000, max CHF 4,000).
 * - "effective" (Effektiv): the taxpayer itemizes actual professional expenses
 *   in a table with descriptions and amounts.
 */
const berufsauslagenOptions = [
  { value: 'flat-rate', label: 'Flat-rate (Pauschale)' },
  { value: 'effective', label: 'Effective (Effektiv)' },
];

/** Column definitions for the effective (itemized) professional expenses table */
const effectiveColumns = [
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount (CHF)' },
];

/**
 * Props for the DeductionsPage component.
 */
interface DeductionsPageProps {
  /** Which sub-page to display (e.g. 'commuting', 'professional', 'insurance') */
  sub: string;
}

/**
 * DeductionsPage - Renders one of several deduction-related form sub-pages.
 *
 * This component reads form data to make conditional rendering decisions:
 * - Whether to show partner/dual-income deductions (married status)
 * - Whether to show childcare deductions (children under 14)
 * - Whether to show flat-rate or itemized professional expenses
 *
 * @param sub - The sub-page identifier
 * @returns The JSX for the requested sub-page, or null if no match
 */
export default function DeductionsPage({ sub }: DeductionsPageProps) {
  const { data } = useForm();
  const navigate = useNavigate();

  // Derive boolean flags from form data that control conditional rendering.
  // These determine which optional sections appear on specific sub-pages.

  /** Whether the taxpayer is married (shows dual-income deduction on alimony page) */
  const isMarried = data.personal.main.maritalstatus === 'married';

  /** Whether the taxpayer has any children listed */
  const hasChildren = data.personal.children.length > 0;

  /**
   * Whether any child is under 14 years old.
   * Childcare costs are only deductible in Switzerland for children under 14.
   * We compute the age by subtracting the birth year from the current year.
   * Note: this is an approximate age calculation (does not check month/day).
   */
  const hasYoungChildren = data.personal.children.some(c => {
    if (!c.dateOfBirth) return false;
    const age = (new Date().getFullYear()) - new Date(c.dateOfBirth).getFullYear();
    return age < 14;
  });

  /** Whether the user chose "effective" (itemized) professional expenses vs flat-rate */
  const isEffective = data.deductions.berufsauslagen.type === 'effective';

  /* ---- Commuting Costs ---- */
  if (sub === 'commuting') {
    return (
      <div>
        <h1>Commuting Costs</h1>

        <FormSection title="Commuting Costs (Berufsbedingte Fahrkosten)" id="section-deductions-fahrkosten">
          <div className="form-grid">
            <FormField page="deductions" section="fahrkosten" name="amount" label="Commuting Costs (CHF)" type="number" />
            <FormField page="deductions" section="fahrkosten" name="description" label="Description (route, transport)" />
          </div>
        </FormSection>

        <FormSection title="Meal Allowance (Verpflegungsmehrkosten)" id="section-deductions-verpflegung">
          <div className="form-grid">
            <FormField page="deductions" section="verpflegung" name="amount" label="Meal Allowance (CHF)" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/income/other')}
          backLabel="← Other Income"
          onNext={() => navigate('/deductions/professional')}
          nextLabel="Next: Professional Expenses →"
        />
      </div>
    );
  }

  /* ---- Other Professional Expenses ----
     This sub-page has the most complex rendering logic in the deductions section.
     The user first chooses between "flat-rate" and "effective" deduction modes:
     - Flat-rate: shows a read-only display of the auto-calculated amount
     - Effective: shows a dynamic table where the user can itemize expenses
     Additionally, there are sections for further professional expenses
     and education/training costs. */
  if (sub === 'professional') {
    return (
      <div>
        <h1>Other Professional Expenses</h1>

        <FormSection title="Professional Expenses (Berufsauslagen)" id="section-deductions-berufsauslagen">
          <FormField
            page="deductions" section="berufsauslagen" name="type"
            label="Deduction Type" type="select" options={berufsauslagenOptions}
          />
          {/* {!isEffective && (() => {
            const brutto = Number(data.income.employment.bruttolohn) || 0;
            const ahv = Number(data.income.employment.ahvcontributions) || 0;
            const bvg = Number(data.income.employment.bvgcontributions) || 0;
            const nettolohn = brutto - ahv - bvg;
            const pauschale = Math.min(Math.max(Math.round(nettolohn * 0.03), 2000), 4000);
            return (
              <div className="flat-rate-display" style={{ marginTop: 16 }}>
                Flat-rate deduction: CHF {pauschale.toLocaleString('de-CH')} (3% of net salary, min 2,000 / max 4,000)
              </div>
            );
          })()} */}
          {!isEffective && (
            <div className="flat-rate-display" style={{ marginTop: 16 }}>
              Flat-rate deduction: CHF {Number(data.deductions.flatrate.amount || 2000).toLocaleString('de-CH')} (3% of net salary, min 2,000 / max 4,000 — automatically calculated)
            </div>
          )}
          {isEffective && (
            <div style={{ marginTop: 16 }}>
              <AddRowTable
                page="deductions"
                section="effective"
                columns={effectiveColumns}
                rows={data.deductions.effective as unknown as Record<string, string>[]}
                tableId="field-deductions-effective-table"
              />
            </div>
          )}
        </FormSection>

        <FormSection title="Further Professional Expenses" id="section-deductions-weitere">
          <div className="form-grid">
            <FormField page="deductions" section="weitereberufsauslagen" name="amount" label="Amount (CHF)" type="number" />
            <FormField page="deductions" section="weitereberufsauslagen" name="description" label="Description" />
          </div>
        </FormSection>

        <FormSection title="Education & Training (Weiterbildungskosten)" id="section-deductions-weiterbildungskosten">
          <div className="form-grid">
            <FormField page="deductions" section="weiterbildungskosten" name="amount" label="Education/Training Costs (CHF)" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/deductions')}
          backLabel="← Commuting"
          onNext={() => navigate('/deductions/debt-interest')}
          nextLabel="Next: Debt Interest →"
        />
      </div>
    );
  }

  /* ---- Debt Interest ---- */
  if (sub === 'debt-interest') {
    return (
      <div>
        <h1>Debt Interest</h1>

        <FormSection title="Debt Interest (Schuldzinsen)" id="section-deductions-schuldzinsen">
          <div className="form-grid">
            <FormField page="deductions" section="schuldzinsen" name="amount" label="Debt Interest (CHF)" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/deductions/professional')}
          backLabel="← Professional Expenses"
          onNext={() => navigate('/deductions/alimony')}
          nextLabel="Next: Alimony →"
        />
      </div>
    );
  }

  /* ---- Alimony / Maintenance ----
     This sub-page has conditional sections that appear based on the
     taxpayer's family situation:
     - Childcare costs section: only shown if there are children under 14
       (both `hasChildren` AND `hasYoungChildren` must be true)
     - Dual-income deduction: only shown if the taxpayer is married
       (the Zweiverdienerabzug applies when both spouses earn income) */
  if (sub === 'alimony') {
    return (
      <div>
        <h1>Alimony / Maintenance Payments</h1>

        <FormSection title="Alimony Payments (Unterhaltsbeiträge)" id="section-deductions-unterhalt">
          <div className="form-grid">
            <FormField page="deductions" section="unterhaltsbeitraege" name="amount" label="Amount (CHF)" type="number" />
            <FormField page="deductions" section="unterhaltsbeitraege" name="recipient" label="Recipient" />
          </div>
        </FormSection>

        {hasChildren && hasYoungChildren && (
          <FormSection title="Childcare Costs (Kinderbetreuungskosten)" id="section-deductions-kinderbetreuung">
            <div className="form-grid">
              <FormField page="deductions" section="kinderbetreuungskosten" name="amount" label="Childcare Costs (CHF)" type="number" />
            </div>
          </FormSection>
        )}

        {isMarried && (
          <FormSection title="Dual-Income Deduction (Zweiverdienerabzug)" id="section-deductions-zweiverdiener">
            <div className="form-grid">
              <FormField page="deductions" section="zweiverdienerabzug" name="amount" label="Dual-Income Deduction (CHF)" type="number" />
            </div>
          </FormSection>
        )}

        <FormNav
          onBack={() => navigate('/deductions/debt-interest')}
          backLabel="← Debt Interest"
          onNext={() => navigate('/deductions/insurance')}
          nextLabel="Next: Insurance →"
        />
      </div>
    );
  }

  /* ---- Insurance Premiums ----
     Includes both general insurance premiums and Pillar 3a contributions.
     Pillar 3a is part of Switzerland's 3rd pillar private pension system.
     Contributions to Pillar 3a are tax-deductible up to a yearly maximum
     (currently CHF 7,056 for employed persons with a pension fund). */
  if (sub === 'insurance') {
    return (
      <div>
        <h1>Insurance Premiums</h1>

        <FormSection title="Insurance Premiums (Versicherungsprämien)" id="section-deductions-insurance">
          <div className="form-grid">
            <FormField page="deductions" section="insurance" name="amount" label="Insurance Premiums (CHF)" type="number" />
          </div>
        </FormSection>

        <FormSection title="Pillar 3a" id="section-deductions-pillar3a">
          <div className="form-grid">
            <FormField page="deductions" section="pillar3a" name="amount" label="Pillar 3a Contribution (CHF)" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/deductions/alimony')}
          backLabel="← Alimony"
          onNext={() => navigate('/deductions/medical')}
          nextLabel="Next: Medical →"
        />
      </div>
    );
  }

  /* ---- Medical Costs ----
     In Switzerland, only medical expenses that exceed a certain
     percentage of net income are deductible. The threshold varies
     by canton. This page captures the amount above the threshold. */
  if (sub === 'medical') {
    return (
      <div>
        <h1>Medical Costs</h1>

        <FormSection title="Medical Expenses (Krankheitskosten)" id="section-deductions-medical">
          <div className="form-grid">
            <FormField page="deductions" section="medical" name="amount" label="Medical Expenses above threshold (CHF)" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/deductions/insurance')}
          backLabel="← Insurance"
          onNext={() => navigate('/deductions/other')}
          nextLabel="Next: Other Deductions →"
        />
      </div>
    );
  }

  /* ---- Other Deductions ----
     Covers charitable donations (Spenden) and any other deductions
     that do not fit into the preceding categories. Donations to
     recognized Swiss charities are tax-deductible. */
  if (sub === 'other') {
    return (
      <div>
        <h1>Other Deductions</h1>

        <FormSection title="Charitable Donations (Spenden)" id="section-deductions-donations">
          <div className="form-grid">
            <FormField page="deductions" section="donations" name="amount" label="Donations (CHF)" type="number" />
            <FormField page="deductions" section="donations" name="recipient" label="Recipient / Organization" />
          </div>
        </FormSection>

        <FormSection title="Other Deductions" id="section-deductions-other">
          <div className="form-grid">
            <FormField page="deductions" section="otherdeductions" name="description" label="Description" fullWidth />
            <FormField page="deductions" section="otherdeductions" name="amount" label="Amount (CHF)" type="number" />
          </div>
        </FormSection>

        <FormNav
          onBack={() => navigate('/deductions/medical')}
          backLabel="← Medical"
          onNext={() => navigate('/wealth')}
          nextLabel="Next: Securities →"
        />
      </div>
    );
  }

  return null;
}
