import { RouterProvider } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { router } from "@/router/router";

export function AppRouter() {
  return (
    <>
      <RouterProvider router={router} />
      {import.meta.env.DEV ? (
        <TanStackRouterDevtools
          router={router}
          initialIsOpen={false}
          position="bottom-right"
        />
      ) : null}
    </>
  );
}
