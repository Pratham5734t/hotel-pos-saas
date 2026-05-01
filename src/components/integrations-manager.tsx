"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle2, Copy, Loader2, Power, Send, XCircle } from "lucide-react";

type Provider = { id: string; label: string };
type Integration = {
  id: string;
  provider: string;
  enabled: boolean;
  webhookSecret: string;
  config: string;
};
type Event = {
  id: string;
  provider: string;
  direction: string;
  kind: string;
  ok: boolean;
  message: string | null;
  externalId: string | null;
  createdAt: string;
};

export function IntegrationsManager({
  tenantSlug,
  baseUrl,
  providers,
  integrations,
  events,
}: {
  tenantSlug: string;
  baseUrl: string;
  providers: Provider[];
  integrations: Integration[];
  events: Event[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openProvider, setOpenProvider] = useState<string | null>(null);

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

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

  async function setupProvider(provider: string) {
    if (
      await call("/api/integrations", {
        provider,
      })
    ) {
      router.refresh();
    }
  }

  async function toggle(integration: Integration, next: boolean) {
    if (
      await call(
        `/api/integrations/${integration.id}`,
        { enabled: next },
        "PATCH",
      )
    ) {
      router.refresh();
    }
  }

  async function rotateSecret(integration: Integration) {
    if (
      await call(
        `/api/integrations/${integration.id}/rotate-secret`,
        {},
        "POST",
      )
    ) {
      router.refresh();
    }
  }

  async function sendMockOrder() {
    const sample = {
      externalId: `mock_${Date.now()}`,
      externalNumber: `M${Math.floor(Math.random() * 9000) + 1000}`,
      customer: { name: "Test Customer", phone: "9999900000" },
      items: [
        { name: "Veg Spring Roll", qty: 2, unitPrice: 180, taxRate: 5 },
        { name: "Chicken 65", qty: 1, unitPrice: 280, taxRate: 5 },
      ],
      paymentMethod: "PREPAID",
    };
    const integration = integrations.find((i) => i.provider === "MOCK");
    if (!integration) {
      alert("Set up the Mock provider first.");
      return;
    }
    // Use a relative URL: this fetch runs in the browser, so the request
    // should always target the host the user is currently on, not the
    // server-configured NEXT_PUBLIC_APP_URL (which may not be the same
    // hostname behind a proxy / CDN / IP-based dev access).
    const res = await fetch(
      `/api/webhooks/MOCK?tenant=${tenantSlug}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": integration.webhookSecret,
        },
        body: JSON.stringify(sample),
      },
    );
    if (!res.ok) {
      alert(`Mock order failed: ${res.status}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Receive orders from aggregators directly into your KOT.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((p) => {
          const integration = integrations.find((i) => i.provider === p.id);
          const webhookUrl = `${baseUrl}/api/webhooks/${p.id}?tenant=${tenantSlug}`;
          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{p.label}</CardTitle>
                  {integration ? (
                    <Badge variant={integration.enabled ? "success" : "secondary"}>
                      {integration.enabled ? "Live" : "Disabled"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not connected</Badge>
                  )}
                </div>
                <CardDescription>
                  {p.id === "MOCK"
                    ? "Built-in simulator — fire fake orders to test the full lifecycle."
                    : "Provide credentials below; webhook URL & secret are auto-generated."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!integration ? (
                  <Button
                    className="w-full"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void setupProvider(p.id);
                      })
                    }
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Set up"
                    )}
                  </Button>
                ) : (
                  <>
                    <div>
                      <Label className="text-xs">Webhook URL</Label>
                      <div className="flex gap-1">
                        <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copy(webhookUrl)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Webhook secret</Label>
                      <div className="flex gap-1">
                        <Input
                          readOnly
                          value={integration.webhookSecret}
                          className="font-mono text-xs"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copy(integration.webhookSecret)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          startTransition(() => {
                            void toggle(integration, !integration.enabled);
                          })
                        }
                      >
                        <Power className="h-3.5 w-3.5" />
                        {integration.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          startTransition(() => {
                            void rotateSecret(integration);
                          })
                        }
                      >
                        Rotate secret
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() =>
                        setOpenProvider(openProvider === p.id ? null : p.id)
                      }
                    >
                      {openProvider === p.id ? "Hide config" : "Edit config (apiKey, etc.)"}
                    </Button>
                    {openProvider === p.id ? (
                      <ConfigEditor
                        initial={integration.config}
                        onSave={async (config) => {
                          await call(
                            `/api/integrations/${integration.id}`,
                            { config },
                            "PATCH",
                          );
                          router.refresh();
                        }}
                      />
                    ) : null}
                    {p.id === "MOCK" ? (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          startTransition(() => {
                            void sendMockOrder();
                          })
                        }
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send test order
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent integration events</CardTitle>
          <CardDescription>
            Inbound orders and outbound status pushes — useful for debugging.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="p-2 text-left">When</th>
                  <th className="p-2 text-left">Provider</th>
                  <th className="p-2 text-left">Direction</th>
                  <th className="p-2 text-left">Kind</th>
                  <th className="p-2 text-left">External ID</th>
                  <th className="p-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground" colSpan={6}>
                      No integration events yet. Click &ldquo;Send test order&rdquo;
                      under the Mock provider to generate one.
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-2 text-xs">{formatDateTime(e.createdAt)}</td>
                      <td className="p-2">
                        <Badge variant="outline">{e.provider}</Badge>
                      </td>
                      <td className="p-2 text-xs">{e.direction}</td>
                      <td className="p-2 text-xs">{e.kind}</td>
                      <td className="p-2 text-xs font-mono">{e.externalId ?? "—"}</td>
                      <td className="p-2 text-xs flex items-center gap-1">
                        {e.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        )}
                        {e.message ?? (e.ok ? "ok" : "error")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (json: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <div className="space-y-2">
      <Textarea
        rows={6}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="font-mono text-xs"
        placeholder='{"apiBase":"https://...", "apiKey":"..."}'
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button
        size="sm"
        disabled={saving}
        onClick={async () => {
          try {
            JSON.parse(value || "{}");
          } catch {
            setError("Invalid JSON.");
            return;
          }
          setError(null);
          setSaving(true);
          await onSave(value);
          setSaving(false);
        }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save config"}
      </Button>
    </div>
  );
}
