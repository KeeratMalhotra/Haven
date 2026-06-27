"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        "transition-colors duration-150"
      )}
      aria-label="Toggle theme"
    >
      {theme === "light" && <Sun className="h-4 w-4" />}
      {theme === "dark" && <Moon className="h-4 w-4" />}
      {theme === "system" && <Monitor className="h-4 w-4" />}
    </button>
  );
}
