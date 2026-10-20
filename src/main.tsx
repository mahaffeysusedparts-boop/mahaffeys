import { createRoot } from "react-dom/client";
import "./globals.css";
import "./print-map.css";
import App from "./App.tsx";
import { diagnosticLogger } from "./services/diagnosticLogger";

window.addEventListener("error", (event) => {
  diagnosticLogger.error("BrowserRuntime", event.message || "Unhandled browser error", event.error instanceof Error ? event.error : undefined);
});
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason instanceof Error ? event.reason : undefined;
  diagnosticLogger.error("UnhandledPromise", error?.message || "Unhandled promise rejection", error);
});

createRoot(document.getElementById("root")!).render(<App />);

// Offline app-shell caching — production only so Vite HMR is never intercepted.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline caching unavailable; the app still works fully online.
    });
  });
}
