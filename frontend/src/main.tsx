import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import HomePage from "./pages/Home";
import RootLayout from "./layouts/RootLayout";
import { WalletProvider } from "./hooks/use-wallet";
import { ThemeProvider } from "./components/ThemeContex";
import { CollaborationProvider } from "./components/Collaboration";
import "./i18n/config";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "/dashboard",
        lazy: async () => {
          const { default: Dashboard } = await import("./pages/Dashboard");
          return { Component: Dashboard };
        },
      },
      {
        path: "/split/:id",
        lazy: async () => {
          const { SplitDetailPage } =
            await import("./pages/SplitView/SplitDetailPage");
          return { Component: SplitDetailPage };
        },
      },
      {
        path: "/analytics",
        lazy: async () => {
          const { default: AnalyticsDashboard } =
            await import("./pages/AnalyticsDashboard");
          return { Component: AnalyticsDashboard };
        },
      },
      {
        path: "/history",
        lazy: async () => {
          const { default: SplitHistoryPage } = await import(
            "./pages/SplitHistoryPage"
          );
          return { Component: SplitHistoryPage };
        },
      },
      {
        path: "/create-split",
        lazy: async () => {
          const { SplitCreationWizard } = await import(
            "./components/SplitWizard"
          );
          return { Component: SplitCreationWizard };
        },
      },
      {
        path: "/notifications",
        lazy: async () => {
          const { default: NotificationCenterPage } = await import(
            "./pages/NotificationCenterPage"
          );
          return { Component: NotificationCenterPage };
        },
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <WalletProvider>
        <CollaborationProvider>
          <RouterProvider router={router} />
        </CollaborationProvider>
      </WalletProvider>
    </ThemeProvider>
  </StrictMode>,
);
