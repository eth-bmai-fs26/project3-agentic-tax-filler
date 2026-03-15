import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import AddRowTable from '../components/AddRowTable';
import FormNav from '../components/FormNav';

const maritalOptions = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'separated', label: 'Separated' },
  { value: 'widowed', label: 'Widowed' },
];

const religionOptions = [
  { value: 'reformed', label: 'Reformed' },
  { value: 'catholic', label: 'Roman Catholic' },
  { value: 'christ-catholic', label: 'Christ Catholic' },
  { value: 'none', label: 'None' },
  { value: 'other', label: 'Other' },
];

const childColumns = [
  { key: 'name', label: 'Child Name' },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
  { key: 'relationship', label: 'Relationship' },
];

const supportedColumns = [
  { key: 'name', label: 'Name' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'contribution', label: 'Contribution (CHF)' },
];

const giftColumns = [
  { key: 'description', label: 'Description' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'amount', label: 'Amount (CHF)' },
];

interface PersonalPageProps {
  sub: string;
}

export default function PersonalPage({ sub }: PersonalPageProps) {
  const { data } = useForm();
  const navigate = useNavigate();
  const isMarried = data.personal.main.maritalstatus === 'married';

  const fullName = [data.personal.main.firstName, data.personal.main.lastName].filter(Boolean).join(' ') || 'Taxpayer';
  const partnerName = [data.personal.partner.firstName, data.personal.partner.lastName].filter(Boolean).join(' ') || 'Partner';

  /* ---- Taxpayer Details ---- */
  if (sub === 'taxpayer') {
    return (
      <div>
        <h1>Taxpayer Details</h1>

        {/* ── FIX: Both taxpayer and partner
            sections render simultaneously so scanPage() can discover
            ALL fields. Previously partner fields were behind an
            activeTab === 'partner' condition, making them invisible
            to the agent's scanPage() call. ── */}

        <FormSection title={isMarried ? `Personal Details — ${fullName}` : 'Personal Details'} id="section-personal-main">
          <div className="form-grid-3">
            <FormField page="personal" section="main" name="firstName" label="First Name" required />
            <FormField page="personal" section="main" name="lastName" label="Last Name" required />
            <FormField page="personal" section="main" name="dateofbirth" label="Date of Birth" type="date" required />
          </div>
          <div className="form-grid-3" style={{ marginTop: 20 }}>
            <FormField page="personal" section="main" name="street" label="Street" required />
            <FormField page="personal" section="main" name="streetNumber" label="Number" required />
            <FormField page="personal" section="main" name="apartment" label="Apartment / Suite" />
          </div>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <FormField page="personal" section="main" name="zip" label="ZIP Code" required />
            <FormField page="personal" section="main" name="city" label="City" required />
          </div>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <FormField page="personal" section="main" name="phone" label="Phone" />
            <FormField page="personal" section="main" name="email" label="Email" />
          </div>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <FormField page="personal" section="main" name="maritalstatus" label="Marital Status" type="select" options={maritalOptions} required />
            <FormField page="personal" section="main" name="religion" label="Religion" type="select" options={religionOptions} />
          </div>
          <div className="form-grid-3" style={{ marginTop: 20 }}>
            <FormField page="personal" section="main" name="ahvnumber" label="AHV Number" required />
            <FormField page="personal" section="main" name="occupation" label="Occupation" required />
            <FormField page="personal" section="main" name="employer" label="Employer" />
          </div>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <FormField page="personal" section="main" name="workplace" label="Workplace" />
          </div>
        </FormSection>

      
          <FormSection title={`Partner Details — ${partnerName}`} id="section-personal-partner">
            <div className="form-grid-3">
              <FormField page="personal" section="partner" name="firstName" label="First Name" required />
              <FormField page="personal" section="partner" name="lastName" label="Last Name" required />
              <FormField page="personal" section="partner" name="dateofbirth" label="Date of Birth" type="date" required />
            </div>
            <div className="form-grid" style={{ marginTop: 20 }}>
              <FormField page="personal" section="partner" name="ahvnumber" label="AHV Number" required />
              <FormField page="personal" section="partner" name="religion" label="Religion" type="select" options={religionOptions} />
            </div>
            <div className="form-grid" style={{ marginTop: 20 }}>
              <FormField page="personal" section="partner" name="occupation" label="Occupation" />
              <FormField page="personal" section="partner" name="employer" label="Employer" />
            </div>
          </FormSection>
      

        <FormNav
          onNext={() => navigate('/personal/children')}
          nextLabel="Next: Children →"
        />
      </div>
    );
  }

  /* ---- Children ---- */
  if (sub === 'children') {
    return (
      <div>
        <h1>Children</h1>
        <FormSection title="Children" id="section-personal-children">
          <AddRowTable
            page="personal"
            section="children"
            columns={childColumns}
            rows={data.personal.children as unknown as Record<string, string>[]}
            tableId="field-personal-children-table"
          />
        </FormSection>
        <FormNav
          onBack={() => navigate('/personal')}
          backLabel="← Taxpayer Details"
          onNext={() => navigate('/personal/supported')}
          nextLabel="Next: Supported Persons →"
        />
      </div>
    );
  }

  /* ---- Supported Persons ---- */
  if (sub === 'supported') {
    return (
      <div>
        <h1>Supported Persons</h1>
        <FormSection title="Persons you financially support" id="section-personal-supported">
          <AddRowTable
            page="personal"
            section="supported"
            columns={supportedColumns}
            rows={data.personal.supported as unknown as Record<string, string>[]}
            tableId="field-personal-supported-table"
          />
        </FormSection>
        <FormNav
          onBack={() => navigate('/personal/children')}
          backLabel="← Children"
          onNext={() => navigate('/personal/representative')}
          nextLabel="Next: Representative →"
        />
      </div>
    );
  }

  /* ---- Representative ---- */
  if (sub === 'representative') {
    return (
      <div>
        <h1>Representative</h1>
        <FormSection title="Tax representative / authorized person" id="section-personal-representative">
          <div className="form-grid">
            <FormField page="personal" section="representative" name="name" label="Representative Name" fullWidth />
            <FormField page="personal" section="representative" name="address" label="Address" />
            <FormField page="personal" section="representative" name="phone" label="Phone" />
          </div>
        </FormSection>
        <FormNav
          onBack={() => navigate('/personal/supported')}
          backLabel="← Supported Persons"
          onNext={() => navigate('/personal/gifts-received')}
          nextLabel="Next: Gifts Received →"
        />
      </div>
    );
  }

  /* ---- Gifts / Inheritances Received ---- */
  if (sub === 'gifts-received') {
    return (
      <div>
        <h1>Gifts / Inheritances Received</h1>
        <FormSection title="Gifts and inheritances received during tax year" id="section-personal-giftsreceived">
          <AddRowTable
            page="personal"
            section="giftsreceived"
            columns={giftColumns}
            rows={data.personal.giftsreceived as unknown as Record<string, string>[]}
            tableId="field-personal-giftsreceived-table"
          />
        </FormSection>
        <FormNav
          onBack={() => navigate('/personal/representative')}
          backLabel="← Representative"
          onNext={() => navigate('/personal/gifts-given')}
          nextLabel="Next: Gifts Given →"
        />
      </div>
    );
  }

  /* ---- Gifts / Advance Inheritances Given ---- */
  if (sub === 'gifts-given') {
    return (
      <div>
        <h1>Gifts / Advance Inheritances Given</h1>
        <FormSection title="Gifts and advance inheritances given during tax year" id="section-personal-giftsgiven">
          <AddRowTable
            page="personal"
            section="giftsgiven"
            columns={giftColumns}
            rows={data.personal.giftsgiven as unknown as Record<string, string>[]}
            tableId="field-personal-giftsgiven-table"
          />
        </FormSection>
        <FormNav
          onBack={() => navigate('/personal/gifts-received')}
          backLabel="← Gifts Received"
          onNext={() => navigate('/personal/capital-benefits')}
          nextLabel="Next: Capital Benefits →"
        />
      </div>
    );
  }

  /* ---- Capital Benefits ---- */
  if (sub === 'capital-benefits') {
    return (
      <div>
        <h1>Capital Benefits</h1>
        <FormSection title="Capital benefits from pension funds or insurance" id="section-personal-capitalbenefits">
          <div className="form-grid">
            <FormField page="personal" section="capitalbenefits" name="description" label="Description" fullWidth />
            <FormField page="personal" section="capitalbenefits" name="amount" label="Amount (CHF)" type="number" />
          </div>
        </FormSection>
        <FormNav
          onBack={() => navigate('/personal/gifts-given')}
          backLabel="← Gifts Given"
          onNext={() => navigate('/personal/bank-details')}
          nextLabel="Next: Bank Details →"
        />
      </div>
    );
  }

  /* ---- Bank Details for Refunds ---- */
  if (sub === 'bank-details') {
    return (
      <div>
        <h1>Bank Details for Refunds</h1>
        <FormSection title="Bank account for tax refunds" id="section-personal-bankdetails">
          <div className="form-grid">
            <FormField page="personal" section="bankdetails" name="iban" label="IBAN" required fullWidth />
            <FormField page="personal" section="bankdetails" name="bankname" label="Bank Name" />
            <FormField page="personal" section="bankdetails" name="accountholder" label="Account Holder" />
          </div>
        </FormSection>
        <FormNav
          onBack={() => navigate('/personal/capital-benefits')}
          backLabel="← Capital Benefits"
          onNext={() => navigate('/income')}
          nextLabel="Next: Income →"
        />
      </div>
    );
  }

  return null;
}
