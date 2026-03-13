import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import AddRowTable from '../components/AddRowTable';
import FormNav from '../components/FormNav';

const berufsauslagenOptions = [
  { value: 'flat-rate', label: 'Flat-rate (Pauschale)' },
  { value: 'effective', label: 'Effective (Effektiv)' },
];

const effectiveColumns = [
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount (CHF)' },
];

interface DeductionsPageProps {
  sub: string;
}

export default function DeductionsPage({ sub }: DeductionsPageProps) {
  const { data } = useForm();
  const navigate = useNavigate();
  const isMarried = data.personal.main.maritalstatus === 'married';
  const hasChildren = data.personal.children.length > 0;
  const hasYoungChildren = data.personal.children.some(c => {
    if (!c.dateOfBirth) return false;
    const age = (new Date().getFullYear()) - new Date(c.dateOfBirth).getFullYear();
    return age < 14;
  });
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

  /* ---- Other Professional Expenses ---- */
  if (sub === 'professional') {
    return (
      <div>
        <h1>Other Professional Expenses</h1>

        <FormSection title="Professional Expenses (Berufsauslagen)" id="section-deductions-berufsauslagen">
          <FormField
            page="deductions" section="berufsauslagen" name="type"
            label="Deduction Type" type="select" options={berufsauslagenOptions}
          />
          {!isEffective && (
            <div className="flat-rate-display" style={{ marginTop: 16 }}>
              Flat-rate deduction: CHF 2,000 (automatically applied)
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

  /* ---- Alimony / Maintenance ---- */
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

  /* ---- Insurance Premiums ---- */
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

  /* ---- Medical Costs ---- */
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

  /* ---- Other Deductions ---- */
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
