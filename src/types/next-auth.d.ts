import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
  }
}
