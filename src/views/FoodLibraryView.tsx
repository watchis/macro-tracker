import { FoodLibrarySettings } from '../components/settings/FoodLibrarySettings';

/** Manage reusable foods that can be quick-added from any day. */
export function FoodLibraryView() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Food library</h1>
        <p className="mt-1 text-sm text-muted">
          Reusable foods, stated for a reference weight and scaled when you log them.
        </p>
      </div>

      <FoodLibrarySettings />
    </div>
  );
}
