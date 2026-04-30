import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireTenant() {
  const session = await requireSession();
  return {
    session,
    tenantId: session.user.tenantId,
    role: session.user.role,
  };
}

export async function getOptionalSession() {
  return getServerSession(authOptions);
}
