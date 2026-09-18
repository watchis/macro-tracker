import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { queryStarterFoods } from '../data/starterCatalog';
import { formatCalories } from '../lib/totals';
import { useCustomFoods } from '../store/selectors';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { FoodLibraryItem } from '../types';

export type FoodSearchPick = {
  food: FoodLibraryItem;
  source: 'custom' | 'starter';
};

type FoodSearchOption = FoodSearchPick & { key: string };

export type FoodSearchComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  onPick: (pick: FoodSearchPick) => void;
  placeholder?: string;
  'aria-label'?: string;
  autoFocus?: boolean;
  className?: string;
  testId?: string;
  listTestId?: string;
  inputId?: string;
};

/**
 * Typeahead over custom foods and the starter catalog. Free-text entry stays
 * valid; picking a suggestion is optional.
 */
export function FoodSearchCombobox({
  value,
  onChange,
  onPick,
  placeholder = 'Search foods',
  'aria-label': ariaLabel,
  autoFocus,
  className,
  testId,
  listTestId,
  inputId,
}: FoodSearchComboboxProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const resolvedInputId = inputId ?? `${generatedId}-input`;
  const customFoods = useCustomFoods();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [picked, setPicked] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const blurTimer = useRef<number | null>(null);
  const normalizedQuery = value.trim().toLowerCase();

  const customMatches = useMemo(() => {
    if (!normalizedQuery) return customFoods.slice(0, 20);
    return customFoods.filter((food) => food.name.toLowerCase().includes(normalizedQuery));
  }, [customFoods, normalizedQuery]);

  const [starterResult, setStarterResult] = useState<{
    query: string;
    items: FoodLibraryItem[];
  }>({ query: '', items: [] });

  useEffect(() => {
    if (!normalizedQuery) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      queryStarterFoods({ query: normalizedQuery, limit: 40, offset: 0 })
        .then((page) => {
          if (!cancelled) setStarterResult({ query: normalizedQuery, items: page.items });
        })
        .catch(() => {
          if (!cancelled) setStarterResult({ query: normalizedQuery, items: [] });
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [normalizedQuery]);

  useEffect(() => {
    return () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const loading = Boolean(normalizedQuery) && starterResult.query !== normalizedQuery;

  const options = useMemo(() => {
    const starterMatches =
      normalizedQuery && starterResult.query === normalizedQuery ? starterResult.items : [];
    const rows: FoodSearchOption[] = [];
    customMatches.forEach((food, index) => {
      rows.push({ key: `custom:${index}:${food.name}`, food, source: 'custom' });
    });
    starterMatches.forEach((food, index) => {
      rows.push({ key: `starter:${index}:${food.name}`, food, source: 'starter' });
    });
    return rows;
  }, [customMatches, normalizedQuery, starterResult]);

  const activeIndex = options.length === 0 ? 0 : Math.min(highlight, options.length - 1);
  const showMenu = open && !picked;
  const activeOption = options[activeIndex] ?? null;

  useLayoutEffect(() => {
    if (!showMenu || !inputRef.current) return;

    const update = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.bottom + 4,
        width: Math.max(rect.width, 16),
        zIndex: 50,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [showMenu, value, options.length]);

  const pick = (row: FoodSearchOption) => {
    setPicked(true);
    setOpen(false);
    setHighlight(0);
    onPick(row);
  };

  const onQueryChange = (next: string) => {
    setPicked(false);
    setOpen(true);
    setHighlight(0);
    onChange(next);
  };

  const onComboboxKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      if (picked) {
        setPicked(false);
        setOpen(true);
        return;
      }
      setOpen(true);
      if (options.length === 0) return;
      setHighlight((index) => (Math.min(index, options.length - 1) + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (picked) {
        setPicked(false);
        setOpen(true);
        return;
      }
      setOpen(true);
      if (options.length === 0) return;
      setHighlight(
        (index) => (Math.min(index, options.length - 1) - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Enter' && showMenu && activeOption) {
      event.preventDefault();
      event.stopPropagation();
      pick(activeOption);
    }
  };

  const resolvedListTestId =
    listTestId ?? (testId ? `${testId}-suggestions` : 'food-search-suggestions');

  const menu =
    showMenu && typeof document !== 'undefined'
      ? createPortal(
          <ul
            id={listboxId}
            role="listbox"
            data-testid={resolvedListTestId}
            style={menuStyle}
            className="max-h-64 overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-md"
          >
            {loading && options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">Searching…</li>
            ) : options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">
                {normalizedQuery ? 'No matches' : 'Type to search'}
              </li>
            ) : (
              options.map((row, index) => {
                const active = index === activeIndex;
                return (
                  <li
                    key={row.key}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={active}
                    data-testid={`${resolvedListTestId}-option-${index}`}
                    className={[
                      'cursor-pointer px-3 py-2 text-sm',
                      active ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-raised',
                    ].join(' ')}
                    onMouseDown={(event) => {
                      // Keep focus on the input so blur does not close before pick.
                      event.preventDefault();
                      pick(row);
                    }}
                    onMouseEnter={() => setHighlight(index)}
                  >
                    <span className="font-medium">
                      {row.source === 'custom' ? '★ ' : ''}
                      {row.food.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted tabular-nums">
                      {formatCalories(row.food.calories)} kcal / {Math.round(row.food.grams)} g
                    </span>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={resolvedInputId}
        type="text"
        role="combobox"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showMenu}
        aria-controls={listboxId}
        aria-activedescendant={
          showMenu && activeOption ? `${listboxId}-option-${activeIndex}` : undefined
        }
        data-testid={testId}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={() => {
          if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
          if (!picked) setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onComboboxKeyDown}
        className={className}
      />
      {menu}
    </div>
  );
}
