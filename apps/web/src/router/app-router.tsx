import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router/router";

export function AppRouter() {
  return <RouterProvider router={router} />;
}
