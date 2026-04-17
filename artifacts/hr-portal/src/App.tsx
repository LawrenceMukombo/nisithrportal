import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/jobs">
        {() => <ProtectedRoute component={JobsPage} />}
      </Route>
      <Route path="/jobs/new">
        {() => <ProtectedRoute component={JobFormPage} />}
      </Route>
      <Route path="/jobs/:id/edit">
        {() => <ProtectedRoute component={JobFormPage} />}
      </Route>
      <Route path="/jobs/:id" component={JobDetailPage} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/candidates">
        {() => <ProtectedRoute component={CandidatesPage} />}
      </Route>
      <Route path="/candidates/:id">
        {() => <ProtectedRoute component={CandidateDetailPage} />}
      </Route>
      <Route path="/applications">
        {() => <ProtectedRoute component={ApplicationsPage} />}
      </Route>
      <Route path="/applications/:id">
        {() => <ProtectedRoute component={ApplicationDetailPage} />}
      </Route>
      <Route path="/employees">
        {() => <ProtectedRoute component={EmployeesPage} />}
      </Route>
      <Route path="/employees/:id">
        {() => <ProtectedRoute component={EmployeeDetailPage} />}
      </Route>
      <Route path="/contracts">
        {() => <ProtectedRoute component={ContractsPage} />}
      </Route>
      <Route path="/contracts/:id">
        {() => <ProtectedRoute component={ContractDetailPage} />}
      </Route>
      <Route path="/agencies">
        {() => <ProtectedRoute component={AgenciesPage} />}
      </Route>
      <Route path="/departments">
        {() => <ProtectedRoute component={DepartmentsPage} />}
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
