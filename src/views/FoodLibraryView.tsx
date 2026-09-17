import { FoodLibrarySettings } from '../components/settings/FoodLibrarySettings';

/** Manage reusable foods that can be quick-added from any day. */
export function FoodLibraryView() {
  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-semibold tracking-tight">Food library</h1>
      <FoodLibrarySettings />
    </div>
  );
}
