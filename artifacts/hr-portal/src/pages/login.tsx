import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/use-auth";
import { decodeToken } from "@/lib/api-config";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "idle") {
      toast({
        title: "Signed out",
        description: "You were signed out due to inactivity. Please sign in again.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [toast]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token);
        const payload = decodeToken(data.token);
        const dest = payload?.roleName === "applicant" ? "/my-applications" : "/dashboard";
        setLocation(dest);
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid email or password.", variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    loginMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img src="/nisit-logo.png" alt="PNG NISIT Logo" className="w-16 h-16 object-contain mx-auto mb-4 rounded-xl shadow-md" />
          <h1 className="text-2xl font-bold text-foreground">PNG NISIT</h1>
          <p className="text-muted-foreground text-sm mt-1">HR Portal — Staff Login</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in to your account</CardTitle>
            <CardDescription>Enter your credentials to access the HR Portal</CardDescription>
          </CardHeader>
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
                          placeholder="you@agency.gov.pg"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
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
                        <Input
                          type="password"
                          placeholder="••••••••"
                          data-testid="input-password"
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
                  disabled={loginMutation.isPending}
                  data-testid="button-submit"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex-col gap-2 items-center">
            <a href="/reset-request" className="text-sm text-primary font-medium hover:underline" data-testid="link-forgot-password">
              Forgot password?
            </a>
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a href="/applicant-register" className="text-primary font-medium hover:underline">
                Register as applicant
              </a>
            </p>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Papua New Guinea National Information Systems and IT Dept.
        </p>
      </div>
    </div>
  );
}
