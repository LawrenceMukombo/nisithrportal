import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Mail } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ResetRequestPage() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setIsPending(true);
    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Something went wrong",
          description: data.error ?? "Unable to process request. Please try again.",
          variant: "destructive",
        });
        return;
      }
      setSubmitted(true);
    } catch {
      toast({ title: "Error", description: "Unable to reach the server. Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src="/nisit-logo.png" alt="PNG NISIT Logo" className="w-16 h-16 object-contain mx-auto mb-4 rounded-xl shadow-md" />
          <h1 className="text-2xl font-bold text-foreground">PNG NISIT</h1>
          <p className="text-muted-foreground text-sm mt-1">HR Portal — Password Reset</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Forgot your password?</CardTitle>
            <CardDescription>
              {submitted
                ? "Check your inbox for a reset link."
                : "Enter your email and we'll send you a link to reset your password."}
            </CardDescription>
          </CardHeader>

          {!submitted ? (
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            data-testid="input-email"
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
                    {isPending ? "Sending..." : "Send reset link"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          ) : (
            <CardContent className="text-center space-y-4 py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                If that email belongs to an applicant account, you'll receive a password reset link shortly. Check your spam folder if it doesn't arrive within a few minutes.
              </p>
            </CardContent>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login">
            <span className="text-primary font-medium hover:underline cursor-pointer">Sign in</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
