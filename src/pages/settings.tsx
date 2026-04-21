export default function SettingsPage() {
  const mockMode = import.meta.env.VITE_USE_MOCK === 'true';
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">App environment</p>
      </header>
      <div className="rounded-lg border bg-card p-4">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data mode</dt>
            <dd className="mt-0.5">{mockMode ? 'Mock (VITE_USE_MOCK=true)' : 'Dataverse (connected)'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Environment ID</dt>
            <dd className="mt-0.5 font-mono text-xs">{import.meta.env.VITE_DV_ENV_ID ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Connection ID</dt>
            <dd className="mt-0.5 font-mono text-xs">{import.meta.env.VITE_DV_CONNECTION_ID ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Build</dt>
            <dd className="mt-0.5">v0.1 · Dev</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
