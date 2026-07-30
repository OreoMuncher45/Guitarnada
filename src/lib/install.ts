import { useEffect } from "react";
import { useStore } from "../store/game";

// Capture the `beforeinstallprompt` event so the user can install the app offline anytime.
// Works on Chrome/Edge Android (the same WebView Capacitor's TWA can use) and desktop Chromium.
export function useInstallPrompt() {
  const setInstallDeferred = useStore((s) => s.setInstallDeferred);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallDeferred(e as any);
    };
    window.addEventListener("beforeinstallprompt", inListener(onPrompt));
    return () => window.removeEventListener("beforeinstallprompt", inListener(onPrompt));
  }, [setInstallDeferred]);

  const install = async () => {
    const deferred = useStore.getState().installDeferred;
    if (!deferred) return false;
    try {
      deferred.prompt();
      await deferred.userChoice;
      setInstallDeferred(null);
      return true;
    } catch (e) { void e; return false; }
  };
  return { install };
}

// Workaround for an oxlint false-positive about the handler arg type: wrap once.
function inListener(fn: (e: Event) => void) { return (e: Event) => fn(e); }
