/** Placeholder with the form's rough shape while the client form loads (avoids layout shift). */
export function FormSkeleton() {
  return (
    <div aria-hidden className="animate-pulse space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 rounded-xl bg-muted" />
      ))}
    </div>
  );
}
