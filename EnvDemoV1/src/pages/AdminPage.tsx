export default function AdminPage() {
  return (
    <div>
      <h1>Administration / Reset</h1>
      <div className="form-section">
        <h2>Delegation</h2>
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 16 }}>
          Delegate your tax filing to a third party (e.g., tax advisor, trustee).
        </p>
        <button className="btn-secondary">Add Delegate</button>
      </div>
      <div className="form-section">
        <h2>Reset Tax Return</h2>
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 16 }}>
          Reset all entered data and start over. This action cannot be undone.
        </p>
        <button className="btn-danger">Reset All Data</button>
      </div>
    </div>
  );
}
