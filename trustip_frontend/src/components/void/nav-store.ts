"use client";

import { create } from "zustand";

type NavState = {
  active: string;
  setActive: (id: string) => void;
};

export const useNavStore = create<NavState>((set) => ({
  active: "index",
  setActive: (id) => set({ active: id }),
}));
