/**
 * @file FileUploadSlot.tsx
 *
 * A single file-upload field used on the "Attachments" page of the tax form.
 * Each slot lets the user pick one file (e.g., a salary certificate PDF) and
 * stores the file's name in the shared form data so the review page can list
 * which documents have been attached.
 *
 * Important: this component only records the file *name* in the form context.
 * The actual file content is not uploaded to a server in this demo; it is just
 * tracked locally for display purposes.
 */

import { useForm } from '../context/FormContext';

/**
 * Props for the FileUploadSlot component.
 *
 * @property label - The descriptive label shown next to the file picker
 *                   (e.g. "Salary Certificate").
 * @property name  - The key under which the uploaded filename is stored in
 *                   `data.attachments.uploads` (e.g. "salaryCert").
 * @property id    - The HTML id attribute for the <input> element. Used to
 *                   link the <label> and support automated testing / agents.
 */
interface FileUploadSlotProps {
  label: string;
  name: string;
  id: string;
}

/**
 * FileUploadSlot -- renders a labelled file input with a confirmation message
 * once a file has been chosen.
 *
 * @param props - See FileUploadSlotProps for details.
 * @returns A file-upload field element.
 */
export default function FileUploadSlot({ label, name, id }: FileUploadSlotProps) {
  // Pull the current form data and the updater function from the shared context
  const { data, updateField } = useForm();

  // Look up the currently stored filename for this slot.
  // It will be undefined if no file has been chosen yet.
  const filename = data.attachments.uploads[name as keyof typeof data.attachments.uploads];

  /**
   * Called whenever the user selects a file via the browser file picker.
   * We extract the file's name (not the file itself) and save it into the
   * form context under attachments > uploads > [name].
   *
   * @param e - The change event from the <input type="file"> element.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // e.target.files is a FileList; grab the first (and only) file
    const file = e.target.files?.[0];
    if (file) {
      // Store just the filename string (e.g. "salary_2025.pdf")
      updateField('attachments', 'uploads', name, file.name);
    }
  };

  return (
    <div className="file-upload-slot">
      {/* Visible label for the upload slot */}
      <label htmlFor={id}>{label}</label>

      {/* The native file picker input */}
      <input
        id={id}
        type="file"
        onChange={handleChange}
        aria-label={label}
      />

      {/* Confirmation text shown after a file has been chosen */}
      {filename && <span className="file-name">Uploaded: {filename}</span>}
    </div>
  );
}
