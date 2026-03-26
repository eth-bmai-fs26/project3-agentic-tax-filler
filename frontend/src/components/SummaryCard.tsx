/**
 * @file SummaryCard.tsx
 *
 * An overview card used on the tax return summary / overview page. Each card
 * represents a major category of the tax form (e.g. "Income", "Deductions",
 * "Wealth") and lists the key line items within that category along with
 * their fill status.
 *
 * Clicking on any line item navigates the user directly to the corresponding
 * form page so they can view or edit the data. An optional "total" row at the
 * bottom can display an aggregated value (e.g. total income).
 */

import { useNavigate } from 'react-router-dom';

/**
 * A single line item inside a SummaryCard.
 *
 * @property label  - Descriptive text for the item (e.g. "Employment Income").
 * @property value  - Optional formatted value string (e.g. "CHF 85,000").
 * @property status - Visual indicator: "filled" (green), "attention" (amber),
 *                    or "empty" (grey). Controls CSS styling.
 * @property link   - The route path to navigate to when the item is clicked.
 */
interface SummaryItem {
  label: string;
  value?: string;
  status: 'filled' | 'attention' | 'empty';
  link: string;
}

/**
 * Props for the SummaryCard component.
 *
 * @property title      - The card heading (e.g. "Income").
 * @property icon       - An emoji or icon string shown next to the title.
 * @property items      - Array of line items to display in the card body.
 * @property totalLabel - Optional label for a summary total row at the bottom.
 * @property totalValue - Optional value for the summary total row.
 */
interface SummaryCardProps {
  title: string;
  icon: string;
  items: SummaryItem[];
  totalLabel?: string;
  totalValue?: string;
}

/**
 * SummaryCard -- renders a category overview card with clickable line items
 * and an optional total row.
 *
 * @param props - See SummaryCardProps for details.
 * @returns A card element containing the header, line items, and optional total.
 */
export default function SummaryCard({ title, icon, items, totalLabel, totalValue }: SummaryCardProps) {
  const navigate = useNavigate();

  return (
    <div className="summary-card">
      {/* ----- Card header: icon + title ----- */}
      <div className="summary-card-header">
        <span className="summary-card-icon">{icon}</span>
        <h3>{title}</h3>
      </div>

      {/* ----- Card body: list of clickable line items ----- */}
      <div className="summary-card-body">
        {items.map((item, i) => (
          /* Each item acts as a clickable link that navigates to the
             corresponding form page. The CSS class changes based on
             the item's status to show green (filled), amber (needs
             attention), or default (empty) styling. */
          <a
            key={i}
            className={`summary-item${item.status === 'filled' ? ' summary-item-filled' : ''}${item.status === 'attention' ? ' summary-item-attention' : ''}`}
            onClick={() => navigate(item.link)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate(item.link)}
          >
            {/* Item description */}
            <span className="summary-item-label">{item.label}</span>
            {/* Optional value (only shown if provided) */}
            {item.value && <span className="summary-item-value">{item.value}</span>}
            {/* Info icon on the right side */}
            <span className="summary-item-info">
              <span className="info-icon">i</span>
            </span>
          </a>
        ))}
      </div>

      {/* ----- Optional total row at the bottom of the card ----- */}
      {/* Only rendered when a totalLabel is provided */}
      {totalLabel && (
        <div className="summary-card-total">
          <span className="summary-card-total-label">{totalLabel}</span>
          {/* Show an em-dash if no total value is available */}
          <span className="summary-card-total-value">{totalValue || '—'}</span>
        </div>
      )}
    </div>
  );
}
