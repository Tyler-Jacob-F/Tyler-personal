import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/AppShell';
import { TokensPage } from '@/routes/admin/TokensPage';
import { EditRecipe } from '@/routes/recipes/EditRecipe';
import { NewRecipe } from '@/routes/recipes/NewRecipe';
import { RecipeDetail } from '@/routes/recipes/RecipeDetail';
import { RecipeDiff } from '@/routes/recipes/RecipeDiff';
import { RecipeHistory } from '@/routes/recipes/RecipeHistory';
import { RecipeList } from '@/routes/recipes/RecipeList';
import { SignIn } from '@/routes/SignIn';
import { StackPage } from '@/routes/stack/StackPage';

/** Route table. Screens are added under the shell as phases bring them. */
export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/recipes" replace />} />
          <Route path="/recipes" element={<RecipeList />} />
          <Route path="/recipes/new" element={<NewRecipe />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/recipes/:id/edit" element={<EditRecipe />} />
          <Route path="/recipes/:id/history" element={<RecipeHistory />} />
          <Route path="/recipes/:id/diff" element={<RecipeDiff />} />
          <Route path="/stack" element={<StackPage />} />
          <Route path="/admin/tokens" element={<TokensPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
