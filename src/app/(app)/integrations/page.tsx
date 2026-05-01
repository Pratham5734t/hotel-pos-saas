import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/roles";
import { allProviders } from "@/lib/integrations/registry";
import { IntegrationsManager } from "@/components/integrations-manager";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { tenantId, role } = await requireTenant();
  // Webhook secrets are powerful: anyone holding one can POST forged orders to
  // /api/webhooks/{provider}?tenant={slug} and inject items into the kitchen.
  // Restrict the entire page (and therefore the secret) to roles that are
  // already trusted to mutate integrations.
  if (!canManageIntegrations(role)) redirect("/dashboard");
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const integrations = await prisma.aggregatorIntegration.findMany({
    where: { tenantId },
  });
  const events = await prisma.integrationEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <IntegrationsManager
      tenantSlug={tenant?.slug ?? ""}
      baseUrl={baseUrl}
      providers={allProviders.map((p) => ({ id: p.id, label: p.label }))}
      integrations={integrations.map((i) => ({
        id: i.id,
        provider: i.provider,
        enabled: i.enabled,
        webhookSecret: i.webhookSecret,
        config: i.config ?? "{}",
      }))}
      events={events.map((e) => ({
        id: e.id,
        provider: e.provider,
        direction: e.direction,
        kind: e.kind,
        ok: e.ok,
        message: e.message,
        externalId: e.externalId,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
