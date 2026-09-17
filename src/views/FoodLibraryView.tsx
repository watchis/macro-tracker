import { FoodLibrarySettings } from '../components/settings/FoodLibrarySettings';
import { STARTER_FOOD_COUNT } from '../data/starterCatalog';

/** Manage reusable foods that can be quick-added from any day. */
export function FoodLibraryView() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Food library</h1>
        <p className="mt-1 text-sm text-muted">
          {STARTER_FOOD_COUNT.toLocaleString()} USDA starter foods, organized by category and loaded
          as you search or browse. Add custom foods on top — both scale by grams when you log them.
        </p>
      </div>

      <FoodLibrarySettings />
    </div>
  );
}
