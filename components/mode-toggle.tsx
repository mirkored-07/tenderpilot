"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ModeToggleLabels = {
  toggleTheme: string;
  light: string;
  dark: string;
  system: string;
};

const DEFAULT_LABELS: ModeToggleLabels = {
  toggleTheme: "Toggle theme",
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ModeToggle(props: { labels?: Partial<ModeToggleLabels> }) {
  const { setTheme } = useTheme();
  const labels = { ...DEFAULT_LABELS, ...(props.labels ?? {}) };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{labels.toggleTheme}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>{labels.light}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>{labels.dark}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>{labels.system}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
