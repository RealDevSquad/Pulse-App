import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">⚡ Pulse</CardTitle>
          <CardDescription>Sign in to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg">
            Sign in with RDS
          </Button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            You need to be a Real Dev Squad member to access this dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
