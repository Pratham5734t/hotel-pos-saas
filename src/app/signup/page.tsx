"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Utensils } from "lucide-react";

const MODULE_OPTIONS = [
  { id: "restaurant", label: "Restaurant POS", hint: "Dine-in, takeaway, KOT, billing" },
  { id: "bar", label: "Bar", hint: "Liquor menu and bar receipts" },
  { id: "banquet", label: "Banquet & catering", hint: "Bulk orders, advance billing" },
  { id: "lodging", label: "Lodging (rooms)", hint: "Coming soon — front desk & folios" },
] as const;

type ModuleKey = (typeof MODULE_OPTIONS)[number]["id"];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — hotel
  const [hotelName, setHotelName] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    restaurant: true,
    bar: false,
    banquet: false,
    lodging: false,
  });

  // Step 2 — owner
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!hotelName.trim()) {
        setError("Hotel name is required.");
        return;
      }
      setError(null);
      setStep(2);
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelName,
        gstin: gstin || undefined,
        address: address || undefined,
        modules,
        ownerName,
        email: email.toLowerCase().trim(),
        password,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      tenantSlug?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(body.error ?? "Failed to create your hotel.");
      setSubmitting(false);
      return;
    }
    const signin = await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      tenantSlug: body.tenantSlug ?? "",
      redirect: false,
    });
    setSubmitting(false);
    if (signin?.error) {
      setError("Account created, but sign-in failed. Try logging in manually.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Utensils className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4">Create your hotel</CardTitle>
          <CardDescription>
            Step {step} of 2 — {step === 1 ? "tell us about your hotel" : "your owner account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="hotelName">Hotel name *</Label>
                  <Input
                    id="hotelName"
                    required
                    placeholder="e.g. The Grand Pune"
                    value={hotelName}
                    onChange={(e) => setHotelName(e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gstin">GSTIN (optional)</Label>
                    <Input
                      id="gstin"
                      placeholder="27ABCDE1234F1Z5"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address (optional)</Label>
                    <Input
                      id="address"
                      placeholder="MG Road, Pune"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Modules to enable</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {MODULE_OPTIONS.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={modules[m.id]}
                          onChange={(e) =>
                            setModules({ ...modules, [m.id]: e.target.checked })
                          }
                        />
                        <div>
                          <div className="font-medium">{m.label}</div>
                          <div className="text-xs text-muted-foreground">{m.hint}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Your name *</Label>
                  <Input
                    id="ownerName"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password * (min 8 chars)</Label>
                  <Input
                    id="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-between">
              {step === 2 ? (
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === 1 ? (
                  "Continue"
                ) : (
                  "Create my hotel"
                )}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already onboarded?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
