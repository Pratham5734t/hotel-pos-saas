import { startOfDay, subDays, format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { tenantId } = await requireTenant();
  const today = startOfDay(new Date());
  const sevenDaysAgo = subDays(today, 6);

  const [todayOrders, weekOrders, topItems] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: today }, status: "PAID" },
      select: { total: true, channel: true, taxTotal: true },
    }),
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: sevenDaysAgo }, status: "PAID" },
      select: { total: true, createdAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ["name"],
      where: {
        order: { tenantId, createdAt: { gte: sevenDaysAgo }, status: "PAID" },
      },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 10,
    }),
  ]);

  const todayTotal = todayOrders.reduce((s, o) => s + o.total, 0);
  const todayTax = todayOrders.reduce((s, o) => s + o.taxTotal, 0);
  const todayByChannel = new Map<string, { count: number; total: number }>();
  for (const o of todayOrders) {
    const e = todayByChannel.get(o.channel) ?? { count: 0, total: 0 };
    e.count += 1;
    e.total += o.total;
    todayByChannel.set(o.channel, e);
  }

  const byDay = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = subDays(today, 6 - i);
    byDay.set(format(d, "yyyy-MM-dd"), 0);
  }
  for (const o of weekOrders) {
    const k = format(startOfDay(o.createdAt), "yyyy-MM-dd");
    byDay.set(k, (byDay.get(k) ?? 0) + o.total);
  }
  const dayMax = Math.max(1, ...Array.from(byDay.values()));

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(todayTotal)}</div>
            <div className="text-xs text-muted-foreground">
              {todayOrders.length} paid orders · GST {formatMoney(todayTax)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">This week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(weekOrders.reduce((s, o) => s + o.total, 0))}
            </div>
            <div className="text-xs text-muted-foreground">
              {weekOrders.length} paid orders (last 7 days)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Avg ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {weekOrders.length > 0
                ? formatMoney(
                    weekOrders.reduce((s, o) => s + o.total, 0) / weekOrders.length,
                  )
                : formatMoney(0)}
            </div>
            <div className="text-xs text-muted-foreground">avg / order, last 7 days</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today by channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {todayByChannel.size === 0 ? (
              <p className="text-muted-foreground">No paid orders today.</p>
            ) : (
              Array.from(todayByChannel.entries()).map(([ch, e]) => (
                <div key={ch} className="flex items-center justify-between">
                  <Badge variant="outline">{ch}</Badge>
                  <span>
                    {e.count} orders · <strong>{formatMoney(e.total)}</strong>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {Array.from(byDay.entries()).map(([day, amt]) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-muted-foreground">{day}</span>
                  <div className="flex-1 h-2 bg-muted rounded">
                    <div
                      className="h-2 bg-primary rounded"
                      style={{ width: `${(amt / dayMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-medium">
                    {formatMoney(amt)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top items (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {topItems.map((it, i) => (
                <li key={it.name} className="flex justify-between">
                  <span>
                    <span className="text-muted-foreground mr-2">#{i + 1}</span>
                    {it.name}
                  </span>
                  <span>x{it._sum.qty ?? 0}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
