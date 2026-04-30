import Link from "next/link";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Utensils, ChefHat, ListOrdered, Webhook } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { tenantId } = await requireTenant();
  const since = startOfDay(new Date());

  const [todayOrders, openOrders, menuCount, integrations] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { total: true, channel: true, status: true },
    }),
    prisma.order.count({
      where: { tenantId, status: { in: ["OPEN", "KOT_SENT", "READY"] } },
    }),
    prisma.menuItem.count({ where: { tenantId } }),
    prisma.aggregatorIntegration.findMany({
      where: { tenantId },
      select: { provider: true, enabled: true },
    }),
  ]);

  const totalToday = todayOrders.reduce((s, o) => s + o.total, 0);
  const paidToday = todayOrders
    .filter((o) => o.status === "PAID")
    .reduce((s, o) => s + o.total, 0);

  const byChannel: Record<string, number> = {};
  for (const o of todayOrders) byChannel[o.channel] = (byChannel[o.channel] ?? 0) + o.total;

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Today&apos;s overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pos">
            <Button>
              <Utensils className="h-4 w-4" /> Open POS
            </Button>
          </Link>
          <Link href="/kot">
            <Button variant="outline">
              <ChefHat className="h-4 w-4" /> Kitchen
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPICard label="Sales today" value={formatMoney(totalToday)} />
        <KPICard label="Paid today" value={formatMoney(paidToday)} />
        <KPICard label="Open orders" value={String(openOrders)} icon={ListOrdered} />
        <KPICard label="Menu items" value={String(menuCount)} icon={Utensils} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channel split (today)</CardTitle>
          </CardHeader>
          <CardContent>
            {todayOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet today.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byChannel).map(([ch, amt]) => (
                  <div key={ch} className="flex items-center justify-between text-sm">
                    <Badge variant="outline">{ch}</Badge>
                    <span>{formatMoney(amt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4" /> Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {integrations.length === 0 ? (
              <p className="text-muted-foreground">
                No aggregator integrations configured yet.{" "}
                <Link className="text-primary hover:underline" href="/integrations">
                  Configure
                </Link>
              </p>
            ) : (
              integrations.map((i) => (
                <div key={i.provider} className="flex items-center justify-between">
                  <span>{i.provider}</span>
                  <Badge variant={i.enabled ? "success" : "secondary"}>
                    {i.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
