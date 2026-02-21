import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { PageTransition } from '@/components/page-transition';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { getSession } from '@/lib/auth';
import { checkDashboardAccess } from '@/lib/users';
import { AccessDenied } from '@/components/access-denied';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  // Check dashboard access at layout level
  const access = await checkDashboardAccess(session?.userId);
  if (!access.allowed) {
    return <AccessDenied reason={access.reason} />;
  }

  return (
    <SidebarProvider>
      <AppSidebar userId={session?.userId} username={session?.username} isRoot={access.isRoot} isAdmin={access.isAdmin} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 sm:px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <PageBreadcrumb />
        </header>
        <main className="flex-1 p-2 sm:p-4 md:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
