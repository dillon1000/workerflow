import { useState } from "react";
import { useSetAtom } from "jotai";
import { useNavigate } from "@tanstack/react-router";
import { signInEmail, signUpEmail } from "@/lib/api/auth";
import { bootstrapAtom } from "@/state/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [signInForm, setSignInForm] = useState({ email: "", password: "" });
  const [signUpForm, setSignUpForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const bootstrap = useSetAtom(bootstrapAtom);
  const navigate = useNavigate();

  return (
    <div className="page-reveal flex h-screen items-stretch overflow-hidden bg-[color:var(--color-background)]">
      {/* left brand pane */}
      <section className="hairline-r relative hidden min-w-0 flex-1 flex-col justify-between overflow-hidden bg-[color:var(--color-ink)] px-10 py-8 text-white lg:flex">
        <div className="flex items-center gap-2">
          <img
            alt="Workerflow"
            className="h-4 w-auto"
            src="/workerflow-transparent.png"
          />
          <span className="mono text-[12px]">workerflow</span>
          <span className="mono ml-auto text-[10px] text-white/40">
            {new Date().toISOString().split("T")[0]}
          </span>
        </div>

        {/* ascii-ish diagram */}
        <div className="mono relative flex-1 overflow-hidden py-10">
          <pre className="text-[11px] leading-[1.35] text-white/55">{`
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │  trigger │──┬──▶│  action  │──┬──▶│   sink   │
  │  webhook │  │   │  http    │  │   │  d1      │
  └──────────┘  │   └──────────┘  │   └──────────┘
                │                 │
                │   ┌──────────┐  │
                └──▶│  ai.text │──┘
                    └──────────┘
`}</pre>
          <div className="mt-4 max-w-[46ch]">
            <p className="font-display text-[40px] leading-[1.02] tracking-tight text-white">
              Durable
              <br />
              workflows,
              <br />
              <span className="text-[color:var(--color-primary)]">
                visually.
              </span>
            </p>
            <p className="mt-4 text-[12px] leading-relaxed text-white/60">
              Webhook triggers, GitHub + Linear automations, AI steps, waits,
              logic, and PostgreSQL queries — in one canvas-first control room.
            </p>
          </div>
        </div>

        <div className="mono flex items-center gap-3 text-[10px] text-white/40">
          <span>build/cloudflare</span>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <span>auth/better-auth</span>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <span>v0.1.0</span>
        </div>
      </section>

      {/* right auth pane */}
      <section className="flex w-full flex-col bg-[color:var(--color-background)] lg:w-[460px]">
        <div className="hairline-b flex h-9 items-center px-4">
          <span className="label-xs">auth/</span>
          <span className="mono ml-1 text-[11px]">
            <span className="caret">session</span>
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-center px-8">
          <Tabs defaultValue="signin">
            <TabsList>
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-5 space-y-3" value="signin">
              <div className="space-y-1">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  className="mono h-8"
                  onChange={(event) =>
                    setSignInForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  value={signInForm.email}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  className="mono h-8"
                  onChange={(event) =>
                    setSignInForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  type="password"
                  value={signInForm.password}
                />
              </div>
              <Button
                className="mt-2 w-full"
                size="lg"
                variant="primary"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await signInEmail(signInForm.email, signInForm.password);
                    await bootstrap();
                    await navigate({ to: "/dashboard" });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? "Authorizing…" : "Enter workspace →"}
              </Button>
            </TabsContent>

            <TabsContent className="mt-5 space-y-3" value="signup">
              <div className="space-y-1">
                <Label htmlFor="signup-name">Name</Label>
                <Input
                  id="signup-name"
                  className="h-8"
                  onChange={(event) =>
                    setSignUpForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={signUpForm.name}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  className="mono h-8"
                  onChange={(event) =>
                    setSignUpForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  value={signUpForm.email}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  className="mono h-8"
                  onChange={(event) =>
                    setSignUpForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  type="password"
                  value={signUpForm.password}
                />
              </div>
              <Button
                className="mt-2 w-full"
                size="lg"
                variant="primary"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await signUpEmail(
                      signUpForm.name,
                      signUpForm.email,
                      signUpForm.password,
                    );
                    await bootstrap();
                    await navigate({ to: "/dashboard" });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? "Provisioning…" : "Create workspace →"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
        <div className="hairline-t mono flex h-6 items-center gap-2 px-4 text-[10px] text-[color:var(--color-muted-foreground)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
          edge · secure session · no third-party trackers
        </div>
      </section>
    </div>
  );
}
