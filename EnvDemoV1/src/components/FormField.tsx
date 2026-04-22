import { useForm } from '../context/FormContext';

interface FormFieldProps {
  page: string;
  section: string;
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  required?: boolean;
  fullWidth?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}

export default function FormField({
  page, section, name, label, type = 'text',
  options, required, fullWidth, readOnly, placeholder,
}: FormFieldProps) {
  const { data, updateField } = useForm();
  const id = `field-${page}-${section}-${name}`;

  const pageData = data[page as keyof typeof data] as Record<string, Record<string, unknown>>;
  const value = pageData?.[section]?.[name] ?? '';

  const handleChange = (val: string | boolean) => {
    updateField(page, section, name, val);
  };

  if (type === 'checkbox') {
    return (
      <div className={`form-field checkbox-field${fullWidth ? ' full-width' : ''}`}>
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={e => handleChange(e.target.checked)}
          aria-label={label}
        />
        <label htmlFor={id}>{label}</label>
      </div>
    );
  }

  if (type === 'select') {
    const hasValue = !!(value as string);
    return (
      <div className={`form-field${fullWidth ? ' full-width' : ''}`}>
        <div className="field-wrapper">
          <select
            id={id}
            value={value as string}
            onChange={e => handleChange(e.target.value)}
            aria-label={label}
            required={required}
            data-empty={!hasValue ? 'true' : 'false'}
            className={hasValue ? 'has-value' : ''}
          >
            <option value="">— Select —</option>
            {options?.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label htmlFor={id}>
            {label}
            {required && <span className="field-required"> *</span>}
          </label>
        </div>
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div className={`form-field${fullWidth ? ' full-width' : ''}`}>
        <div className="field-wrapper">
          <textarea
            id={id}
            value={value as string}
            onChange={e => handleChange(e.target.value)}
            aria-label={label}
            required={required}
            readOnly={readOnly}
            placeholder=" "
          />
          <label htmlFor={id}>
            {label}
            {required && <span className="field-required"> *</span>}
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className={`form-field${fullWidth ? ' full-width' : ''}`}>
      <div className="field-wrapper">
        <input
          id={id}
          type={type}
          value={value as string}
          onChange={e => handleChange(e.target.value)}
          aria-label={label}
          required={required}
          readOnly={readOnly}
          placeholder={placeholder || ' '}
        />
        <label htmlFor={id}>
          {label}
          {required && <span className="field-required"> *</span>}
        </label>
      </div>
    </div>
  );
}
