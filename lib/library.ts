"use client";

import { useCallback, useEffect, useState } from "react";
import type { Paper } from "./openalex";

export type Status = "want" | "read";
export interface Entry {
  status: Status;
  paper: Paper;
  at: number;
}
export type Library = Record<string, Entry>;

const KEY = "paperly:library";

function read(): Library {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

// Reading status per paper, kept in localStorage along with the paper itself
// so saved papers stay available after they drop out of search results.
export function useLibrary() {
  const [lib, setLib] = useState<Library>({});

  useEffect(() => {
    setLib(read());
    const sync = (e: StorageEvent) => e.key === KEY && setLib(read());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Choosing the current status again clears it (back to unread).
  const setStatus = useCallback((paper: Paper, status: Status) => {
    const next = read();
    if (next[paper.id]?.status === status) delete next[paper.id];
    else next[paper.id] = { status, paper, at: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setLib(next);
  }, []);

  return { lib, setStatus };
}
