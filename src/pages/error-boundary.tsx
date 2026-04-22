// Error boundary page for the router — shows the actual error instead of a generic 404.

import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function ErrorBoundaryPage() {
  const error = useRouteError();

  // Genuine 404 (route not matched)
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="w-full max-w-md px-8 text-center flex flex-col items-center space-y-6">
          <h1 className="text-5xl leading-tight tracking-tight">404 – Not found</h1>
          <p className="text-muted-foreground">This isn&rsquo;t the page you&rsquo;re looking for.</p>
          <Button variant="outline" asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Any other error (component crash, missing context, etc.)
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error, null, 2);

  const stack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="min-h-dvh grid place-items-center bg-background">
      <div className="w-full max-w-2xl px-8 flex flex-col items-center space-y-6">
        <h1 className="text-3xl font-semibold text-destructive">Something went wrong</h1>
        <p className="text-sm text-muted-foreground text-center">
          The app encountered an unexpected error. The details below can help diagnose the issue.
        </p>
        <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm font-mono text-destructive whitespace-pre-wrap break-words">
          {message}
        </div>
        {stack && (
          <details className="w-full">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Stack trace
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {stack}
            </pre>
          </details>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
