import { useState, useEffect } from "react";
import { Smartphone, RotateCcw, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export function LandscapeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const { t } = useAuth();

  useEffect(() => {
    const mql = window.matchMedia("(orientation: portrait)");
    setIsPortrait(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (dismissed || !isPortrait) return null;

  return (
    <div className="md:hidden bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mx-2 mb-2 flex items-center gap-2 text-xs text-blue-700">
      <Smartphone className="w-4 h-4 flex-shrink-0" />
      <RotateCcw className="w-3 h-3 flex-shrink-0" />
      <span className="flex-1">{t("common.rotateLandscape")}</span>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded hover:bg-blue-100 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
