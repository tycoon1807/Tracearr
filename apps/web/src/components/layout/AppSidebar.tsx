import { NavLink, useLocation } from 'react-router';
import { ChevronRight } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Logo } from '@/components/brand/Logo';
import { ServerSelector } from './ServerSelector';
import { navigation, isNavGroup, type NavItem, type NavGroup } from './nav-data';
import { cn } from '@/lib/utils';

function NavMenuItem({ item }: { item: NavItem }) {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.href}
          end={item.href === '/'}
          onClick={() => setOpenMobile(false)}
          className={({ isActive }) =>
            cn(isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')
          }
        >
          <item.icon className="size-4" />
          <span>{item.name}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavMenuGroup({ group }: { group: NavGroup }) {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const isActive = group.children.some((child) =>
    location.pathname.startsWith(child.href)
  );

  return (
    <Collapsible defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={cn(isActive && 'font-medium')}>
            <group.icon className="size-4" />
            <span>{group.name}</span>
            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.children.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton asChild>
                  <NavLink
                    to={child.href}
                    onClick={() => setOpenMobile(false)}
                    className={({ isActive }) =>
                      cn(isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')
                    }
                  >
                    <child.icon className="size-4" />
                    <span>{child.name}</span>
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="border-b p-0">
        <div className="flex h-14 items-center px-4">
          <Logo size="md" />
        </div>
        <ServerSelector />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((entry) => {
                if (isNavGroup(entry)) {
                  return <NavMenuGroup key={entry.name} group={entry} />;
                }
                return <NavMenuItem key={entry.href} item={entry} />;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
