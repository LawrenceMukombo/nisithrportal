import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

type TokenState = "loading" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [tokenState, setTokenState] = useState<TokenState>("loading");

  const token = new URLSearchParams(search).get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        setTokenState(data.valid === true ? "valid" : "invalid");
      })
      .catch(() => {
        setTokenState("invalid");
      });
  }, [token]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setIsPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Reset failed",
          description: data.error ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      setLocation("/login");
    } catch {
      toast({ title: "Error", description: "Unable to reach the server. Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const InvalidCard = () => (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src="/nisit-logo.png" alt="PNG NISIT Logo" className="w-16 h-16 object-contain mx-auto mb-4 rounded-xl shadow-md" />
          <h1 className="text-2xl font-bold text-foreground">PNG NISIT</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg" data-testid="invalid-token-title">Invalid reset link</CardTitle>
            <CardDescription>
              This link is invalid or has expired. Please request a new password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="outline" className="w-full">
              <a href="/reset-request">Request new link</a>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <a href="/login">Back to sign in</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (tokenState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Validating reset link…</p>
      </div>
    );
  }

  if (tokenState === "invalid") {
    return <InvalidCard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src="/nisit-logo.png" alt="PNG NISIT Logo" className="w-16 h-16 object-contain mx-auto mb-4 rounded-xl shadow-md" />
          <h1 className="text-2xl font-bold text-foreground">PNG NISIT</h1>
          <p className="text-muted-foreground text-sm mt-1">HR Portal — Set New Password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Set new password</CardTitle>
            <CardDescription>Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Min. 8 characters"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Repeat your new password"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending}
                  data-testid="button-submit"
                >
                  {isPending ? "Saving..." : "Set new password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <a href="/login" className="text-primary font-medium hover:underline">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
