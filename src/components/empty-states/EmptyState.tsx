/**
 * Standardized empty state — brutalist blocked-out treatment.
 */
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-start gap-4 border-2 border-ink bg-card p-10 shadow-brut">
      <span aria-hidden className="absolute -top-3 left-6 border-2 border-ink bg-acid px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
        EMPTY
      </span>
      <h3 className="font-display text-3xl uppercase leading-none tracking-tight">{title}</h3>
      {description && (
        <p className="max-w-md font-sans text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
