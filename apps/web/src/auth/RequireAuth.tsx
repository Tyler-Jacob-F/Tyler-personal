import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/auth/useAuth';

/** Route wrapper: anonymous visitors go to sign-in and come back to where they were. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'restoring') {
    return <p className="p-6 text-sm text-muted">Signing you back in…</p>;
  }
  if (state.status !== 'signedIn') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
