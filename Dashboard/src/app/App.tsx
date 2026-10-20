import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import { EventProvider } from "@/hooks/useEventContext";
import { ThemeProvider } from "@/hooks/useTheme";

import { router } from "./router";

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <EventProvider>
          <RouterProvider router={router} />
        </EventProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
