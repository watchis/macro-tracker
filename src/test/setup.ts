import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetAppStore } from '../store/useAppStore';

// jsdom has no matchMedia; the theme hook needs it to resolve 'system'.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  resetAppStore();
});

afterEach(() => {
  cleanup();
});
