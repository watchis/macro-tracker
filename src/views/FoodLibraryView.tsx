import { FoodLibrarySettings } from '../components/settings/FoodLibrarySettings';
import { STARTER_FOOD_LIBRARY } from '../data/starterFoodLibrary';

/** Manage reusable foods that can be quick-added from any day. */
export function FoodLibraryView() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Food library</h1>
        <p className="mt-1 text-sm text-muted">
          {STARTER_FOOD_LIBRARY.length} USDA starter foods load with the app. Add your own custom
          foods on top — both are searchable and scale by grams when you log them.
        </p>
      </div>

      <FoodLibrarySettings />
    </div>
  );
}
