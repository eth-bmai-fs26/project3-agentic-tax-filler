import type { ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  children: ReactNode;
  id?: string;
}

export default function FormSection({ title, children, id }: FormSectionProps) {
  return (
    <section className="form-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
