/**
 * @file CreatePersonaPage.tsx
 *
 * This page allows users to create a custom taxpayer persona by entering
 * a profile (name, address, DOB, etc.) and uploading tax-relevant documents.
 *
 * Unlike the pre-configured personas that come with the app, a custom
 * persona is defined entirely by the user. The entered profile and uploaded
 * documents are sent to the backend via the `createPersona()` API call,
 * which stores them so the AI agent can later use them to fill in the
 * tax form.
 *
 * After successful creation, the user is redirected back to the Dashboard
 * where the new persona will appear in the "Pending Tax Forms" list.
 *
 * This page does NOT use the shared FormContext because it has its own
 * local form state -- the data here is sent to the backend as a new
 * persona definition, not as part of the tax return form.
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPersona } from '../api/client';

/**
 * CreatePersonaPage - The form for defining a new custom taxpayer persona.
 *
 * Manages its own local state for form fields and file uploads.
 * On submit, packages everything into a FormData object and sends it
 * to the backend API.
 *
 * @returns The create persona page UI
 */
export default function CreatePersonaPage() {
  const navigate = useNavigate();

  /**
   * Ref to the hidden file input element.
   * We use a ref here because clicking the visible "upload area" div
   * programmatically triggers the hidden file input's click event.
   * This is a common pattern for creating custom-styled file upload UIs.
   */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Whether the form is currently being submitted to the backend */
  const [submitting, setSubmitting] = useState(false);
  /** Error message to display, or null if no error */
  const [error, setError] = useState<string | null>(null);

  /**
   * Local form state for the persona profile fields.
   * This is separate from the main tax form data (FormContext) because
   * this data is used to create a new persona on the backend, not to
   * fill in the tax return.
   */
  const [form, setForm] = useState({
    name: '',
    address: '',
    date_of_birth: '',
    ahv_number: '',
    marital_status: '',
    nationality: 'CH',  // Default to Switzerland
    brief: '',           // Free-text description of the taxpayer's situation
  });

  /** Array of File objects the user has selected for upload */
  const [files, setFiles] = useState<File[]>([]);

  /**
   * Creates a change handler for a specific form field.
   * This is a "higher-order function" -- it takes a field name and returns
   * an event handler function. This pattern avoids writing a separate
   * handler for every form field.
   *
   * Usage: onChange={set('name')} creates a handler that updates form.name
   *
   * @param field - The name of the form field to update
   * @returns An event handler that updates the specified field
   */
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  /**
   * Handles file selection from the hidden file input.
   * Converts the FileList (from the input event) to a regular array
   * and stores it in state.
   */
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  /**
   * Handles form submission.
   * 1. Validates that name and at least one document are provided
   * 2. Creates a FormData object (needed for file uploads -- you cannot
   *    send files via regular JSON, you need multipart/form-data)
   * 3. Appends all form fields and files to the FormData
   * 4. Sends it to the backend via the createPersona() API call
   * 5. On success, navigates back to the dashboard
   * 6. On failure, displays the error message
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (files.length === 0) {
      setError('Please upload at least one document (e.g. Lohnausweis)');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // FormData is a browser API that lets you build key-value pairs
      // including file data, which gets sent as multipart/form-data
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      // Each file is appended under the key 'documents' -- the backend
      // expects multiple files under this single key name
      files.forEach(f => fd.append('documents', f));
      await createPersona(fd);
      navigate('/dashboard');
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  /**
   * Shared inline styles for form input fields.
   * These are defined as a CSSProperties object so they can be applied
   * consistently across all inputs, selects, and textareas on this page.
   */
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  /** Shared inline styles for form labels */
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '4px',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1e40af 100%)',
        padding: '32px 40px',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none',
              border: 'none',
              color: '#93c5fd',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              padding: 0,
              marginBottom: '12px',
            }}
          >
            &larr; Back to Dashboard
          </button>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Create New Persona
          </h1>
          <p style={{ color: '#93c5fd', fontSize: '0.875rem', margin: '6px 0 0' }}>
            Define a taxpayer profile and upload their documents
          </p>
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 32px 60px', position: 'relative', zIndex: 1 }}>
        <form onSubmit={handleSubmit} style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          padding: '32px',
        }}>
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#dc2626',
              fontSize: '0.8125rem',
              marginBottom: '20px',
            }}>
              {error}
            </div>
          )}

          {/* Profile section */}
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 16px', letterSpacing: '-0.01em' }}>
            Taxpayer Profile
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input style={fieldStyle} value={form.name} onChange={set('name')} placeholder="e.g. Anna Meier" required />
            </div>
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input style={fieldStyle} type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Address</label>
            <input style={fieldStyle} value={form.address} onChange={set('address')} placeholder="e.g. Bederstrasse 45, 8002 Zurich" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>AHV Number</label>
              <input style={fieldStyle} value={form.ahv_number} onChange={set('ahv_number')} placeholder="756.XXXX.XXXX.XX" />
            </div>
            <div>
              <label style={labelStyle}>Marital Status</label>
              <select style={fieldStyle} value={form.marital_status} onChange={set('marital_status')}>
                <option value="">- Select -</option>
                <option value="ledig">Single</option>
                <option value="verheiratet">Married</option>
                <option value="geschieden">Divorced</option>
                <option value="getrennt">Separated</option>
                <option value="verwitwet">Widowed</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Nationality</label>
              <input style={fieldStyle} value={form.nationality} onChange={set('nationality')} placeholder="CH" />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Brief Description</label>
            <textarea
              style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
              value={form.brief}
              onChange={set('brief')}
              placeholder="Describe the taxpayer's situation, employment, deductions, etc."
            />
          </div>

          {/* Documents section */}
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Documents
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 0 16px' }}>
            Upload tax-relevant documents. Required: at least a salary statement (Lohnausweis) or bank statement.
            Supported formats: .txt, .csv, .pdf, .json
          </p>

          {/* Clickable upload area: clicking anywhere in this div triggers
              the hidden file input. This is a common UX pattern that lets you
              create a large, attractive click target instead of the browser's
              default small "Choose File" button. */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#fafbfc',
              transition: 'border-color 0.15s, background 0.15s',
              marginBottom: '12px',
            }}
            onMouseEnter={e => {
              (e.currentTarget).style.borderColor = '#1e40af';
              (e.currentTarget).style.background = '#f0f4ff';
            }}
            onMouseLeave={e => {
              (e.currentTarget).style.borderColor = '#cbd5e1';
              (e.currentTarget).style.background = '#fafbfc';
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📄</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Click to upload documents
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
              Lohnausweis, bank statements, Pillar 3a confirmations, receipts, etc.
            </div>
          </div>

          {/* Hidden file input: `display: none` makes it invisible.
              `multiple` allows selecting multiple files at once.
              `accept` restricts which file types the browser's file picker shows. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.csv,.pdf,.json,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={handleFiles}
          />

          {/* Display the list of selected files with a remove button for each.
              Each file is shown in a green-tinted row. Clicking the X button
              removes that specific file by filtering it out by index. */}
          {files.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              {files.map((f, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  fontSize: '0.8125rem',
                }}>
                  <span style={{ color: '#166534', fontWeight: 500 }}>{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{
                      background: 'none', border: 'none', color: '#dc2626',
                      cursor: 'pointer', fontSize: '1rem', padding: '0 4px',
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 24px',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: '#1e40af',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 28px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#fff',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Creating…' : 'Create Persona'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
