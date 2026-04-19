import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import ApplicantRegisterPage from "@/pages/applicant-register";
import DashboardPage from "@/pages/dashboard";
import JobsPage from "@/pages/jobs";
import JobDetailPage from "@/pages/job-detail";
import JobFormPage from "@/pages/job-form";
import CandidatesPage from "@/pages/candidates";
import CandidateDetailPage from "@/pages/candidate-detail";
import ApplicationsPage from "@/pages/applications";
import ApplicationDetailPage from "@/pages/application-detail";
import EmployeesPage from "@/pages/employees";
import EmployeeDetailPage from "@/pages/employee-detail";
import ContractsPage from "@/pages/contracts";
import ContractDetailPage from "@/pages/contract-detail";
import AgenciesPage from "@/pages/agencies";
import DepartmentsPage from "@/pages/departments";
import UsersPage from "@/pages/users";
import ContractFormPage from "@/pages/contract-form";
import EmployeeFormPage from "@/pages/employee-form";
import MyApplicationsPage from "@/pages/my-applications";
import AccountPage from "@/pages/account";
import TrackApplicationPage from "@/pages/track-application";
import ShortlistedPage from "@/pages/shortlisted";
import RecruitmentWorkflowPage from "@/pages/recruitment-workflow";
import IntegrationBuilderPage from "@/pages/integration-builder";
import ResetRequestPage from "@/pages/reset-request";
import ResetPasswordPage from "@/pages/reset-password";
import PipelineSlaSettingsPage from "@/pages/pipeline-sla-settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return null;
}

function RedirectToLogin() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/login"); }, [setLocation]);
  return null;
}

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-center px-4">
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          You don't have permission to view this page. Contact your HR administrator if you believe this is an error.
        </p>
        <a href="/" className="text-primary text-sm underline">Return to Home</a>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RedirectToLogin} />
      <Route path="/applicant-register" component={ApplicantRegisterPage} />
      <Route path="/reset-request" component={ResetRequestPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/jobs" component={JobsPage} />
      <Route path="/jobs/new">
        {() => <ProtectedRoute component={JobFormPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/jobs/:id/edit">
        {() => <ProtectedRoute component={JobFormPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/jobs/:id" component={JobDetailPage} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} roles={["admin", "hr_officer", "hiring_manager", "executive"]} />}
      </Route>
      <Route path="/shortlisted">
        {() => <ProtectedRoute component={ShortlistedPage} roles={["admin", "hr_officer", "hiring_manager"]} />}
      </Route>
      <Route path="/candidates">
        {() => <ProtectedRoute component={CandidatesPage} roles={["admin", "hr_officer", "hiring_manager"]} />}
      </Route>
      <Route path="/candidates/:id">
        {() => <ProtectedRoute component={CandidateDetailPage} roles={["admin", "hr_officer", "hiring_manager"]} />}
      </Route>
      <Route path="/applications">
        {() => <ProtectedRoute component={ApplicationsPage} roles={["admin", "hr_officer", "hiring_manager"]} />}
      </Route>
      <Route path="/applications/:id">
        {() => <ProtectedRoute component={ApplicationDetailPage} roles={["admin", "hr_officer", "hiring_manager"]} />}
      </Route>
      <Route path="/employees">
        {() => <ProtectedRoute component={EmployeesPage} roles={["admin", "hr_officer", "executive"]} />}
      </Route>
      <Route path="/employees/new">
        {() => <ProtectedRoute component={EmployeeFormPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/employees/:id">
        {() => <ProtectedRoute component={EmployeeDetailPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/contracts">
        {() => <ProtectedRoute component={ContractsPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/contracts/new">
        {() => <ProtectedRoute component={ContractFormPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/contracts/:id">
        {() => <ProtectedRoute component={ContractDetailPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/agencies">
        {() => <ProtectedRoute component={AgenciesPage} roles={["admin"]} />}
      </Route>
      <Route path="/departments">
        {() => <ProtectedRoute component={DepartmentsPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/users">
        {() => <ProtectedRoute component={UsersPage} roles={["admin"]} />}
      </Route>
      <Route path="/my-applications">
        {() => <ProtectedRoute component={MyApplicationsPage} roles={["applicant"]} />}
      </Route>
      <Route path="/account">
        {() => <ProtectedRoute component={AccountPage} roles={["applicant"]} />}
      </Route>
      <Route path="/track-application" component={TrackApplicationPage} />
      <Route path="/workflow">
        {() => <ProtectedRoute component={RecruitmentWorkflowPage} roles={["admin", "hr_officer"]} />}
      </Route>
      <Route path="/integrations">
        {() => <ProtectedRoute component={IntegrationBuilderPage} roles={["admin"]} />}
      </Route>
      <Route path="/settings/pipeline-sla">
        {() => <ProtectedRoute component={PipelineSlaSettingsPage} roles={["admin"]} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ThemeInit />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
