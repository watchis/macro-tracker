import type { ReactNode } from 'react';

export type SettingsSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

/** Card wrapper shared by every settings group, labelled for screen readers. */
export function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`settings-section-${id}`}
      className="card p-5"
    >
      <h2 id={headingId} className="text-base font-semibold tracking-tight">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
