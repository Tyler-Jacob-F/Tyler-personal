import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/AppShell';
import { ActivityPage } from '@/routes/admin/ActivityPage';
import { TokensPage } from '@/routes/admin/TokensPage';
import { BriefDetail } from '@/routes/briefs/BriefDetail';
import { GroupFrame, GroupGate } from '@/group/GroupGate';
import { CalendarPage } from '@/routes/group/CalendarPage';
import { ClaimPage } from '@/routes/group/ClaimPage';
import { EventEdit, MemberEdit, QuestionsEdit, SignupEdit } from '@/routes/group/edit';
import { GroupHome } from '@/routes/group/GroupHome';
import { GroupLanding } from '@/routes/group/GroupLanding';
import { MembersPage } from '@/routes/group/MembersPage';
import { QuestionsPage } from '@/routes/group/QuestionsPage';
import { SignupsPage } from '@/routes/group/SignupsPage';
import { Home } from '@/routes/home/Home';
import { NotYet } from '@/routes/NotYet';
import { RecipeDetail } from '@/routes/recipes/RecipeDetail';
import { RecipeDiff } from '@/routes/recipes/RecipeDiff';
import { RecipeEditor } from '@/routes/recipes/RecipeEditor';
import { RecipeHistory } from '@/routes/recipes/RecipeHistory';
import { RecipeList } from '@/routes/recipes/RecipeList';
import { SignIn } from '@/routes/SignIn';
import { StackPage } from '@/routes/stack/StackPage';

/**
 * Route table. Screens are added under the shell as phases bring them. The group slice sits
 * behind its own gate (docs/phases/04-group.md): a signed-in admin sees it inside the shell,
 * a co-lead and every device in the group's own chrome, and the link landing needs nothing.
 */
export function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/group/sign-in" element={<SignIn client="group" />} />
      <Route path="/g/:token" element={<GroupLanding />} />
      <Route element={<GroupGate />}>
        <Route element={<GroupFrame />}>
          <Route path="/group" element={<GroupHome />} />
          <Route path="/group/questions" element={<QuestionsPage />} />
          <Route path="/group/questions/new" element={<QuestionsEdit />} />
          <Route path="/group/questions/:id" element={<QuestionsPage />} />
          <Route path="/group/questions/:id/edit" element={<QuestionsEdit />} />
          <Route path="/group/signups" element={<SignupsPage />} />
          <Route path="/group/signups/new" element={<SignupEdit />} />
          <Route path="/group/signups/:id" element={<SignupsPage />} />
          <Route path="/group/signups/:id/edit" element={<SignupEdit />} />
          <Route path="/group/calendar" element={<CalendarPage />} />
          <Route path="/group/calendar/new" element={<EventEdit />} />
          <Route path="/group/calendar/:id/edit" element={<EventEdit />} />
          <Route path="/group/members" element={<MembersPage />} />
          <Route path="/group/members/new" element={<MemberEdit />} />
          <Route path="/group/members/:id/edit" element={<MemberEdit />} />
          <Route path="/group/claim" element={<ClaimPage />} />
        </Route>
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="/briefs/:id" element={<BriefDetail />} />
          <Route path="/recipes" element={<RecipeList />} />
          <Route path="/recipes/new" element={<RecipeEditor />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditor />} />
          <Route path="/recipes/:id/history" element={<RecipeHistory />} />
          <Route path="/recipes/:id/diff" element={<RecipeDiff />} />
          <Route path="/writing" element={<NotYet place="Writing" phase="Phase 5" />} />
          <Route path="/stack" element={<StackPage />} />
          <Route path="/admin/tokens" element={<TokensPage />} />
          <Route path="/admin/activity" element={<ActivityPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
