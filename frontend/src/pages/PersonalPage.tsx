/**
 * @file PersonalPage.tsx
 *
 * This file contains all the "Personal" section form pages for the tax return.
 * Instead of having 8 separate page files, we use a single component that
 * renders different content based on the `sub` prop (sub-page identifier).
 *
 * The personal section includes these sub-pages (in order):
 *   1. "taxpayer"        - Main taxpayer details + partner details if married
 *   2. "children"        - List of children (dynamic add/remove rows)
 *   3. "supported"       - Financially supported persons
 *   4. "representative"  - Tax representative / authorized person
 *   5. "gifts-received"  - Gifts and inheritances received
 *   6. "gifts-given"     - Gifts and advance inheritances given
 *   7. "capital-benefits"- Capital benefits from pension/insurance
 *   8. "bank-details"    - Bank account info for tax refunds
 *
 * Each sub-page uses shared reusable components:
 * - FormField:    renders a single labeled input field
 * - FormSection:  wraps fields in a collapsible section with a title
 * - AddRowTable:  renders a dynamic table where users can add/remove rows
 * - FormNav:      renders Back/Next navigation buttons at the bottom
 *
 * Navigation flows linearly: taxpayer -> children -> supported -> ... -> bank-details -> income
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from '../context/FormContext';
import FormField from '../components/FormField';
import FormSection from '../components/FormSection';
import AddRowTable from '../components/AddRowTable';
import FormNav from '../components/FormNav';

/**
 * Dropdown options for the marital status field.
 * The `value` is stored in the form data, the `label` is displayed to the user.
 */
const maritalOptions = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'separated', label: 'Separated' },
  { value: 'widowed', label: 'Widowed' },
];

/**
 * Dropdown options for religion/denomination field.
 * In Switzerland, church tax depends on religious affiliation,
 * so this is a required field in the tax return.
 */
const religionOptions = [
  { value: 'reformed', label: 'Reformed' },
  { value: 'catholic', label: 'Roman Catholic' },
  { value: 'christ-catholic', label: 'Christ Catholic' },
  { value: 'orthodox', label: 'Orthodox Christian' },
  { value: 'none', label: 'None' },
  { value: 'other', label: 'Other' },
];

/**
 * Column definitions for the children table.
 * Each object describes one column in the AddRowTable component:
 * - `key`:   the field name used to store the data
 * - `label`: the column header text displayed to the user
 * - `type`:  optional input type (e.g. 'date' renders a date picker)
 */
const childColumns = [
  { key: 'name', label: 'Child Name' },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
  { key: 'relationship', label: 'Relationship' },
];

/** Column definitions for the supported persons table */
const supportedColumns = [
  { key: 'name', label: 'Name' },
  { key: 'relationship', label: 'Relationship' },
  { key: 'contribution', label: 'Contribution (CHF)' },
];

/** Column definitions for gifts (used for both received and given) */
const giftColumns = [
  { key: 'description', label: 'Description' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'amount', label: 'Amount (CHF)' },
];

/**
 * Props for the PersonalPage component.
 * The `sub` prop determines which sub-page to render.
 */
interface PersonalPageProps {
  /** Which sub-page to display (e.g. 'taxpayer', 'children', 'bank-details') */
  sub: string;
}

/**
 * PersonalPage - Renders one of several personal information sub-pages.
 *
 * This component reads the `sub` prop to decide which sub-page to show.
 * It uses a series of if-statements (not a switch) to match the sub-page
 * identifier, then returns the appropriate JSX.
 *
 * The form data is read from and written to the shared FormContext,
 * which is a global state container that all form pages share.
 *
 * @param sub - The sub-page identifier (e.g. 'taxpayer', 'children', etc.)
 * @returns The JSX for the requested sub-page, or null if no match
 */
export default function PersonalPage({ sub }: PersonalPageProps) {
  /** Access the shared form data from FormContext */
  const { data } = useForm();
  const navigate = useNavigate();

  // Check if the taxpayer is married, because married taxpayers
  // need to fill in additional partner details on the taxpayer page
  const isMarried = data.personal.main.maritalstatus === 'married';

  // Build display names for the taxpayer and partner.
  // These are used in section titles to personalize the form.
  // If no name has been entered yet, we fall back to "Taxpayer" / "Partner".
  const fullName = [data.personal.main.firstName, data.personal.main.lastName].filter(Boolean).join(' ') || 'Taxpayer';
  const partnerName = [data.personal.partner.firstName, data.personal.partner.lastName].filter(Boolean).join(' ') || 'Partner';

  /* ---- Taxpayer Details ----
     This is the main/first sub-page where the taxpayer enters their
     personal information: name, address, contact info, marital status, etc.
     If the taxpayer is married, a partner section is also shown below. */
  if (sub === 'taxpayer') {
    return (
      <div>
        <h1>Taxpayer Details</h1>

        {/* IMPORTANT DESIGN NOTE: Both taxpayer AND partner sections are
            always rendered in the DOM (not hidden behind a tab/toggle).
            This is intentional so the AI agent's scanPage() function can
            discover ALL fields on the page. Previously, partner fields
            were conditionally rendered behind an activeTab check, which
            made them invisible to the agent. */}

        {/* Section title changes based on marital status to include the taxpayer's name */}
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
