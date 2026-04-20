import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Info, Mail, Clock } from "lucide-react";
import { AppLayout } from "@/layouts/app-layout";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/use-auth";
import { isStaffDomain } from "@/lib/emailDomain";
import { getToken } from "@/lib/api-config";
import {
  SESSION_TIMEOUT_OPTIONS,
  getSessionTimeoutMinutes,
  setSessionTimeoutMinutes,
} from "@/lib/session-timeout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CLOSING_SOON_DAY_OPTIONS = [3, 7, 14] as const;
type ClosingSoonDays = (typeof CLOSING_SOON_DAY_OPTIONS)[number];

const schema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
});

type FormValues = z.infer<typeof schema>;

type PrefKey = "emailSavedJobClosing" | "emailStaleApplications";

export default function AccountPage() {
  const { user, updateEmail } = useAuth();
  const { isApplicant, isAdmin, isHrOfficer, isHiringManager } = useRole();
  const showStaleAppPref = isAdmin || isHrOfficer || isHiringManager;
  const showSavedJobPref = isApplicant;
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [prefs, setPrefs] = useState<{ emailSavedJobClosing: boolean; emailStaleApplications: boolean }>({
    emailSavedJobClosing: true,
    emailStaleApplications: true,
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [closingSoonDays, setClosingSoonDays] = useState<ClosingSoonDays | null>(null);
  const [closingPrefsLoading, setClosingPrefsLoading] = useState(false);
  const [closingPrefsSaving, setClosingPrefsSaving] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState<number>(() => getSessionTimeoutMinutes());

  const onSessionTimeoutChange = (value: string) => {
    const minutes = Number(value);
    setSessionTimeout(minutes);
    setSessionTimeoutMinutes(minutes);
    toast({
      title: "Session timeout updated",
      description:
        minutes === 0
          ? "You will stay signed in until you log out manually."
          : `You'll be signed out after ${minutes} minute${minutes === 1 ? "" : "s"} of inactivity.`,
    });
  };

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
          if (!cancelled) setPrefs({
            emailSavedJobClosing: Boolean(data.emailSavedJobClosing),
            emailStaleApplications: Boolean(data.emailStaleApplications),
          });
        }
      } catch {
        // ignore — leave defaults
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isApplicant) return;
    let cancelled = false;
    setClosingPrefsLoading(true);
    (async () => {
      try {
        const token = getToken();
        const res = await fetch("/api/auth/me/notification-preferences", {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const value = (CLOSING_SOON_DAY_OPTIONS as readonly number[]).includes(data.closingSoonDays)
          ? (data.closingSoonDays as ClosingSoonDays)
          : 7;
        setClosingSoonDays(value);
      } finally {
        if (!cancelled) setClosingPrefsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isApplicant]);

  const updatePref = async (key: PrefKey, next: boolean, labels: { onTitle: string; offTitle: string; onDesc: string; offDesc: string }) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setPrefsSaving(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/me/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ [key]: next }),
        credentials: "include",
      });
      if (!res.ok) {
        setPrefs((p) => ({ ...p, [key]: previous }));
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Could not save preference",
          description: data.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: next ? labels.onTitle : labels.offTitle,
        description: next ? labels.onDesc : labels.offDesc,
      });
    } catch {
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast({
        title: "Could not save preference",
        description: "Unable to reach the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPrefsSaving(false);
    }
  };

  const updateClosingSoonDays = async (next: ClosingSoonDays) => {
    if (next === closingSoonDays) return;
    const previous = closingSoonDays;
    setClosingSoonDays(next);
    setClosingPrefsSaving(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/me/notification-preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ closingSoonDays: next }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setClosingSoonDays(previous);
        toast({
          title: "Couldn't save preference",
          description: data?.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Preference saved",
        description: `You'll be alerted ${next} days before a saved job closes.`,
      });
    } catch {
      setClosingSoonDays(previous);
      toast({
        title: "Couldn't save preference",
        description: "Unable to reach the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClosingPrefsSaving(false);
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

        {(showSavedJobPref || showStaleAppPref) && (
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
            <CardContent className="space-y-5">
              {showSavedJobPref && (
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
                    checked={prefs.emailSavedJobClosing}
                    onCheckedChange={(next) => updatePref("emailSavedJobClosing", next, {
                      onTitle: "Email alerts on",
                      offTitle: "Email alerts off",
                      onDesc: "You'll get an email when a saved job is closing soon.",
                      offDesc: "You'll only see closing-soon alerts in the portal.",
                    })}
                    disabled={!prefsLoaded || prefsSaving}
                    data-testid="switch-email-saved-job-closing"
                  />
                </div>
              )}
              {showStaleAppPref && (
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="pref-stale-applications" className="text-sm font-medium">
                      Email me when an application has stalled
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      We'll still show stalled-application alerts in your notifications panel.
                    </p>
                  </div>
                  <Switch
                    id="pref-stale-applications"
                    checked={prefs.emailStaleApplications}
                    onCheckedChange={(next) => updatePref("emailStaleApplications", next, {
                      onTitle: "Stalled-application emails on",
                      offTitle: "Stalled-application emails off",
                      onDesc: "You'll get an email when an application has been stuck in a stage too long.",
                      offDesc: "You'll only see stalled-application alerts in the portal.",
                    })}
                    disabled={!prefsLoaded || prefsSaving}
                    data-testid="switch-email-stale-applications"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

        {!isApplicant && (
          <Card data-testid="card-session-timeout">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Session Timeout
              </CardTitle>
              <CardDescription>
                Automatically sign you out after a period of inactivity. This is a personal setting stored on this device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="session-timeout-select" className="text-sm">
                  Sign me out after
                </Label>
                <Select
                  value={String(sessionTimeout)}
                  onValueChange={onSessionTimeoutChange}
                >
                  <SelectTrigger id="session-timeout-select" data-testid="select-session-timeout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={String(opt.value)}
                        data-testid={`option-session-timeout-${opt.value}`}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Any mouse movement, keystroke, or scroll resets the timer. Choosing "Never" keeps you signed in indefinitely on this browser.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isApplicant && (
          <Card data-testid="card-notification-preferences">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" />
                Saved Job Closing Alerts
              </CardTitle>
              <CardDescription>
                Choose how many days before a saved job's closing date you want to be notified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {closingPrefsLoading || closingSoonDays == null ? (
                <p className="text-sm text-muted-foreground">Loading preference…</p>
              ) : (
                <RadioGroup
                  value={String(closingSoonDays)}
                  onValueChange={(v) => updateClosingSoonDays(Number(v) as ClosingSoonDays)}
                  disabled={closingPrefsSaving}
                  className="space-y-2"
                  data-testid="radio-closing-soon-days"
                >
                  {CLOSING_SOON_DAY_OPTIONS.map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={String(opt)}
                        id={`closing-soon-${opt}`}
                        data-testid={`radio-closing-soon-${opt}`}
                      />
                      <Label htmlFor={`closing-soon-${opt}`} className="cursor-pointer text-sm font-normal">
                        {opt} days before closing
                        {opt === 7 ? " (default)" : ""}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {closingPrefsSaving && (
                <p className="mt-3 text-xs text-muted-foreground">Saving…</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
