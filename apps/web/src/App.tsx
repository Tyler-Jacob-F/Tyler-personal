import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/AppShell';
import { SignIn } from '@/routes/SignIn';

/** Route table. Screens are added under the shell as phases bring them. */
export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/recipes" replace />} />
          <Route
            path="/recipes"
            element={<p className="text-muted-foreground">Recipes arrive next.</p>}
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
