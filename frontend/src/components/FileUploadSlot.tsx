import { useForm } from '../context/FormContext';

interface FileUploadSlotProps {
  label: string;
  name: string;
  id: string;
}

export default function FileUploadSlot({ label, name, id }: FileUploadSlotProps) {
  const { data, updateField } = useForm();
  const filename = data.attachments.uploads[name as keyof typeof data.attachments.uploads];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateField('attachments', 'uploads', name, file.name);
    }
  };

  return (
    <div className="file-upload-slot">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        onChange={handleChange}
        aria-label={label}
      />
      {filename && <span className="file-name">Uploaded: {filename}</span>}
    </div>
  );
}
