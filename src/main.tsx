import { createRoot } from "react-dom/client";
import "./globals.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);

// Offline app-shell caching — production only so Vite HMR is never intercepted.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline caching unavailable; the app still works fully online.
    });
  });
}
