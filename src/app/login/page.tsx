import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const isSessionExpired = params.reason === 'session_expired';

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-2">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Pulse</CardTitle>
            <CardDescription className="text-base mt-1">
              Real Dev Squad Dashboard
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Session expired message */}
          {isSessionExpired && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm">Your session has expired. Please sign in again.</p>
            </div>
          )}
          
          <Button asChild className="w-full h-12 text-base font-medium" size="lg">
            <a href="https://api.realdevsquad.com/auth/github/login?redirectURL=https://pulse.realdevsquad.com">
              Sign in with Real Dev Squad
            </a>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            You need to be a Real Dev Squad member to access this dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
