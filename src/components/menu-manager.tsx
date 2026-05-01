"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";

type Cat = { id: string; name: string; sortOrder: number };
type Item = {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  taxRate: number;
  isVeg: boolean;
  available: boolean;
};

export function MenuManager({
  categories,
  items,
}: {
  categories: Cat[];
  items: Item[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [newCatName, setNewCatName] = useState("");
  const [newItem, setNewItem] = useState({
    name: "",
    price: "",
    taxRate: "5",
    isVeg: true,
    categoryId: categories[0]?.id ?? "",
  });

  async function call(path: string, body: unknown, method = "POST") {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Something went wrong");
      return false;
    }
    return true;
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{c.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        if (!confirm(`Delete category "${c.name}"?`)) return;
                        if (await call(`/api/menu/categories/${c.id}`, {}, "DELETE"))
                          router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="New category name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <Button
              size="icon"
              disabled={!newCatName.trim() || pending}
              onClick={() =>
                startTransition(async () => {
                  if (await call("/api/menu/categories", { name: newCatName.trim() })) {
                    setNewCatName("");
                    router.refresh();
                  }
                })
              }
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-6 items-end rounded-md border p-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Paneer Tikka"
              />
            </div>
            <div>
              <Label className="text-xs">Price</Label>
              <Input
                type="number"
                step="1"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                placeholder="280"
              />
            </div>
            <div>
              <Label className="text-xs">GST %</Label>
              <Input
                type="number"
                step="1"
                value={newItem.taxRate}
                onChange={(e) => setNewItem({ ...newItem, taxRate: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newItem.categoryId}
                onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              disabled={
                !newItem.name.trim() ||
                !newItem.price ||
                !newItem.categoryId ||
                pending
              }
              onClick={() =>
                startTransition(async () => {
                  const ok = await call("/api/menu/items", {
                    name: newItem.name.trim(),
                    price: Number(newItem.price),
                    taxRate: Number(newItem.taxRate),
                    isVeg: newItem.isVeg,
                    categoryId: newItem.categoryId,
                  });
                  if (ok) {
                    setNewItem({ ...newItem, name: "", price: "" });
                    router.refresh();
                  }
                })
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
            <label className="flex items-center gap-2 text-xs md:col-span-6">
              <input
                type="checkbox"
                checked={newItem.isVeg}
                onChange={(e) => setNewItem({ ...newItem, isVeg: e.target.checked })}
              />
              Vegetarian
            </label>
          </div>

          <div className="border rounded-md divide-y">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No items yet.</div>
            ) : (
              items.map((it) => {
                const cat = categories.find((c) => c.id === it.categoryId);
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={
                          "inline-block h-2 w-2 rounded-full " +
                          (it.isVeg ? "bg-emerald-500" : "bg-rose-500")
                        }
                      />
                      <span className="truncate font-medium">{it.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {cat?.name ?? "—"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        GST {it.taxRate}%
                      </Badge>
                      {!it.available ? (
                        <Badge variant="destructive" className="text-xs">
                          Unavailable
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">₹{it.price.toFixed(0)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          startTransition(async () => {
                            if (
                              await call(
                                `/api/menu/items/${it.id}`,
                                { available: !it.available },
                                "PATCH",
                              )
                            )
                              router.refresh();
                          })
                        }
                      >
                        {it.available ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          startTransition(async () => {
                            if (!confirm(`Delete "${it.name}"?`)) return;
                            if (await call(`/api/menu/items/${it.id}`, {}, "DELETE"))
                              router.refresh();
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
