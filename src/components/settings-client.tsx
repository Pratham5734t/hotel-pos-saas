"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { ROLES, type Role, ROLE_LABELS } from "@/lib/roles";
import { safeJsonParse } from "@/lib/utils";

type User = { id: string; name: string; email: string; role: string };
type Table = { id: string; label: string; seats: number };

export function SettingsClient({
  role,
  tenant,
  users,
  tables,
}: {
  role: Role;
  tenant: { id: string; name: string; slug: string; gstin: string; address: string; modules: string };
  users: User[];
  tables: Table[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Tenant
  const [name, setName] = useState(tenant.name);
  const [gstin, setGstin] = useState(tenant.gstin);
  const [address, setAddress] = useState(tenant.address);
  const modules = safeJsonParse<Record<string, boolean>>(tenant.modules, {});

  // Tables
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newTableSeats, setNewTableSeats] = useState("2");

  // Users
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "CASHIER" as Role,
  });

  async function call(path: string, body: unknown, method = "POST") {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Request failed");
      return false;
    }
    return true;
  }

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hotel profile</CardTitle>
          <CardDescription>
            Slug: <code className="rounded bg-muted px-1">{tenant.slug}</code> · Modules:{" "}
            {Object.entries(modules)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(", ") || "—"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Hotel name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">GSTIN</Label>
            <Input value={gstin} onChange={(e) => setGstin(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Button
              size="sm"
              disabled={pending || role !== "OWNER"}
              onClick={() =>
                startTransition(async () => {
                  if (
                    await call(
                      "/api/tenant",
                      { name, gstin, address },
                      "PATCH",
                    )
                  )
                    router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tables</CardTitle>
          <CardDescription>Used in dine-in orders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tables yet.</p>
            ) : (
              tables.map((t) => (
                <div key={t.id} className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm">
                  <span>{t.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {t.seats} seat{t.seats === 1 ? "" : "s"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        if (await call(`/api/tables/${t.id}`, {}, "DELETE")) router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Label</Label>
              <Input
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                placeholder="T1"
              />
            </div>
            <div>
              <Label className="text-xs">Seats</Label>
              <Input
                type="number"
                value={newTableSeats}
                onChange={(e) => setNewTableSeats(e.target.value)}
              />
            </div>
            <Button
              disabled={!newTableLabel.trim() || pending}
              onClick={() =>
                startTransition(async () => {
                  if (
                    await call("/api/tables", {
                      label: newTableLabel.trim(),
                      seats: Number(newTableSeats) || 2,
                    })
                  ) {
                    setNewTableLabel("");
                    router.refresh();
                  }
                })
              }
            >
              <Plus className="h-4 w-4" /> Add table
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team & roles</CardTitle>
          <CardDescription>Invite cashiers, managers, kitchen staff.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border rounded-md divide-y">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <Badge variant="secondary">{ROLE_LABELS[u.role as Role] ?? u.role}</Badge>
              </div>
            ))}
          </div>
          {role === "OWNER" ? (
            <div className="grid gap-2 md:grid-cols-5 items-end rounded-md border p-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={
                  !newUser.name ||
                  !newUser.email ||
                  newUser.password.length < 8 ||
                  pending
                }
                onClick={() =>
                  startTransition(async () => {
                    if (
                      await call("/api/users", {
                        name: newUser.name,
                        email: newUser.email.toLowerCase(),
                        password: newUser.password,
                        role: newUser.role,
                      })
                    ) {
                      setNewUser({ name: "", email: "", password: "", role: "CASHIER" });
                      router.refresh();
                    }
                  })
                }
              >
                Invite
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
