import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsView } from './SettingsView';
import { BudgetBar } from '../components/BudgetBar';
import { STORAGE_KEY } from '../store/defaults';
import { useAppStore } from '../store/useAppStore';

function state() {
  return useAppStore.getState();
}

function persisted() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
    state?: { settings?: { accent?: string } };
  };
}

async function confirmAction(testId: string, label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByTestId(testId));
  await user.click(
    within(screen.getByTestId(`${testId}-confirm`)).getByRole('button', { name: label }),
  );
}

describe('SettingsView appearance', () => {
  it('switches theme mode and applies it to the document', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.click(within(screen.getByTestId('theme-mode')).getByRole('radio', { name: 'Dark' }));

    expect(state().settings.themeMode).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies a preset accent and persists it for the next load', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.click(screen.getByTestId('accent-preset-10b981'));

    expect(state().settings.accent).toBe('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#10b981');
    expect(persisted().state?.settings?.accent).toBe('#10b981');
  });

  it('previews a custom hex live and ignores unparsable input', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    const input = screen.getByTestId('accent-hex-input');

    await user.clear(input);
    await user.type(input, '#ff0000');
    expect(state().settings.accent).toBe('#ff0000');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ff0000');

    await user.clear(input);
    await user.type(input, 'zzz');
    expect(screen.getByRole('alert')).toHaveTextContent('Use a hex color');
    expect(state().settings.accent).toBe('#ff0000');
    // The rejected text stays on screen so it can be corrected.
    expect(input).toHaveValue('zzz');
  });
});

describe('SettingsView goals', () => {
  it('validates the calorie goal and keeps the last valid value', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    const input = screen.getByTestId('calorie-goal-input');

    await user.clear(input);
    await user.type(input, '1800');
    expect(state().settings.goals.calories).toBe(1800);

    await user.clear(input);
    await user.type(input, '-5');
    expect(screen.getByRole('alert')).toHaveTextContent('Must be 0 or more.');
    expect(state().settings.goals.calories).toBe(1800);
  });

  it('sets and clears per-macro goals', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    const fiber = screen.getByTestId('macro-goal-fiber');
    await user.type(fiber, '30');
    expect(state().settings.goals.macros.fiber).toBe(30);

    await user.clear(screen.getByTestId('macro-goal-protein'));
    expect(state().settings.goals.macros.protein).toBeUndefined();
  });

  it('rejects a macro goal that is not a number', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.type(screen.getByTestId('macro-goal-carbs'), 'abc');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.');
    expect(state().settings.goals.macros.carbs).toBe(200);
  });
});

describe('SettingsView macro visibility', () => {
  it('shows and hides macros, in the canonical order', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.click(screen.getByTestId('macro-toggle-fiber'));
    expect(state().settings.visibleMacros).toEqual(['protein', 'carbs', 'fat', 'fiber']);

    await user.click(screen.getByTestId('macro-toggle-carbs'));
    expect(state().settings.visibleMacros).toEqual(['protein', 'fat', 'fiber']);
    expect(screen.getByTestId('macro-toggle-carbs')).not.toBeChecked();
  });

  it('drives which chips the budget bar renders', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SettingsView />
        <BudgetBar date="2026-09-17" />
      </>,
    );

    expect(screen.getByTestId('macro-chip-carbs')).toBeInTheDocument();
    expect(screen.queryByTestId('macro-chip-sodium')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('macro-toggle-carbs'));
    await user.click(screen.getByTestId('macro-toggle-sodium'));

    expect(screen.queryByTestId('macro-chip-carbs')).not.toBeInTheDocument();
    expect(screen.getByTestId('macro-chip-sodium')).toBeInTheDocument();
  });
});

