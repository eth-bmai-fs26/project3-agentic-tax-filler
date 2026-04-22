/**
 * @file FormSection.tsx
 *
 * A simple wrapper component that groups related form fields under a titled
 * section. Each form page is divided into several FormSections -- for example,
 * the "Personal" page might have sections for "Taxpayer Details", "Address",
 * and "Civil Status".
 *
 * The component renders a <section> HTML element with a heading (<h2>) and
 * then places all child elements beneath it. The CSS class "form-section"
 * provides consistent spacing, borders, and layout across the application.
 */

import type { ReactNode } from 'react';

/**
 * Props for the FormSection component.
 *
 * @property title    - The heading text displayed at the top of the section
 *                      (e.g. "Taxpayer Details").
 * @property children - The React elements to render inside the section.
 *                      Typically a collection of FormField components.
 * @property id       - Optional HTML id attribute for the <section> element.
 *                      Useful for anchor links and automated testing.
 */
interface FormSectionProps {
  title: string;
  children: ReactNode;
  id?: string;
}

/**
 * FormSection -- renders a titled container that visually groups related
 * form fields together.
 *
 * @param props - See FormSectionProps for details.
 * @returns A <section> element containing a heading and the child content.
 */
export default function FormSection({ title, children, id }: FormSectionProps) {
  return (
    <section className="form-section" id={id}>
      {/* Section title displayed as a prominent heading */}
      <h2>{title}</h2>
      {/* All child elements (typically FormField components) are rendered here */}
      {children}
    </section>
  );
}
