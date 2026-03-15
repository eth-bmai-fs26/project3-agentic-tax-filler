import { useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import FormNav from '../components/FormNav';

interface IncomePageProps {
  sub: string;
}

export default function IncomePage({ sub }: IncomePageProps) {
  const navigate = useNavigate();

  /* ---- Employment ---- */
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

  /* ---- Pensions & Insurance ---- */
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

  /* ---- Securities Income ---- */
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

  /* ---- Property Income ---- */
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

  /* ---- Other Income ---- */
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
