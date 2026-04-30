import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenantId, role } = await requireTenant();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const tables = await prisma.diningTable.findMany({
    where: { tenantId },
    orderBy: { label: "asc" },
  });
  return (
    <SettingsClient
      role={role}
      tenant={{
        id: tenant?.id ?? "",
        name: tenant?.name ?? "",
        slug: tenant?.slug ?? "",
        gstin: tenant?.gstin ?? "",
        address: tenant?.address ?? "",
        modules: tenant?.modules ?? "{}",
      }}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }))}
      tables={tables.map((t) => ({ id: t.id, label: t.label, seats: t.seats }))}
    />
  );
}
