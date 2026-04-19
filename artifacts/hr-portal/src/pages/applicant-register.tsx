import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Info, UserPlus } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { isStaffDomain } from "@/lib/emailDomain";

const schema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function ApplicantRegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const emailValue = useWatch({ control: form.control, name: "email" });
  const isGovEmail = isStaffDomain(emailValue ?? "");
  const [emailFocused, setEmailFocused] = useState(false);
  const [stickyGovWarning, setStickyGovWarning] = useState(false);

  const hasClearNonGovDomain = (() => {
    const email = emailValue ?? "";
    const atIdx = email.lastIndexOf("@");
    if (atIdx === -1) return false;
    const domain = email.slice(atIdx + 1);
    if (!/^[^@\s]+\.[^@\s]+$/.test(domain)) return false;
    return !isStaffDomain(email);
  })();

  useEffect(() => {
    if (isGovEmail) {
      setStickyGovWarning(true);
    } else if (!emailFocused || hasClearNonGovDomain) {
      setStickyGovWarning(false);
    }
  }, [isGovEmail, emailFocused, hasClearNonGovDomain]);

  const showGovWarning = isGovEmail || (emailFocused && stickyGovWarning);

  const onSubmit = async (values: FormValues) => {
    if (isStaffDomain(values.email)) {
      toast({
        title: "Government email not allowed",
        description: "Applicant accounts cannot use @gov.pg email addresses. If you are NISIT staff, please sign in via the staff login page.",
        variant: "destructive",
      });
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch("/api/auth/applicant-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Registration failed",
          description: data.error ?? "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Account created!", description: "You can now sign in with your email and password." });
      setLocation("/login");
    } catch {
      toast({ title: "Registration failed", description: "Unable to reach the server. Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-xl mb-4">
            <UserPlus className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">PNG NISIT</h1>
          <p className="text-muted-foreground text-sm mt-1">HR Portal — Applicant Registration</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Your Applicant Account</CardTitle>
            <CardDescription>
              Register to track your applications and receive updates on your job submissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" data-testid="input-full-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          data-testid="input-email"
                          {...field}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => {
                            field.onBlur();
                            setEmailFocused(false);
                          }}
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
                            Government email addresses (@gov.pg) are for staff only. If you are NISIT staff, please{" "}
                            <Link href="/login">
                              <span className="font-medium underline cursor-pointer">sign in directly</span>
                            </Link>{" "}
                            with your assigned account.
                          </span>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Min. 8 characters" data-testid="input-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending || showGovWarning}
                  data-testid="button-submit"
                >
                  {isPending
                    ? "Creating account..."
                    : showGovWarning
                    ? "Staff accounts must sign in directly"
                    : "Create Account"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login">
                <span className="text-primary font-medium hover:underline cursor-pointer">Sign in</span>
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