describe('SettingsView section order', () => {
  it('lists goals, appearance, import/export, then data', () => {
    render(<SettingsView />);

    const goals = screen.getByTestId('settings-section-goals');
    const appearance = screen.getByTestId('settings-section-appearance');
    const importExport = screen.getByTestId('settings-section-import-export');
    const data = screen.getByTestId('settings-section-data');

    expect(
      goals.compareDocumentPosition(appearance) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      appearance.compareDocumentPosition(importExport) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      importExport.compareDocumentPosition(data) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByTestId('settings-section-calendar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-section-library')).not.toBeInTheDocument();
  });
});

describe('SettingsView import/export', () => {
  it('exports the store as a JSON download', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<SettingsView />);
    await user.click(screen.getByTestId('export-download'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('import-export-status')).toHaveTextContent('Exported your data');

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('imports an export after confirming', async () => {
    render(<SettingsView />);
    const json = JSON.stringify({
      version: 1,
      days: { '2026-09-17': [] },
      foodLibrary: [{ name: 'Tofu', grams: 100, calories: 144, macros: { protein: 17 } }],
      settings: {
        themeMode: 'dark',
        accent: '#84cc16',
        visibleMacros: ['protein'],
        goals: { calories: 2400, macros: { protein: 180 } },
        weekStart: 'monday',
        dataRetention: 'retain-1-year',
      },
    });

    fireEvent.change(screen.getByTestId('import-input'), { target: { value: json } });
    await confirmAction('import-confirm', 'Yes, import');

    expect(state().foodLibrary).toEqual([
      { name: 'Tofu', grams: 100, calories: 144, macros: { protein: 17 } },
    ]);
    expect(state().settings.accent).toBe('#84cc16');
    expect(state().settings.goals.calories).toBe(2400);
    expect(state().settings.dataRetention).toBe('retain-1-year');
    expect(screen.getByTestId('import-export-status')).toHaveTextContent('Imported.');
  });

  it('reports why an import failed and changes nothing', async () => {
    render(<SettingsView />);
    const before = state().foodLibrary.length;

    fireEvent.change(screen.getByTestId('import-input'), { target: { value: 'not json' } });
    await confirmAction('import-confirm', 'Yes, import');

    expect(screen.getByTestId('import-export-status')).toHaveTextContent('not valid JSON');
    expect(state().foodLibrary).toHaveLength(before);
  });
});

describe('SettingsView data', () => {
  it('shows local storage usage and the retention policy', () => {
    render(<SettingsView />);

    expect(screen.getByTestId('storage-usage-summary')).toHaveTextContent(/used/);
    expect(screen.getByTestId('storage-usage-bar')).toBeInTheDocument();
    expect(screen.getByTestId('data-retention')).toHaveValue('forever');
    expect(screen.queryByTestId('data-retention-description')).not.toBeInTheDocument();
  });

  it('updates the retention policy and prunes old days', async () => {
    const user = userEvent.setup();
    state().addEntry('2024-01-15', { name: 'Old', grams: 100, calories: 100, macros: {} });
    state().addEntry('2026-09-17', { name: 'New', grams: 100, calories: 100, macros: {} });
    render(<SettingsView />);

    await user.selectOptions(screen.getByTestId('data-retention'), 'retain-1-year');

    expect(state().settings.dataRetention).toBe('retain-1-year');
    expect(state().days['2024-01-15']).toBeUndefined();
    expect(state().days['2026-09-17']?.[0]?.name).toBe('New');
  });

  it('resets everything after confirming', async () => {
    const user = userEvent.setup();
    state().setCalorieGoal(1234);
    state().removeFood(0);
    render(<SettingsView />);

    await user.click(screen.getByTestId('reset-confirm'));
    await user.click(
      within(screen.getByTestId('reset-confirm-confirm')).getByRole('button', { name: 'Cancel' }),
    );
    expect(state().settings.goals.calories).toBe(1234);

    await confirmAction('reset-confirm', 'Yes, reset all data');

    expect(state().settings.goals.calories).toBe(2000);
    expect(state().foodLibrary).toHaveLength(0);
    expect(screen.getByTestId('calorie-goal-input')).toHaveValue('2000');
    expect(screen.getByTestId('data-status')).toHaveTextContent('Everything is back');
  });
});
