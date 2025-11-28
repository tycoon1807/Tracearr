import { NavLink, Routes, Route } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function SettingsNav() {
  const links = [
    { href: '/settings', label: 'General', end: true },
    { href: '/settings/servers', label: 'Servers' },
    { href: '/settings/notifications', label: 'Notifications' },
    { href: '/settings/access', label: 'Access Control' },
  ];

  return (
    <nav className="flex space-x-4 border-b pb-4">
      {links.map((link) => (
        <NavLink
          key={link.href}
          to={link.href}
          end={link.end}
          className={({ isActive }) =>
            cn(
              'text-sm font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

function GeneralSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">General settings will be displayed here</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ServerSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Servers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Server configuration will be displayed here</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Notification settings will be displayed here</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AccessSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Control</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Access control settings will be displayed here</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <SettingsNav />
      <Routes>
        <Route index element={<GeneralSettings />} />
        <Route path="servers" element={<ServerSettings />} />
        <Route path="notifications" element={<NotificationSettings />} />
        <Route path="access" element={<AccessSettings />} />
      </Routes>
    </div>
  );
}
