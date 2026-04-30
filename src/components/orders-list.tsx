"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney, cn } from "@/lib/utils";

type Row = {
  id: string;
  number: number;
  channel: string;
  status: string;
  total: number;
  tableLabel: string | null;
  itemCount: number;
  createdAt: string;
};

const CHANNELS = ["DINE_IN", "TAKEAWAY", "ROOM_SERVICE", "ZOMATO", "SWIGGY", "MOCK"];
const STATUSES = ["OPEN", "KOT_SENT", "READY", "SERVED", "PAID", "VOID"];

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive" | "warn"> = {
  OPEN: "secondary",
  KOT_SENT: "warn",
  READY: "warn",
  SERVED: "default",
  PAID: "success",
  VOID: "destructive",
};

export function OrdersList({
  orders,
  activeChannel,
  activeStatus,
}: {
  orders: Row[];
  activeChannel: string | null;
  activeStatus: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const es = new EventSource("/api/orders/stream");
    es.addEventListener("order:new", () => router.refresh());
    es.addEventListener("order:update", () => router.refresh());
    es.onerror = () => {};
    return () => es.close();
  }, [router]);

  function setFilter(key: "channel" | "status", value: string | null) {
    const next = new URLSearchParams(sp?.toString() ?? "");
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`/orders?${next.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        <span className="text-xs text-muted-foreground self-center mr-1">Channel:</span>
        <Button
          size="sm"
          variant={!activeChannel ? "default" : "outline"}
          onClick={() => setFilter("channel", null)}
        >
          All
        </Button>
        {CHANNELS.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={activeChannel === c ? "default" : "outline"}
            onClick={() => setFilter("channel", c)}
          >
            {c.replace("_", " ")}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="text-xs text-muted-foreground self-center mr-1">Status:</span>
        <Button
          size="sm"
          variant={!activeStatus ? "default" : "outline"}
          onClick={() => setFilter("status", null)}
        >
          All
        </Button>
        {STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={activeStatus === s ? "default" : "outline"}
            onClick={() => setFilter("status", s)}
          >
            {s}
          </Button>
        ))}
      </div>
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Channel</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Table</th>
              <th className="text-right p-2">Items</th>
              <th className="text-right p-2">Total</th>
              <th className="text-left p-2">Created</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No orders match these filters.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className={cn("border-t hover:bg-muted/30")}>
                  <td className="p-2 font-mono">{o.number}</td>
                  <td className="p-2">
                    <Badge variant="outline">{o.channel}</Badge>
                  </td>
                  <td className="p-2">
                    <Badge variant={STATUS_VARIANTS[o.status] ?? "secondary"}>
                      {o.status}
                    </Badge>
                  </td>
                  <td className="p-2">{o.tableLabel ?? "—"}</td>
                  <td className="p-2 text-right">{o.itemCount}</td>
                  <td className="p-2 text-right font-semibold">
                    {formatMoney(o.total)}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {formatDateTime(o.createdAt)}
                  </td>
                  <td className="p-2 text-right">
                    <Link
                      href={`/orders/${o.id}/invoice`}
                      className="text-primary hover:underline text-xs"
                    >
                      Invoice
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
