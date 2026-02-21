import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AccessDeniedReason = 'not_logged_in' | 'not_rds_member' | 'not_authorized';

interface AccessDeniedProps {
  reason: AccessDeniedReason;
}

const SIGN_IN_URL = 'https://api.realdevsquad.com/auth/github/login?redirectURL=https://pulse.realdevsquad.com';

export function AccessDenied({ reason }: AccessDeniedProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
              ⚡
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Pulse</CardTitle>
            <CardDescription className="mt-1">Sign in to access the dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full" size="lg">
            <a href={SIGN_IN_URL}>Sign in with Real Dev Squad</a>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            You need to be a Real Dev Squad member to access this dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
