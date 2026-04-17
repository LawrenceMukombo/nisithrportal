import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Shield } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useRegister } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Full name required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  agencyName: z.string().min(2, "Agency name required"),
  roleName: z.enum(["hr_officer", "hiring_manager", "admin", "executive", "applicant"]),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      agencyName: "",
      roleName: "applicant",
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        login(data.token);
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: "Registration failed", description: "Email may already be in use.", variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    registerMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-xl mb-4">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">PNG NISIT</h1>
          <p className="text-muted-foreground text-sm mt-1">HR Portal — Create Account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Register</CardTitle>
            <CardDescription>Create your HR Portal account</CardDescription>
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
                        <Input placeholder="John Doe" data-testid="input-full-name" {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@agency.gov.pg" data-testid="input-email" {...field} />
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
                        <Input type="password" placeholder="Min. 8 characters" data-testid="input-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agencyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agency Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Department of Finance" data-testid="input-agency-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="roleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="applicant">Public Applicant</SelectItem>
                          <SelectItem value="hr_officer">HR Officer</SelectItem>
                          <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                          <SelectItem value="admin">System Admin</SelectItem>
                          <SelectItem value="executive">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-submit"
                >
                  {registerMutation.isPending ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
