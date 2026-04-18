import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import {
  RootGate,
  LoginGate,
  ProtectedGate,
} from "@/components/auth/bootstrap-gate";
import { AppShell } from "@/components/layout/app-shell";
import { ConnectionsPage } from "@/pages/connections";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { SettingsPage } from "@/pages/settings";
import { WorkflowEditorPage } from "@/pages/workflow-editor";
import { WorkflowRunsPage } from "@/pages/workflow-runs";
import { WorkflowSettingsPage } from "@/pages/workflow-settings";
import { WorkflowsPage } from "@/pages/workflows";

const rootRoute = createRootRoute({
  component: RootGate,
});

const redirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/dashboard" />,
});

const loginGateRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "login-gate",
  component: LoginGate,
});

const loginRoute = createRoute({
  getParentRoute: () => loginGateRoute,
  path: "/login",
  component: LoginPage,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  component: ProtectedGate,
});

const shellRoute = createRoute({
  getParentRoute: () => protectedRoute,
  id: "shell",
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const workflowsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/workflows",
  component: WorkflowsPage,
});

const workflowEditorRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/workflows/$workflowId/editor",
  component: WorkflowEditorPage,
});

const subworkflowEditorRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/workflows/$parentWorkflowId/subworkflow/$subworkflowId/editor",
  component: WorkflowEditorPage,
});

const workflowSettingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/workflows/$workflowId/settings",
  component: WorkflowSettingsPage,
});

const workflowRunsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/workflows/$workflowId/runs",
  component: WorkflowRunsPage,
});

const connectionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/connections",
  component: ConnectionsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  redirectRoute,
  loginGateRoute.addChildren([loginRoute]),
  protectedRoute.addChildren([
    shellRoute.addChildren([
      dashboardRoute,
      workflowsRoute,
      workflowEditorRoute,
      subworkflowEditorRoute,
      workflowSettingsRoute,
      workflowRunsRoute,
      connectionsRoute,
      settingsRoute,
    ]),
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPendingComponent: () => <Outlet />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
