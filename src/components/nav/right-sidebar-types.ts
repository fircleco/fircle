export type SidebarAccessRole = "OWNER" | "ADMIN" | "MEMBER";

export type RightSidebarItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
  requiredRole?: SidebarAccessRole;
  sortOrder?: number;
};

export type RightSidebarSection = {
  id: string;
  title: string;
  items: RightSidebarItem[];
  sortOrder?: number;
};

/**
 * Future feature modules should provide optional right-sidebar contributions
 * via this shape, then pass them into `composeRightSidebarSections`.
 */
export type RightSidebarContribution = {
  sections?: RightSidebarSection[];
  items?: RightSidebarItem[];
};
