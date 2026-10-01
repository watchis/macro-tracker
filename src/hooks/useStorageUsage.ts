import { useEffect } from 'react';
import { STORAGE_CRITICAL_RATIO } from '../lib/retention';
import { measureLocalStorageUsage, type LocalStorageUsage } from '../lib/storage';
import { STORAGE_KEY } from '../store/defaults';
import { useAppStore } from '../store/useAppStore';

const OWNED = 'data-storage-lock-owned';
const WAS_DISABLED = 'data-storage-was-disabled';

function unlockElement(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  if (!el.hasAttribute(OWNED)) return;
  el.disabled = el.getAttribute(WAS_DISABLED) === '1';
  el.removeAttribute(OWNED);
  el.removeAttribute(WAS_DISABLED);
}

function lockElement(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  if (el.hasAttribute('data-storage-exempt')) {
    unlockElement(el);
    return;
  }
  if (!el.hasAttribute(OWNED)) {
    el.setAttribute(WAS_DISABLED, el.disabled ? '1' : '0');
    el.setAttribute(OWNED, '1');
  }
  el.disabled = true;
}

function applyStorageInputLock(locked: boolean, root: ParentNode = document): void {
  const controls = root.querySelectorAll('input, textarea, select');
  for (const node of controls) {
    if (!(
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    )) {
      continue;
    }
    if (locked) lockElement(node);
    else unlockElement(node);
  }
}

/**
 * When storage is critically full, disable every input/textarea/select in the
 * document except controls marked `data-storage-exempt` (auto-optimize settings).
 * Buttons stay clickable so Optimize storage and navigation still work.
 */
export function useStorageInputLock(locked: boolean): void {
  useEffect(() => {
    applyStorageInputLock(locked);
    if (!locked) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (
            node instanceof HTMLInputElement ||
            node instanceof HTMLTextAreaElement ||
            node instanceof HTMLSelectElement
          ) {
            lockElement(node);
          }
          applyStorageInputLock(true, node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      applyStorageInputLock(false);
    };
  }, [locked]);
}

/** Re-reads localStorage usage whenever persisted app data changes. */
export function useLocalStorageUsage(): LocalStorageUsage {
  useAppStore((state) => state.days);
  useAppStore((state) => state.weights);
  useAppStore((state) => state.foodLibrary);
  useAppStore((state) => state.foodFavorites);
  useAppStore((state) => state.settings);
  return measureLocalStorageUsage(STORAGE_KEY);
}

export function isStorageCritical(usage: LocalStorageUsage): boolean {
  return usage.usedRatio >= STORAGE_CRITICAL_RATIO;
}
