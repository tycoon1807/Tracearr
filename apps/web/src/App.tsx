import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Activity } from '@/pages/Activity';
import { Users } from '@/pages/Users';
import { UserDetail } from '@/pages/UserDetail';
import { Rules } from '@/pages/Rules';
import { Violations } from '@/pages/Violations';
import { Settings } from '@/pages/Settings';
import { NotFound } from '@/pages/NotFound';

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="activity" element={<Activity />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="rules" element={<Rules />} />
          <Route path="violations" element={<Violations />} />
          <Route path="settings/*" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
