import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Violations() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Violations</h1>

      <Card>
        <CardHeader>
          <CardTitle>Violation Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">No violations recorded</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
