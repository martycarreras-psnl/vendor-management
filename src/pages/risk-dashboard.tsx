export default function RiskDashboardPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Risk Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vendor × assessment heatmap</p>
      </header>
      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="text-sm font-semibold">Coming next iteration</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This view will aggregate OneTrust and ServiceNow assessments into a PHI / ePHI / Criticality heatmap.
          For v1, open any vendor's Risk tab for the same data per-vendor.
        </p>
      </div>
    </div>
  );
}
