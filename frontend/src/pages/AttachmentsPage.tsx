/**
 * @file AttachmentsPage.tsx
 *
 * This page allows the user to upload supporting documents for their
 * tax return. In a real Swiss tax filing, you need to attach various
 * proof documents such as salary statements, bank statements, and receipts.
 *
 * The page provides upload slots for 6 categories of documents:
 *   1. Salary Statement (Lohnausweis) - the most important document
 *   2. Bank Statements - proof of account balances and interest
 *   3. Pillar 3a Confirmation - proof of private pension contributions
 *   4. Deduction Receipts - receipts for claimed deductions
 *   5. Property Assessment - property valuation documents
 *   6. Other Documents - anything else relevant to the tax return
 *
 * Each upload slot is rendered by the FileUploadSlot component, which
 * handles the file selection UI and stores the uploaded file reference
 * in the shared FormContext.
 *
 * Navigation: debts -> attachments -> review
 */

import { useNavigate } from 'react-router-dom';
import FormSection from '../components/FormSection';
import FileUploadSlot from '../components/FileUploadSlot';
import FormNav from '../components/FormNav';

/**
 * AttachmentsPage - The document upload page of the tax return.
 *
 * This is a simple page with no conditional logic -- it always shows
 * all 6 upload slots. The FileUploadSlot components handle the actual
 * file upload interaction and state management internally.
 *
 * @returns The attachments page UI with all upload slots
 */
export default function AttachmentsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Attachments</h1>

      <FormSection title="Upload Documents" id="section-attachments-uploads">
        {/* Each FileUploadSlot is an independent upload area for one document type.
            The `name` prop is used as the key to store the upload in form data.
            The `id` prop provides a unique DOM id for the AI agent to target. */}
        <FileUploadSlot
          label="Salary Statement (Lohnausweis)"
          name="lohnausweis"
          id="field-attachments-lohnausweis-upload"
        />
        <FileUploadSlot
          label="Bank Statements"
          name="bankstatements"
          id="field-attachments-bankstatements-upload"
        />
        <FileUploadSlot
          label="Pillar 3a Confirmation"
          name="pillar3a"
          id="field-attachments-pillar3a-upload"
        />
        <FileUploadSlot
          label="Deduction Receipts"
          name="deductions"
          id="field-attachments-deductions-upload"
        />
        <FileUploadSlot
          label="Property Assessment"
          name="property"
          id="field-attachments-property-upload"
        />
        <FileUploadSlot
          label="Other Documents"
          name="other"
          id="field-attachments-other-upload"
        />
      </FormSection>

      <FormNav
        onBack={() => navigate('/wealth/debts')}
        backLabel="← Debts"
        onNext={() => navigate('/review')}
        nextLabel="Next: Review →"
      />
    </div>
  );
}
