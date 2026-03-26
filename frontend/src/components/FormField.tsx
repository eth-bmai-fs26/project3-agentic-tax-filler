/**
 * @file FormField.tsx
 *
 * A reusable form field component that renders the correct HTML input element
 * based on the `type` prop: text input, number input, date picker, dropdown
 * select, checkbox, or textarea. It reads and writes its value through the
 * shared FormContext, so all form fields across every page share one
 * centralized data store.
 *
 * This component is the building block used on nearly every tax form page.
 * The parent page simply specifies what page/section/field it belongs to
 * and what type it should be, and FormField handles rendering, labelling,
 * and data binding automatically.
 *
 * The field id follows the pattern "field-{page}-{section}-{name}", which
 * the AI agent uses to target and fill specific fields programmatically.
 */

import { useForm } from '../context/FormContext';

/**
 * Props accepted by the FormField component.
 *
 * @property page        - The top-level form page (e.g. "personal", "income").
 * @property section     - The section within the page (e.g. "taxpayer", "employer").
 * @property name        - The individual field name within the section (e.g. "firstName").
 * @property label       - Human-readable label shown above/beside the input.
 * @property type        - Which kind of input to render. Defaults to "text".
 * @property options     - For "select" type only: array of { value, label } pairs.
 * @property required    - If true, a red asterisk is shown next to the label.
 * @property fullWidth   - If true, the field spans the full container width
 *                         instead of the default column layout.
 * @property readOnly    - If true, the user cannot edit the field.
 * @property placeholder - Optional placeholder text for text/number inputs.
 */
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

/**
 * FormField -- renders a single labelled form input of the appropriate type
 * and keeps it in sync with the centralized form data store.
 *
 * Rendering logic:
 *  - checkbox:  rendered as a standalone checkbox + label.
 *  - select:    rendered as a <select> dropdown with options.
 *  - textarea:  rendered as a multi-line text area.
 *  - default:   rendered as an <input> with the given type (text/number/date).
 *
 * @param props - See FormFieldProps for details on each property.
 * @returns A labelled form input element.
 */
export default function FormField({
  page, section, name, label, type = 'text',
  options, required, fullWidth, readOnly, placeholder,
}: FormFieldProps) {
  // Access the shared form data and the function to update individual fields
  const { data, updateField } = useForm();

  // Build a unique HTML id for this field.
  // Example: "field-personal-taxpayer-firstName"
  // This id is also used by the AI agent to locate and fill fields.
  const id = `field-${page}-${section}-${name}`;

  // Drill into the nested form data structure to get this field's current value.
  // The data is organized as: data[page][section][name] = value
  // We use optional chaining (?.) because the section or field might not exist yet.
  const pageData = data[page as keyof typeof data] as Record<string, Record<string, unknown>>;
  const value = pageData?.[section]?.[name] ?? '';

  /**
   * Updates the field's value in the shared form context.
   * Works for both string values (text inputs) and boolean values (checkboxes).
   *
   * @param val - The new value to store.
   */
  const handleChange = (val: string | boolean) => {
    updateField(page, section, name, val);
  };

  // ---------- Checkbox rendering ----------
  // Checkboxes have a different layout: the input comes before the label,
  // and there is no floating-label wrapper.
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

  // ---------- Select (dropdown) rendering ----------
  if (type === 'select') {
    // Track whether the user has picked a value so we can style the
    // placeholder state ("-- Select --") differently from a real selection.
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
            {/* Default placeholder option */}
            <option value="">— Select —</option>
            {/* Render each option from the options array */}
            {options?.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label htmlFor={id}>
            {label}
            {/* Show a red asterisk for required fields */}
            {required && <span className="field-required"> *</span>}
          </label>
        </div>
      </div>
    );
  }

  // ---------- Textarea rendering ----------
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

  // ---------- Default: text / number / date input ----------
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
          /* A space placeholder (" ") is used for the CSS floating-label
             trick: the label floats up when the input is not empty or focused,
             and this requires the placeholder to not be truly empty. */
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
