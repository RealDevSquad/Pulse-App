'use client';

import {
  Calendar,
  Users,
  CheckSquare,
  HelpCircle,
  User,
  Building2,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavItemMotion, FadeIn } from '@/components/ui/motion';

// Note: 'Me' URL is dynamically set based on userId to avoid redirect issues with AnimatePresence
const getNavItems = (userId?: string) => [
  { title: 'Me', url: userId ? `/member/${userId}` : '/me', icon: User },
  { title: 'RDS', url: '/rds', icon: Building2 },
  { title: 'OOO', url: '/ooo', icon: Calendar },
  { title: 'Tasks', url: '/tasks', icon: CheckSquare },
  { title: 'Members', url: '/members', icon: Users },
];

const adminItems = [{ title: 'Settings', url: '/settings', icon: Settings }];

const footerItems = [
  { title: 'Help', url: '/help', icon: HelpCircle },
];

interface AppSidebarProps {
  userId?: string;
  username?: string;
}

export function AppSidebar({ userId, username }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  
  // Get nav items with dynamic 'Me' URL to avoid redirect issues with AnimatePresence
  const navItems = getNavItems(userId);
  
  // Check if a nav item should be marked as active
  const isActive = (url: string): boolean => {
    // "Me" is active on /me or /member/{currentUserId}
    if (userId && (url === `/member/${userId}` || url === '/me')) {
      return pathname === '/me' || pathname === `/member/${userId}`;
    }
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  // Close sidebar on mobile when navigating
  const handleNavClick = () => {
    setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <FadeIn>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">⚡ Pulse</span>
          </Link>
        </FadeIn>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <NavItemMotion index={index}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </NavItemMotion>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <NavItemMotion index={index + navItems.length}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </NavItemMotion>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        {username && (
          <div className="px-3 py-2">
            <Link 
              href={userId ? `/member/${userId}` : '/me'}
              onClick={handleNavClick}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                {username.slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate text-muted-foreground">@{username}</span>
            </Link>
          </div>
        )}
        <SidebarMenu>
          {footerItems.map((item, index) => (
            <SidebarMenuItem key={item.title}>
              <NavItemMotion index={index + navItems.length + adminItems.length}>
                <SidebarMenuButton asChild>
                  <Link href={item.url} onClick={handleNavClick}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </NavItemMotion>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
