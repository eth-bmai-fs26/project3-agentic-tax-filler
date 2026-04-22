import { useNavigate } from 'react-router-dom';
import FormSection from '../components/FormSection';
import FileUploadSlot from '../components/FileUploadSlot';
import FormNav from '../components/FormNav';

export default function AttachmentsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Attachments</h1>

      <FormSection title="Upload Documents" id="section-attachments-uploads">
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
