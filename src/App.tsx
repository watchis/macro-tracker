import { AppHeader } from './components/AppHeader';
import { BudgetBar } from './components/BudgetBar';
import { CalendarView } from './views/CalendarView';
import { DayView } from './views/DayView';
import { SettingsView } from './views/SettingsView';
import { useView } from './store/selectors';
import { useTheme } from './theme/useTheme';

export default function App() {
  useTheme();
  const view = useView();

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <AppHeader />
      {/* Bottom padding clears the fixed budget bar. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-32">
        {view === 'calendar' ? <CalendarView /> : null}
        {view === 'day' ? <DayView /> : null}
        {view === 'settings' ? <SettingsView /> : null}
      </main>
      <BudgetBar />
    </div>
  );
}
