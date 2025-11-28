import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Users() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Users</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">User list will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
