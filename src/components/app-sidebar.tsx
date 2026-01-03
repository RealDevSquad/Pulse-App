'use client';

import { useRef } from 'react';
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

// Animated icons from lucide-animated
import { UserIcon, type UserIconHandle } from '@/components/ui/user';
import { BlocksIcon, type BlocksIconHandle } from '@/components/ui/blocks';
import { CalendarDaysIcon, type CalendarDaysIconHandle } from '@/components/ui/calendar-days';
import { ClipboardCheckIcon, type ClipboardCheckIconHandle } from '@/components/ui/clipboard-check';
import { SquarePenIcon, type SquarePenIconHandle } from '@/components/ui/square-pen';
import { UsersIcon, type UsersIconHandle } from '@/components/ui/users';
import { SettingsIcon, type SettingsIconHandle } from '@/components/ui/settings';
import { CircleHelpIcon, type CircleHelpIconHandle } from '@/components/ui/circle-help';
import { FileTextIcon, type FileTextIconHandle } from '@/components/ui/file-text';

// Icon size
const ICON_SIZE = 18;

// Union type for all icon handles
type IconHandle = 
  | UserIconHandle 
  | BlocksIconHandle 
  | CalendarDaysIconHandle 
  | ClipboardCheckIconHandle 
  | SquarePenIconHandle 
  | UsersIconHandle 
  | SettingsIconHandle 
  | CircleHelpIconHandle
  | FileTextIconHandle;

// Icon component type
type IconComponent = typeof UserIcon | typeof BlocksIcon | typeof CalendarDaysIcon | 
  typeof ClipboardCheckIcon | typeof SquarePenIcon | typeof UsersIcon | 
  typeof SettingsIcon | typeof CircleHelpIcon | typeof FileTextIcon;

interface NavItemProps {
  title: string;
  url: string;
  Icon: IconComponent;
  isActive: boolean;
  onClick: () => void;
  index: number;
}

function NavItem({ title, url, Icon, isActive, onClick, index }: NavItemProps) {
  const iconRef = useRef<IconHandle>(null);

  return (
    <SidebarMenuItem>
      <NavItemMotion index={index}>
        <SidebarMenuButton 
          asChild 
          isActive={isActive}
          onMouseEnter={() => iconRef.current?.startAnimation()}
          onMouseLeave={() => iconRef.current?.stopAnimation()}
        >
          <Link href={url} onClick={onClick}>
            <Icon ref={iconRef} size={ICON_SIZE} className="shrink-0" />
            <span>{title}</span>
          </Link>
        </SidebarMenuButton>
      </NavItemMotion>
    </SidebarMenuItem>
  );
}

interface AppSidebarProps {
  userId?: string;
  username?: string;
  isRoot?: boolean;
  isAdmin?: boolean;
}

export function AppSidebar({ userId, username, isRoot = false, isAdmin = false }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  
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

  // Navigation items
  const navItems = [
    { title: 'Me', url: userId ? `/member/${userId}` : '/me', Icon: UserIcon },
    { title: 'RDS', url: '/rds', Icon: BlocksIcon },
    { title: 'OOO', url: '/ooo', Icon: CalendarDaysIcon },
    { title: 'Tasks', url: '/tasks', Icon: ClipboardCheckIcon },
    { title: 'Todos', url: '/todos', Icon: SquarePenIcon },
    { title: 'Members', url: '/members', Icon: UsersIcon },
  ];

  // Admin items - Task Requests & Extension Requests for admins, Applications for root only
  const adminItems = [
    ...(isAdmin ? [
      { title: 'Task Requests', url: '/task-requests', Icon: ClipboardCheckIcon },
      { title: 'Extension Requests', url: '/extension-requests', Icon: CalendarDaysIcon },
    ] : []),
    ...(isRoot ? [{ title: 'Applications', url: '/applications', Icon: FileTextIcon }] : []),
    { title: 'Settings', url: '/settings', Icon: SettingsIcon },
  ];

  const footerItems = [
    { title: 'Help', url: '/help', Icon: CircleHelpIcon },
  ];

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
                <NavItem
                  key={item.title}
                  title={item.title}
                  url={item.url}
                  Icon={item.Icon}
                  isActive={isActive(item.url)}
                  onClick={handleNavClick}
                  index={index}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item, index) => (
                <NavItem
                  key={item.title}
                  title={item.title}
                  url={item.url}
                  Icon={item.Icon}
                  isActive={isActive(item.url)}
                  onClick={handleNavClick}
                  index={index + navItems.length}
                />
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
            <NavItem
              key={item.title}
              title={item.title}
              url={item.url}
              Icon={item.Icon}
              isActive={isActive(item.url)}
              onClick={handleNavClick}
              index={index + navItems.length + adminItems.length}
            />
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
