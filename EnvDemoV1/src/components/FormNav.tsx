interface FormNavProps {
  onBack?: () => void;
  onNext?: () => void;
  backLabel?: string;
  nextLabel?: string;
}

export default function FormNav({
  onBack,
  onNext,
  backLabel = '← Back',
  nextLabel = 'Next →',
}: FormNavProps) {
  return (
    <div className="page-nav">
      <button
        id="btn-back"
        className="btn-secondary"
        onClick={onBack}
        disabled={!onBack}
        data-testid="nav-back"
        aria-label="Back"
      >
        {backLabel}
      </button>
      <button
        id="btn-save-draft"
        className="btn-secondary"
        data-testid="nav-save"
        aria-label="Save draft"
      >
        Save Draft
      </button>
      <button
        id="btn-next"
        className="btn-primary"
        onClick={onNext}
        disabled={!onNext}
        data-testid="nav-next"
        aria-label="Next"
      >
        {nextLabel}
      </button>
    </div>
  );
}
