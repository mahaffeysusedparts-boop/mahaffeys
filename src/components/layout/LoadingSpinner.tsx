import { LoaderCircle } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div
      className="flex min-h-[50vh] w-full items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/90 px-6 py-5 text-primary shadow-sm ring-1 ring-border/60">
        <LoaderCircle className="h-8 w-8 animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">Loading…</span>
      </div>
    </div>
  );
}
