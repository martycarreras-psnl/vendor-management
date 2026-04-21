export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Saved analytics and exports</p>
      </header>
      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="text-sm font-semibold">Coming next iteration</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Excel exports and chart PNGs are deferred; for now, use the Portfolio and Contract Expiration pages to explore.
        </p>
      </div>
    </div>
  );
}
