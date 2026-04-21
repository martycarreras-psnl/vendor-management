import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { VendiqProvider } from '@/services/vendiq/provider-context';
import { router } from './router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <VendiqProvider>
        <FluentProvider theme={webLightTheme}>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </FluentProvider>
      </VendiqProvider>
    </QueryClientProvider>
  </StrictMode>,
);
