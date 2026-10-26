import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ApiProvider } from '@/api/ApiProvider';
import { App } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { cognitoGateway } from '@/auth/gateway';
import { createQueryClient } from '@/lib/query';
import './index.css';

const queryClient = createQueryClient();
const gateway = cognitoGateway();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider gateway={gateway}>
      <ApiProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ApiProvider>
    </AuthProvider>
  </StrictMode>,
);
