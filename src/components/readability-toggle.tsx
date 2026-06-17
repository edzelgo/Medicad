import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Accessibility } from "lucide-react";

export type ReadabilityMode = "standard" | "large" | "contrast";
const STORAGE_KEY = "ms-readability-mode";
const ORDER: ReadabilityMode[] = ["standard", "large", "contrast"];
const LABEL: Record<ReadabilityMode, string> = {
  standard: "Standard text",
  large: "Large text",
  contrast: "High contrast",
};

function apply(mode: ReadabilityMode) {
  const root = document.documentElement;
  root.classList.toggle("a11y-large", mode === "large" || mode === "contrast");
  root.classList.toggle("a11y-contrast", mode === "contrast");
}

export function ReadabilityToggle() {
  const [mode, setMode] = useState<ReadabilityMode>("standard");

  useEffect(() => {
    const saved = (typeof window !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as ReadabilityMode | null)
      : null) ?? "standard";
    setMode(saved);
    apply(saved);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    apply(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycle}
      aria-label={`Readability: ${LABEL[mode]}. Click to change.`}
      title={`Readability: ${LABEL[mode]}`}
      className="min-h-11"
    >
      <Accessibility className="h-4 w-4 mr-2" aria-hidden="true" />
      <span className="hidden sm:inline">{LABEL[mode]}</span>
      <span className="sm:hidden">A11y</span>
    </Button>
  );
}