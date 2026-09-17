import type { ReactNode } from 'react';

export type ViewPlaceholderProps = {
  title: string;
  description: string;
  /** Short list of what the finished view will contain. */
  items?: readonly string[];
  children?: ReactNode;
};

/** Neutral shell the feature views render until their real content lands. */
export function ViewPlaceholder({ title, description, items, children }: ViewPlaceholderProps) {
  return (
    <section className="card p-5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {items && items.length > 0 ? (
        <ul className="mt-4 grid gap-1.5 text-sm text-muted">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-accent">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
