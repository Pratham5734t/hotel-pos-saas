export const ROLES = ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
};

export function canManageMenu(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canManageIntegrations(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canManageUsers(role: Role) {
  return role === "OWNER";
}

export function canViewReports(role: Role) {
  return role === "OWNER" || role === "MANAGER";
}

export function canTakeOrders(role: Role) {
  return role === "OWNER" || role === "MANAGER" || role === "CASHIER" || role === "WAITER";
}
