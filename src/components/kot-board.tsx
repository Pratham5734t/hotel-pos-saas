"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat } from "lucide-react";
import { formatTime } from "@/lib/utils";

type KOTOrder = {
  id: string;
  number: number;
  channel: string;
  status: string;
  tableLabel: string | null;
  createdAt: string;
  items: { id: string; name: string; qty: number; note: string | null }[];
};

const CHANNEL_COLORS: Record<string, string> = {
  DINE_IN: "bg-blue-100 text-blue-900",
  TAKEAWAY: "bg-amber-100 text-amber-900",
  ROOM_SERVICE: "bg-purple-100 text-purple-900",
  ZOMATO: "bg-rose-100 text-rose-900",
  SWIGGY: "bg-orange-100 text-orange-900",
  MOCK: "bg-slate-200 text-slate-900",
};

export function KOTBoard({ orders: initial }: { orders: KOTOrder[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState(initial);

  useEffect(() => setOrders(initial), [initial]);

  useEffect(() => {
    const es = new EventSource("/api/kot/stream");
    es.addEventListener("kot:new", () => router.refresh());
    es.addEventListener("kot:update", () => router.refresh());
    es.onerror = () => {
      // browser will auto-reconnect
    };
    return () => es.close();
  }, [router]);

  async function setStatus(id: string, status: "READY" | "SERVED") {
    await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="container py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ChefHat className="h-6 w-6" /> Kitchen
        </h1>
        <Badge variant="secondary">{orders.length} active</Badge>
      </div>
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No active KOTs. Orders will appear here in real time.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((o) => (
            <Card key={o.id} className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">#{o.number}</CardTitle>
                  <Badge className={CHANNEL_COLORS[o.channel] ?? ""} variant="outline">
                    {o.channel}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>{o.tableLabel ? `Table ${o.tableLabel}` : "—"}</span>
                  <span>{formatTime(o.createdAt)}</span>
                </div>
              </CardHeader>
              <CardContent className="pb-3 space-y-1 text-sm">
                {o.items.map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span>
                      {it.name}
                      {it.note ? (
                        <em className="ml-1 text-xs text-amber-600">— {it.note}</em>
                      ) : null}
                    </span>
                    <span className="font-semibold">x{it.qty}</span>
                  </div>
                ))}
                <div className="pt-2 flex gap-2">
                  {o.status === "KOT_SENT" ? (
                    <Button size="sm" className="flex-1" onClick={() => setStatus(o.id, "READY")}>
                      Mark ready
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStatus(o.id, "SERVED")}
                    >
                      Mark served
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
