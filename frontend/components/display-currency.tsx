"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CURRENCIES, type Currency } from "@/lib/constants";

// Moneda de visualización global (ARS o USD al MEP), persistida en
// localStorage. En SSR e hidratación se usa "ARS"; el valor guardado se
// aplica en el primer render cliente sin mismatch (useSyncExternalStore).
const STORAGE_KEY = "capitale.displayCurrency";
const CHANGE_EVENT = "capitale:display-currency";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): Currency {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && (CURRENCIES as readonly string[]).includes(stored)
    ? (stored as Currency)
    : "ARS";
}

function getServerSnapshot(): Currency {
  return "ARS";
}

export function useDisplayCurrency() {
  const displayCurrency = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setDisplayCurrency = useCallback((currency: Currency) => {
    localStorage.setItem(STORAGE_KEY, currency);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { displayCurrency, setDisplayCurrency };
}
