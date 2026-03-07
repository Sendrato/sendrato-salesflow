import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import LeadForm from "./pages/LeadForm";
import Activity from "./pages/Activity";
import Analytics from "./pages/Analytics";
import AIChat from "./pages/AIChat";
import Import from "./pages/Import";
import CalendarPage from "./pages/Calendar";
import SharedPresentation from "./pages/SharedPresentation";
import PersonsPage from "./pages/Persons";
import PersonDetailPage from "./pages/PersonDetail";
import SettingsPage from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/leads/new" component={LeadForm} />
      <Route path="/leads/:id/edit" component={LeadForm} />
      <Route path="/leads/:id" component={LeadDetail} />
      <Route path="/activity" component={Activity} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ai-chat" component={AIChat} />
      <Route path="/import" component={Import} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/persons" component={PersonsPage} />
      <Route path="/persons/:id" component={PersonDetailPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/share/:token" component={SharedPresentation} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
