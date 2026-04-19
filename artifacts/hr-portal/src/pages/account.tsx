import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Info, Mail } from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { isStaffDomain } from "@/lib/emailDomain";
import { getToken } from "@/lib/api-config";

const schema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function AccountPage() {
  const { user, updateEmail } = useAuth();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [emailSavedJobClosing, setEmailSavedJobClosing] = useState<boolean>(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getToken();
        const res = await fetch("/api/auth/me/preferences", {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setEmailSavedJobClosing(Boolean(data.emailSavedJobClosing));
        }
      } catch {
        // ignore — leave default
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateClosingEmailPref = async (next: boolean) => {
    const previous = emailSavedJobClosing;
    setEmailSavedJobClosing(next);
    setPrefsSaving(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/me/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ emailSavedJobClosing: next }),
        credentials: "include",
      });
      if (!res.ok) {
        setEmailSavedJobClosing(previous);
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not save preference",
          description: data.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: next ? "Email alerts on" : "Email alerts off",
        description: next
          ? "You'll get an email when a saved job is closing soon."
          : "You'll only see closing-soon alerts in the portal.",
      });
    } catch {
      setEmailSavedJobClosing(previous);
      toast({
        title: "Could not save preference",
        description: "Unable to reach the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPrefsSaving(false);
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newEmail: "", currentPassword: "" },
  });

  const newEmailValue = useWatch({ control: form.control, name: "newEmail" });
  const showGovWarning = isStaffDomain(newEmailValue ?? "");

  const onSubmit = async (values: FormValues) => {
    setIsPending(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/me/email", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(values),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Update failed",
          description: data.error ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Email updated", description: `Your email has been changed to ${data.email}.` });
      form.reset();
      updateEmail(data.email);
    } catch {
      toast({ title: "Update failed", description: "Unable to reach the server. Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account details.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Choose which alerts you want to receive by email. In-app notifications stay on either way.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="pref-saved-job-closing" className="text-sm font-medium">
                  Email me when a saved job is closing soon
                </Label>
                <p className="text-xs text-muted-foreground">
                  We'll still show closing-soon alerts in your notifications panel.
                </p>
              </div>
              <Switch
                id="pref-saved-job-closing"
                checked={emailSavedJobClosing}
                onCheckedChange={updateClosingEmailPref}
                disabled={!prefsLoaded || prefsSaving}
                data-testid="switch-email-saved-job-closing"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Change Email Address
            </CardTitle>
            <CardDescription>
              Current email:{" "}
              <span className="font-medium text-foreground" data-testid="current-email">
                {user?.email ?? "—"}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="new@example.com"
                          data-testid="input-new-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      {showGovWarning && (
                        <div
                          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                          data-testid="gov-email-warning"
                        >
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            Government email addresses (@gov.pg) are for staff only and cannot be used for applicant accounts.
                          </span>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your current password to confirm"
                          data-testid="input-current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={isPending || showGovWarning}
                  data-testid="button-update-email"
                >
                  {isPending ? "Saving…" : "Update Email"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
