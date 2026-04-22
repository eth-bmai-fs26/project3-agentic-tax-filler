/**
 * @file AdminPage.tsx
 *
 * This page provides administrative actions for the tax return.
 * It is a placeholder/UI mockup page -- the buttons are currently
 * non-functional (they do not have onClick handlers).
 *
 * In a real Swiss tax filing system, this page would allow:
 *   1. Delegation: authorizing a third party (e.g. a tax advisor or trustee)
 *      to file the tax return on the taxpayer's behalf. This is a common
 *      feature in Swiss cantons where professional tax advisors handle
 *      filings for their clients.
 *   2. Reset: clearing all entered data and starting the tax return
 *      from scratch. This is a destructive action that cannot be undone.
 *
 * This page is accessible from the sidebar navigation.
 */

/**
 * AdminPage - Administrative controls for delegation and data reset.
 *
 * This is a static UI mockup with no interactive functionality yet.
 * The "Add Delegate" and "Reset All Data" buttons are placeholders
 * that would need onClick handlers to become functional.
 *
 * @returns The admin page UI with delegation and reset sections
 */
export default function AdminPage() {
  return (
    <div>
      <h1>Administration / Reset</h1>

      {/* Delegation section: in a real app, this would open a form
          to enter the delegate's details and grant them access */}
      <div className="form-section">
        <h2>Delegation</h2>
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: 16 }}>
          Delegate your tax filing to a third party (e.g., tax advisor, trustee).
        </p>
        <button className="btn-secondary">Add Delegate</button>
      </div>

      {/* Reset section: in a real app, this would clear all form data
          from FormContext and localStorage. The "btn-danger" class gives
          it a red color to warn the user this is a destructive action. */}
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
