import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Activity() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Activity</h1>

      <Card>
        <CardHeader>
          <CardTitle>Active Streams</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">No active streams</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">Session history table will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
