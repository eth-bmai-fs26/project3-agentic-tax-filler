import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import AddRowTable from '../components/AddRowTable';
import FormNav from '../components/FormNav';

const securityColumns = [
  { key: 'name', label: 'Name' },
  { key: 'isin', label: 'ISIN' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'value', label: 'Value (CHF)' },
  { key: 'grossReturn', label: 'Gross Return' },
];

const bankColumns = [
  { key: 'bankName', label: 'Bank Name' },
  { key: 'balance', label: 'Balance Dec 31' },
  { key: 'interest', label: 'Interest' },
];

const businessShareColumns = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'description', label: 'Exact Description' },
  { key: 'wealthAmount', label: 'Wealth Amount (CHF)' },
  { key: 'incomeAmount', label: 'Income Amount (CHF)' },
];

const insuranceColumns = [
  { key: 'company', label: 'Insurance Company' },
  { key: 'policyNumber', label: 'Policy Number' },
  { key: 'surrenderValue', label: 'Surrender Value (CHF)' },
];

const vehicleColumns = [
  { key: 'type', label: 'Type' },
  { key: 'brand', label: 'Brand / Model' },
  { key: 'year', label: 'Year' },
  { key: 'value', label: 'Value (CHF)' },
];

const debtColumns = [
  { key: 'creditor', label: 'Creditor' },
  { key: 'amount', label: 'Amount (CHF)' },
];

interface WealthPageProps {
  sub: string;
}

export default function WealthPage({ sub }: WealthPageProps) {
  const { data } = useForm();
  const navigate = useNavigate();

  /* ---- Securities Register ---- */
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

  /* ---- Movable Assets ---- */
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

  /* ---- Life & Pension Insurance ---- */
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

  /* ---- Real Estate ---- */
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

  /* ---- Debts ---- */
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
