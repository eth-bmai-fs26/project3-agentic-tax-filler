import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPersona } from '../api/client';

export default function CreatePersonaPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    address: '',
    date_of_birth: '',
    ahv_number: '',
    marital_status: '',
    nationality: 'CH',
    brief: '',
  });

  const [files, setFiles] = useState<File[]>([]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

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
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      files.forEach(f => fd.append('documents', f));
      await createPersona(fd);
      navigate('/dashboard');
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

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

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.csv,.pdf,.json,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={handleFiles}
          />

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
