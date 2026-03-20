/**
 * UI State Store using Zustand
 * Lightweight store for UI-only state shared across components.
 * Not tracked by undo/redo.
 */

import { create } from 'zustand';
import type { DisplayMode } from '../types/decisionTable';

interface UIStore {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  displayMode: 'practice',
  setDisplayMode: (mode) => set({ displayMode: mode }),
}));
