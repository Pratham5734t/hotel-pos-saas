"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Minus,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatMoney } from "@/lib/utils";
import { computeTotals } from "@/lib/totals";

type Cat = { id: string; name: string };
type Item = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  taxRate: number;
  isVeg: boolean;
};
type Table = { id: string; label: string; status: string };
type Line = {
  itemId: string;
  name: string;
  price: number;
  taxRate: number;
  qty: number;
};

type Channel = "DINE_IN" | "TAKEAWAY" | "ROOM_SERVICE";

export function POSClient({
  categories,
  items,
  tables,
}: {
  categories: Cat[];
  items: Item[];
  tables: Table[];
}) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<string | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<Channel>("DINE_IN");
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState<"kot" | "bill" | null>(null);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD">("CASH");

  const filtered = useMemo(() => {
    let out = items;
    if (activeCat !== "ALL") out = out.filter((i) => i.categoryId === activeCat);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      out = out.filter((i) => i.name.toLowerCase().includes(s));
    }
    return out;
  }, [items, activeCat, search]);

  const totals = useMemo(
    () =>
      computeTotals(
        cart.map((l) => ({ unitPrice: l.price, qty: l.qty, taxRate: l.taxRate })),
      ),
    [cart],
  );

  function addItem(it: Item) {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === it.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === it.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          itemId: it.id,
          name: it.name,
          price: it.price,
          taxRate: it.taxRate,
          qty: 1,
        },
      ];
    });
  }

  function setQty(itemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function remove(itemId: string) {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  async function submitOrder(action: "kot" | "bill") {
    if (cart.length === 0) return;
    setSubmitting(action);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        tableId,
        action,
        paymentMode: action === "bill" ? paymentMode : undefined,
        items: cart.map((l) => ({
          menuItemId: l.itemId,
          name: l.name,
          qty: l.qty,
          unitPrice: l.price,
          taxRate: l.taxRate,
        })),
      }),
    });
    setSubmitting(null);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Failed to create order");
      return;
    }
    const out = (await res.json()) as { id: string; number: number };
    setCart([]);
    setTableId(null);
    if (action === "bill") {
      router.push(`/orders/${out.id}/invoice`);
      return;
    }
    alert(`KOT sent — order #${out.number}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] h-[calc(100vh-64px)] md:h-screen">
      {/* Left: menu */}
      <div className="flex flex-col min-w-0 border-r">
        <div className="p-3 border-b flex flex-wrap gap-2 items-center bg-card">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(["DINE_IN", "TAKEAWAY", "ROOM_SERVICE"] as const).map((c) => (
              <Button
                key={c}
                size="sm"
                variant={channel === c ? "default" : "outline"}
                onClick={() => setChannel(c)}
              >
                {c.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b bg-card">
          <Button
            size="sm"
            variant={activeCat === "ALL" ? "default" : "ghost"}
            onClick={() => setActiveCat("ALL")}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={activeCat === c.id ? "default" : "ghost"}
              onClick={() => setActiveCat(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>

        {channel === "DINE_IN" && tables.length > 0 ? (
          <div className="flex gap-2 px-3 py-2 overflow-x-auto bg-muted/40 border-b">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTableId(tableId === t.id ? null : t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs border whitespace-nowrap",
                  tableId === t.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No items match your search.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((it) => (
                <button
                  key={it.id}
                  onClick={() => addItem(it)}
                  className="text-left rounded-lg border bg-card hover:bg-accent active:scale-[0.98] transition p-3"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "inline-block h-2 w-2 rounded-full mt-1",
                        it.isVeg ? "bg-emerald-500" : "bg-rose-500",
                      )}
                    />
                    <Badge variant="secondary" className="text-[10px]">
                      {it.taxRate}%
                    </Badge>
                  </div>
                  <div className="mt-1 font-semibold text-sm leading-tight line-clamp-2">
                    {it.name}
                  </div>
                  <div className="mt-2 text-base font-bold">
                    {formatMoney(it.price)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div className="flex flex-col bg-card">
        <div className="p-3 border-b flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          <span className="font-semibold">Cart</span>
          <Badge variant="outline" className="ml-auto">
            {channel.replace("_", " ")}
          </Badge>
          {tableId ? (
            <Badge variant="outline">
              Table {tables.find((t) => t.id === tableId)?.label}
            </Badge>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Tap an item to add it.
            </div>
          ) : (
            cart.map((l) => (
              <Card key={l.itemId}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{l.name}</div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(l.itemId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQty(l.itemId, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {l.qty}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQty(l.itemId, +1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatMoney(l.price * l.qty)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <Separator />
        <div className="p-3 space-y-2 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
          <Row label="Tax (GST)" value={formatMoney(totals.taxTotal)} />
          <Separator />
          <Row label="Total" value={formatMoney(totals.total)} bold />
          <div className="flex gap-1 pt-1">
            {(["CASH", "UPI", "CARD"] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={paymentMode === m ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPaymentMode(m)}
              >
                {m}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              size="lg"
              disabled={cart.length === 0 || submitting !== null}
              onClick={() => submitOrder("kot")}
            >
              {submitting === "kot" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send KOT"
              )}
            </Button>
            <Button
              size="lg"
              disabled={cart.length === 0 || submitting !== null}
              onClick={() => submitOrder("bill")}
            >
              {submitting === "bill" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Receipt className="h-4 w-4" />
                  Bill & pay
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", bold && "text-base font-bold")}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
