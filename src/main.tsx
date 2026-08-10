import React from "react";
import ReactDOM from "react-dom/client";
import { getRouter } from "./router";
import { RouterProvider } from "@tanstack/react-router";

const router = getRouter();

// Register the router for maximum type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
