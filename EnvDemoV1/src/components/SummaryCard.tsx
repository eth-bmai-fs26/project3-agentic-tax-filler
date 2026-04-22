import { useNavigate } from 'react-router-dom';

interface SummaryItem {
  label: string;
  value?: string;
  status: 'filled' | 'attention' | 'empty';
  link: string;
}

interface SummaryCardProps {
  title: string;
  icon: string;
  items: SummaryItem[];
  totalLabel?: string;
  totalValue?: string;
}

export default function SummaryCard({ title, icon, items, totalLabel, totalValue }: SummaryCardProps) {
  const navigate = useNavigate();

  return (
    <div className="summary-card">
      <div className="summary-card-header">
        <span className="summary-card-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="summary-card-body">
        {items.map((item, i) => (
          <a
            key={i}
            className={`summary-item${item.status === 'filled' ? ' summary-item-filled' : ''}${item.status === 'attention' ? ' summary-item-attention' : ''}`}
            onClick={() => navigate(item.link)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate(item.link)}
          >
            <span className="summary-item-label">{item.label}</span>
            {item.value && <span className="summary-item-value">{item.value}</span>}
            <span className="summary-item-info">
              <span className="info-icon">i</span>
            </span>
          </a>
        ))}
      </div>
      {totalLabel && (
        <div className="summary-card-total">
          <span className="summary-card-total-label">{totalLabel}</span>
          <span className="summary-card-total-value">{totalValue || '—'}</span>
        </div>
      )}
    </div>
  );
}
