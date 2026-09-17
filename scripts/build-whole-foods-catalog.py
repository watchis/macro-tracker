#!/usr/bin/env python3
"""Build the curated whole-foods starter catalog.

Values are per 100 g edible portion, drawn primarily from public-domain USDA
FoodData Central (Foundation + SR Legacy) figures, with clean everyday names
instead of USDA commodity phrasing. Processed, branded, restaurant, and
fast-food items are intentionally omitted.

Run from repo root:
  python3 scripts/build-whole-foods-catalog.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "data" / "starter"
CATEGORIES_DIR = OUT_DIR / "categories"

# (name, kcal, protein_g, carbs_g, fat_g, fiber_g?, sugar_g?, satFat_g?, sodium_mg?)
# Omitted optional macros are left out of the JSON (same as prior catalog).

Food = tuple  # loose typing for the flat tuples below


def food(
    name: str,
    calories: float,
    protein: float,
    carbs: float,
    fat: float,
    *,
    fiber: float | None = None,
    sugar: float | None = None,
    satFat: float | None = None,
    sodium: float | None = None,
) -> dict:
    macros: dict[str, float] = {
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
    }
    if fiber is not None:
        macros["fiber"] = fiber
    if sugar is not None:
        macros["sugar"] = sugar
    if satFat is not None:
        macros["satFat"] = satFat
    if sodium is not None:
        macros["sodium"] = sodium
    return {
        "name": name,
        "grams": 100,
        "calories": calories,
        "macros": macros,
    }


CATEGORIES: list[dict] = [
    {
        "id": "poultry",
        "label": "Poultry",
        "foods": [
            food("Chicken breast", 165, 31.0, 0, 3.6, satFat=1.0, sodium=74),
            food("Chicken breast, raw", 120, 22.5, 0, 2.6, satFat=0.6, sodium=45),
            food("Chicken thigh, cooked, skinless", 179, 24.8, 0, 8.2, satFat=2.3, sodium=84),
            food("Chicken thigh, raw, skinless", 121, 19.7, 0, 4.1, satFat=1.1, sodium=84),
            food("Chicken drumstick, cooked, skinless", 155, 24.2, 0, 5.7, satFat=1.5, sodium=91),
            food("Chicken wing, cooked, skinless", 203, 30.5, 0, 8.1, satFat=2.3, sodium=82),
            food("Chicken, dark meat, cooked, skinless", 205, 27.4, 0, 9.7, satFat=2.7, sodium=87),
            food("Chicken, light meat, cooked, skinless", 173, 30.9, 0, 4.5, satFat=1.3, sodium=74),
            food("Whole chicken, roasted, meat only", 190, 27.3, 0, 7.4, satFat=2.0, sodium=86),
            food("Ground chicken, cooked", 189, 23.0, 0, 11.0, satFat=2.9, sodium=82),
            food("Ground chicken, raw", 143, 17.4, 0, 8.1, satFat=2.3, sodium=60),
            food("Turkey breast, cooked", 135, 30.1, 0, 0.7, satFat=0.2, sodium=48),
            food("Turkey breast, raw", 104, 23.7, 0, 0.7, satFat=0.2, sodium=49),
            food("Turkey thigh, cooked", 159, 24.0, 0, 6.0, satFat=2.0, sodium=72),
            food("Ground turkey, cooked (93% lean)", 176, 27.1, 0, 7.7, satFat=2.0, sodium=78),
            food("Ground turkey, raw (93% lean)", 150, 18.7, 0, 8.3, satFat=2.2, sodium=69),
            food("Duck breast, cooked, skinless", 140, 23.5, 0, 4.0, satFat=1.0, sodium=65),
            food("Duck, roasted, meat only", 201, 23.5, 0, 11.2, satFat=3.7, sodium=65),
        ],
    },
    {
        "id": "beef",
        "label": "Beef",
        "foods": [
            food("Beef sirloin steak, cooked", 183, 26.0, 0, 8.0, satFat=3.0, sodium=54),
            food("Beef sirloin steak, raw", 135, 21.0, 0, 5.0, satFat=1.9, sodium=54),
            food("Beef tenderloin, cooked", 194, 27.0, 0, 9.0, satFat=3.4, sodium=52),
            food("Beef ribeye steak, cooked", 291, 24.0, 0, 21.0, satFat=9.0, sodium=54),
            food("Beef flank steak, cooked", 192, 27.0, 0, 8.0, satFat=3.0, sodium=56),
            food("Beef brisket, cooked", 241, 28.0, 0, 14.0, satFat=5.0, sodium=65),
            food("Beef chuck roast, cooked", 250, 26.0, 0, 16.0, satFat=6.0, sodium=55),
            food("Beef round steak, cooked", 167, 28.0, 0, 5.0, satFat=1.8, sodium=45),
            food("Ground beef, cooked (95% lean)", 174, 26.0, 0, 7.0, satFat=3.0, sodium=66),
            food("Ground beef, cooked (90% lean)", 217, 26.0, 0, 12.0, satFat=4.7, sodium=72),
            food("Ground beef, cooked (85% lean)", 240, 25.0, 0, 15.0, satFat=5.8, sodium=75),
            food("Ground beef, cooked (80% lean)", 254, 25.0, 0, 17.0, satFat=6.5, sodium=75),
            food("Ground beef, raw (90% lean)", 176, 20.0, 0, 10.0, satFat=3.9, sodium=66),
            food("Beef liver, cooked", 175, 26.5, 5.1, 4.7, satFat=2.0, sodium=79),
            food("Beef short ribs, cooked", 295, 22.0, 0, 23.0, satFat=10.0, sodium=60),
            food("Venison / deer, cooked", 158, 30.0, 0, 3.2, satFat=1.2, sodium=51),
            food("Bison, cooked", 143, 28.4, 0, 2.4, satFat=0.9, sodium=57),
        ],
    },
    {
        "id": "pork",
        "label": "Pork",
        "foods": [
            food("Pork tenderloin, cooked", 143, 26.0, 0, 3.5, satFat=1.2, sodium=47),
            food("Pork loin chop, cooked, lean", 173, 27.0, 0, 7.0, satFat=2.4, sodium=52),
            food("Pork shoulder, cooked", 236, 24.0, 0, 15.0, satFat=5.4, sodium=62),
            food("Pork ribs, cooked", 277, 23.0, 0, 20.0, satFat=7.0, sodium=70),
            food("Ground pork, cooked", 263, 23.0, 0, 19.0, satFat=7.0, sodium=65),
            food("Pork belly, cooked", 518, 9.3, 0, 53.0, satFat=19.0, sodium=20),
            food("Bacon, cooked", 468, 34.0, 1.4, 35.0, satFat=12.0, sodium=1717),
            food("Ham, cooked, lean", 145, 21.0, 1.5, 5.5, satFat=1.8, sodium=1203),
            food("Canadian bacon, cooked", 146, 20.0, 1.3, 6.5, satFat=2.2, sodium=1284),
        ],
    },
    {
        "id": "lamb",
        "label": "Lamb",
        "foods": [
            food("Lamb leg, cooked, lean", 191, 28.0, 0, 8.0, satFat=2.9, sodium=66),
            food("Lamb loin chop, cooked", 250, 25.0, 0, 16.0, satFat=7.0, sodium=70),
            food("Lamb shoulder, cooked", 268, 24.0, 0, 19.0, satFat=8.0, sodium=68),
            food("Ground lamb, cooked", 283, 25.0, 0, 20.0, satFat=8.0, sodium=72),
            food("Lamb rack, cooked", 290, 23.0, 0, 22.0, satFat=10.0, sodium=70),
        ],
    },
    {
        "id": "fish-seafood",
        "label": "Fish & seafood",
        "foods": [
            food("Salmon, Atlantic, cooked", 206, 22.1, 0, 12.4, satFat=2.5, sodium=61),
            food("Salmon, Atlantic, raw", 208, 20.4, 0, 13.4, satFat=3.1, sodium=59),
            food("Salmon, sockeye, cooked", 185, 25.0, 0, 9.0, satFat=1.5, sodium=60),
            food("Tuna, yellowfin, cooked", 130, 29.0, 0, 0.6, satFat=0.2, sodium=47),
            food("Tuna, canned in water, drained", 86, 19.0, 0, 1.0, satFat=0.2, sodium=247),
            food("Tuna, canned in oil, drained", 198, 29.0, 0, 8.0, satFat=1.3, sodium=354),
            food("Cod, cooked", 105, 23.0, 0, 0.9, satFat=0.2, sodium=78),
            food("Tilapia, cooked", 128, 26.0, 0, 2.7, satFat=0.9, sodium=56),
            food("Halibut, cooked", 140, 27.0, 0, 2.9, satFat=0.4, sodium=69),
            food("Trout, cooked", 190, 27.0, 0, 8.5, satFat=1.8, sodium=57),
            food("Sardines, canned in oil, drained", 208, 25.0, 0, 11.0, satFat=1.5, sodium=307),
            food("Mackerel, cooked", 262, 24.0, 0, 18.0, satFat=4.2, sodium=83),
            food("Anchovy, canned in oil, drained", 210, 29.0, 0, 9.7, satFat=2.2, sodium=3668),
            food("Shrimp, cooked", 99, 24.0, 0.2, 0.3, satFat=0.1, sodium=111),
            food("Crab, cooked", 97, 19.0, 0, 1.5, satFat=0.2, sodium=563),
            food("Lobster, cooked", 89, 19.0, 0, 0.9, satFat=0.2, sodium=486),
            food("Scallops, cooked", 111, 23.0, 5.4, 0.8, satFat=0.2, sodium=667),
            food("Mussels, cooked", 172, 24.0, 7.4, 4.5, satFat=0.9, sodium=369),
            food("Clams, cooked", 148, 26.0, 5.1, 2.0, satFat=0.2, sodium=112),
            food("Oysters, cooked", 79, 9.0, 4.2, 2.1, satFat=0.6, sodium=166),
            food("White fish, cooked (generic)", 120, 23.0, 0, 2.0, satFat=0.4, sodium=70),
        ],
    },
    {
        "id": "dairy-eggs",
        "label": "Dairy & eggs",
        "foods": [
            food("Whole egg", 143, 12.6, 0.7, 9.5, satFat=3.1, sodium=142),
            food("Egg white", 52, 11.0, 0.7, 0.2, sodium=166),
            food("Egg yolk", 322, 15.9, 3.6, 26.5, satFat=9.6, sodium=48),
            food("Egg, hard-boiled", 155, 12.6, 1.1, 10.6, satFat=3.3, sodium=124),
            food("Egg, scrambled (milk + butter)", 149, 10.0, 1.6, 11.0, satFat=3.3, sodium=145),
            food("Milk, whole (3.25%)", 61, 3.2, 4.8, 3.3, sugar=5.1, satFat=1.9, sodium=43),
            food("Milk, 2%", 50, 3.3, 4.8, 2.0, sugar=5.1, satFat=1.2, sodium=47),
            food("Milk, 1%", 42, 3.4, 5.0, 1.0, sugar=5.2, satFat=0.6, sodium=44),
            food("Milk, skim / nonfat", 34, 3.4, 5.0, 0.1, sugar=5.1, satFat=0.1, sodium=42),
            food("Greek yogurt, nonfat", 59, 10.2, 3.6, 0.4, sugar=3.2, sodium=36),
            food("Greek yogurt, 2%", 73, 9.9, 3.9, 1.9, sugar=3.6, satFat=1.2, sodium=34),
            food("Greek yogurt, whole milk", 97, 9.0, 3.6, 5.0, sugar=3.2, satFat=2.6, sodium=35),
            food("Plain yogurt, low-fat", 63, 5.3, 7.0, 1.6, sugar=7.0, satFat=1.0, sodium=70),
            food("Plain yogurt, whole milk", 61, 3.5, 4.7, 3.3, sugar=4.7, satFat=2.1, sodium=46),
            food("Cottage cheese, low-fat (2%)", 81, 11.0, 3.4, 2.3, sugar=2.7, satFat=0.9, sodium=330),
            food("Cottage cheese, nonfat", 72, 12.4, 2.7, 0.3, sugar=1.9, sodium=330),
            food("Ricotta, whole milk", 174, 11.3, 3.0, 13.0, sugar=0.3, satFat=8.3, sodium=84),
            food("Ricotta, part-skim", 138, 11.4, 5.1, 7.9, sugar=0.3, satFat=4.9, sodium=125),
            food("Cheddar cheese", 403, 25.0, 1.3, 33.0, sugar=0.5, satFat=21.0, sodium=621),
            food("Mozzarella, part-skim", 254, 24.0, 2.8, 16.0, sugar=1.1, satFat=10.0, sodium=486),
            food("Mozzarella, whole milk", 300, 22.0, 2.2, 22.0, sugar=1.0, satFat=13.0, sodium=627),
            food("Parmesan cheese", 392, 36.0, 3.2, 25.0, sugar=0.9, satFat=16.0, sodium=1529),
            food("Swiss cheese", 380, 27.0, 5.4, 28.0, sugar=1.4, satFat=18.0, sodium=192),
            food("Feta cheese", 264, 14.0, 4.1, 21.0, sugar=4.1, satFat=15.0, sodium=917),
            food("Cream cheese", 342, 6.0, 4.1, 34.0, sugar=3.8, satFat=19.0, sodium=321),
            food("Butter, unsalted", 717, 0.9, 0.1, 81.0, satFat=51.0, sodium=11),
            food("Butter, salted", 717, 0.9, 0.1, 81.0, satFat=51.0, sodium=643),
            food("Heavy cream", 340, 2.8, 2.8, 36.0, sugar=2.9, satFat=23.0, sodium=38),
            food("Half-and-half", 130, 3.1, 4.3, 12.0, sugar=4.1, satFat=7.0, sodium=41),
            food("Sour cream", 198, 2.4, 4.6, 19.0, sugar=3.4, satFat=12.0, sodium=40),
            food("Whey protein isolate (dry)", 357, 84.0, 5.0, 1.5, sugar=2.0, sodium=250),
            food("Casein protein (dry)", 370, 80.0, 5.0, 2.0, sugar=2.0, sodium=200),
        ],
    },
    {
        "id": "grains",
        "label": "Grains & pasta",
        "foods": [
            food("White rice, cooked", 130, 2.7, 28.0, 0.3, fiber=0.4, sugar=0.1, sodium=1),
            food("White rice, dry", 365, 7.1, 80.0, 0.7, fiber=1.3, sugar=0.1, sodium=5),
            food("Brown rice, cooked", 123, 2.7, 26.0, 1.0, fiber=1.6, sugar=0.2, sodium=4),
            food("Brown rice, dry", 370, 7.5, 77.0, 2.9, fiber=3.5, sugar=0.9, sodium=7),
            food("Basmati rice, cooked", 121, 3.0, 25.0, 0.4, fiber=0.4, sodium=1),
            food("Jasmine rice, cooked", 130, 2.7, 28.0, 0.3, fiber=0.4, sodium=1),
            food("Wild rice, cooked", 101, 4.0, 21.0, 0.3, fiber=1.8, sugar=0.7, sodium=3),
            food("Rolled oats", 379, 13.2, 67.0, 6.5, fiber=10.1, sugar=0.9, satFat=1.1, sodium=6),
            food("Oatmeal, cooked with water", 71, 2.5, 12.0, 1.5, fiber=1.7, sugar=0.3, sodium=4),
            food("Steel-cut oats, dry", 379, 13.0, 67.0, 6.5, fiber=10.0, sugar=1.0, sodium=5),
            food("Quinoa, cooked", 120, 4.4, 21.0, 1.9, fiber=2.8, sugar=0.9, sodium=7),
            food("Quinoa, dry", 368, 14.0, 64.0, 6.1, fiber=7.0, sugar=0.0, sodium=5),
            food("Couscous, cooked", 112, 3.8, 23.0, 0.2, fiber=1.4, sugar=0.1, sodium=5),
            food("Bulgur, cooked", 83, 3.1, 19.0, 0.2, fiber=4.5, sugar=0.1, sodium=5),
            food("Barley, pearled, cooked", 123, 2.3, 28.0, 0.4, fiber=3.8, sugar=0.3, sodium=3),
            food("Farro, cooked", 127, 5.0, 26.0, 0.8, fiber=3.5, sodium=2),
            food("Millet, cooked", 119, 3.5, 23.0, 1.0, fiber=1.3, sugar=0.1, sodium=2),
            food("Buckwheat, cooked", 92, 3.4, 20.0, 0.6, fiber=2.7, sugar=0.9, sodium=4),
            food("Pasta, white, cooked", 131, 5.0, 25.0, 1.1, fiber=1.8, sugar=0.6, sodium=1),
            food("Pasta, whole wheat, cooked", 124, 5.3, 26.0, 0.5, fiber=3.9, sugar=0.8, sodium=3),
            food("Pasta, dry", 371, 13.0, 75.0, 1.5, fiber=3.2, sugar=2.7, sodium=6),
            food("Egg noodles, cooked", 138, 4.5, 25.0, 2.1, fiber=1.2, sugar=0.4, sodium=5),
            food("Bread, white", 265, 9.0, 49.0, 3.2, fiber=2.7, sugar=5.0, satFat=0.7, sodium=491),
            food("Bread, whole wheat", 247, 13.0, 41.0, 3.4, fiber=7.0, sugar=6.0, satFat=0.7, sodium=450),
            food("Bread, sourdough", 273, 9.0, 52.0, 2.0, fiber=2.4, sugar=2.5, sodium=500),
            food("Pita bread, white", 275, 9.0, 56.0, 1.2, fiber=2.2, sugar=1.3, sodium=536),
            food("Tortilla, flour", 297, 8.0, 49.0, 7.5, fiber=2.8, sugar=2.0, satFat=1.8, sodium=500),
            food("Tortilla, corn", 218, 5.7, 45.0, 2.9, fiber=6.3, sugar=0.9, satFat=0.4, sodium=45),
            food("English muffin", 227, 8.7, 45.0, 1.8, fiber=3.5, sugar=2.0, sodium=400),
            food("Bagel", 257, 10.0, 53.0, 1.1, fiber=1.6, sugar=5.0, sodium=433),
            food("Cornmeal, dry", 370, 8.1, 79.0, 1.8, fiber=7.3, sugar=0.6, sodium=7),
            food("Polenta, cooked", 85, 2.0, 18.0, 0.4, fiber=1.0, sodium=5),
            food("Flour, all-purpose", 364, 10.0, 76.0, 1.0, fiber=2.7, sugar=0.3, sodium=2),
            food("Flour, whole wheat", 340, 13.0, 72.0, 2.5, fiber=11.0, sugar=0.4, sodium=2),
            food("Cornstarch", 381, 0.3, 91.0, 0.1, fiber=0.9, sodium=9),
        ],
    },
    {
        "id": "legumes",
        "label": "Legumes",
        "foods": [
            food("Black beans, cooked", 132, 8.9, 24.0, 0.5, fiber=8.7, sugar=0.3, sodium=1),
            food("Kidney beans, cooked", 127, 8.7, 23.0, 0.5, fiber=6.4, sugar=0.3, sodium=2),
            food("Pinto beans, cooked", 143, 9.0, 26.0, 0.7, fiber=9.0, sugar=0.3, sodium=1),
            food("Chickpeas / garbanzo, cooked", 164, 8.9, 27.0, 2.6, fiber=7.6, sugar=4.8, sodium=7),
            food("Lentils, cooked", 116, 9.0, 20.0, 0.4, fiber=7.9, sugar=1.8, sodium=2),
            food("Green lentils, cooked", 116, 9.0, 20.0, 0.4, fiber=7.9, sugar=1.8, sodium=2),
            food("Red lentils, cooked", 116, 9.0, 20.0, 0.4, fiber=7.9, sugar=1.8, sodium=2),
            food("Navy beans, cooked", 140, 8.2, 26.0, 0.6, fiber=10.5, sugar=0.4, sodium=0),
            food("Cannellini beans, cooked", 139, 9.7, 25.0, 0.5, fiber=6.3, sugar=0.3, sodium=4),
            food("Black-eyed peas, cooked", 116, 7.7, 21.0, 0.5, fiber=6.5, sugar=3.3, sodium=4),
            food("Edamame, cooked", 121, 12.0, 9.0, 5.2, fiber=5.2, sugar=2.2, sodium=6),
            food("Soybeans, cooked", 172, 18.0, 8.4, 9.0, fiber=6.0, sugar=3.0, satFat=1.3, sodium=1),
            food("Tofu, firm", 144, 17.0, 2.8, 8.7, fiber=2.3, sugar=0.6, satFat=1.3, sodium=14),
            food("Tofu, soft / silken", 55, 4.8, 2.0, 3.3, fiber=0.1, sugar=0.7, satFat=0.5, sodium=8),
            food("Tempeh", 192, 20.0, 7.6, 11.0, fiber=0, sugar=0, satFat=2.5, sodium=9),
            food("Split peas, cooked", 118, 8.3, 21.0, 0.4, fiber=8.3, sugar=2.9, sodium=2),
            food("Peanuts, raw", 567, 26.0, 16.0, 49.0, fiber=8.5, sugar=4.0, satFat=6.3, sodium=18),
            food("Peanut butter, natural", 588, 25.0, 20.0, 50.0, fiber=6.0, sugar=9.0, satFat=10.0, sodium=17),
            food("Hummus", 166, 7.9, 14.0, 9.6, fiber=6.0, sugar=0.3, satFat=1.4, sodium=379),
        ],
    },
    {
        "id": "vegetables",
        "label": "Vegetables",
        "foods": [
            food("Broccoli, raw", 34, 2.8, 7.0, 0.4, fiber=2.6, sugar=1.7, sodium=33),
            food("Broccoli, cooked", 35, 2.4, 7.2, 0.4, fiber=3.3, sugar=1.4, sodium=41),
            food("Spinach, raw", 23, 2.9, 3.6, 0.4, fiber=2.2, sugar=0.4, sodium=79),
            food("Spinach, cooked", 23, 3.0, 3.8, 0.3, fiber=2.4, sugar=0.4, sodium=70),
            food("Kale, raw", 35, 2.9, 4.4, 1.5, fiber=4.1, sugar=0.8, sodium=53),
            food("Kale, cooked", 28, 1.9, 5.6, 0.4, fiber=2.0, sugar=1.3, sodium=23),
            food("Lettuce, romaine", 17, 1.2, 3.3, 0.3, fiber=2.1, sugar=1.2, sodium=8),
            food("Lettuce, iceberg", 14, 0.9, 3.0, 0.1, fiber=1.2, sugar=2.0, sodium=10),
            food("Arugula", 25, 2.6, 3.7, 0.7, fiber=1.6, sugar=2.1, sodium=27),
            food("Cabbage, raw", 25, 1.3, 5.8, 0.1, fiber=2.5, sugar=3.2, sodium=18),
            food("Cauliflower, raw", 25, 1.9, 5.0, 0.3, fiber=2.0, sugar=1.9, sodium=30),
            food("Cauliflower, cooked", 23, 1.8, 4.1, 0.5, fiber=2.3, sugar=1.9, sodium=15),
            food("Brussels sprouts, cooked", 36, 2.6, 7.1, 0.5, fiber=2.6, sugar=1.7, sodium=21),
            food("Asparagus, cooked", 22, 2.4, 4.1, 0.2, fiber=2.0, sugar=1.3, sodium=14),
            food("Green beans, cooked", 35, 1.9, 7.9, 0.3, fiber=3.2, sugar=3.6, sodium=1),
            food("Peas, green, cooked", 84, 5.4, 16.0, 0.2, fiber=5.5, sugar=5.9, sodium=3),
            food("Corn, sweet, cooked", 96, 3.4, 21.0, 1.5, fiber=2.4, sugar=4.5, sodium=1),
            food("Carrot, raw", 41, 0.9, 10.0, 0.2, fiber=2.8, sugar=4.7, sodium=69),
            food("Carrot, cooked", 35, 0.8, 8.2, 0.2, fiber=3.0, sugar=3.5, sodium=58),
            food("Bell pepper, red, raw", 31, 1.0, 6.0, 0.3, fiber=2.1, sugar=4.2, sodium=4),
            food("Bell pepper, green, raw", 20, 0.9, 4.6, 0.2, fiber=1.7, sugar=2.4, sodium=3),
            food("Tomato, raw", 18, 0.9, 3.9, 0.2, fiber=1.2, sugar=2.6, sodium=5),
            food("Cherry tomatoes", 18, 0.9, 3.9, 0.2, fiber=1.2, sugar=2.6, sodium=5),
            food("Cucumber, raw", 15, 0.7, 3.6, 0.1, fiber=0.5, sugar=1.7, sodium=2),
            food("Zucchini, raw", 17, 1.2, 3.1, 0.3, fiber=1.0, sugar=2.5, sodium=8),
            food("Zucchini, cooked", 15, 1.1, 2.7, 0.4, fiber=1.0, sugar=1.7, sodium=3),
            food("Eggplant, cooked", 35, 0.8, 8.7, 0.2, fiber=2.5, sugar=3.2, sodium=1),
            food("Onion, raw", 40, 1.1, 9.3, 0.1, fiber=1.7, sugar=4.2, sodium=4),
            food("Garlic, raw", 149, 6.4, 33.0, 0.5, fiber=2.1, sugar=1.0, sodium=17),
            food("Ginger root, raw", 80, 1.8, 18.0, 0.8, fiber=2.0, sugar=1.7, sodium=13),
            food("Potato, baked, flesh only", 93, 2.5, 21.0, 0.1, fiber=2.2, sugar=1.2, sodium=10),
            food("Potato, boiled", 87, 1.9, 20.0, 0.1, fiber=1.8, sugar=0.9, sodium=5),
            food("Sweet potato, baked", 90, 2.0, 21.0, 0.2, fiber=3.3, sugar=6.5, sodium=36),
            food("Sweet potato, boiled", 76, 1.4, 18.0, 0.1, fiber=2.5, sugar=5.6, sodium=27),
            food("Yam, cooked", 116, 1.5, 28.0, 0.1, fiber=4.1, sugar=0.5, sodium=8),
            food("Beet, cooked", 44, 1.7, 10.0, 0.2, fiber=2.0, sugar=8.0, sodium=77),
            food("Celery, raw", 14, 0.7, 3.0, 0.2, fiber=1.6, sugar=1.3, sodium=80),
            food("Mushroom, white, raw", 22, 3.1, 3.3, 0.3, fiber=1.0, sugar=2.0, sodium=5),
            food("Mushroom, white, cooked", 28, 2.2, 5.3, 0.5, fiber=2.2, sugar=2.2, sodium=2),
            food("Avocado", 160, 2.0, 8.5, 15.0, fiber=6.7, sugar=0.7, satFat=2.1, sodium=7),
            food("Olives, green", 145, 1.0, 3.8, 15.0, fiber=3.3, sugar=0.5, satFat=2.0, sodium=1556),
            food("Olives, black", 116, 0.8, 6.0, 11.0, fiber=1.6, sugar=0, satFat=1.5, sodium=735),
            food("Pumpkin, cooked", 20, 0.7, 4.9, 0.1, fiber=1.1, sugar=2.1, sodium=1),
            food("Butternut squash, cooked", 40, 0.9, 10.0, 0.1, fiber=3.2, sugar=2.0, sodium=4),
            food("Acorn squash, cooked", 56, 1.1, 15.0, 0.1, fiber=4.4, sugar=0, sodium=4),
            food("Radish, raw", 16, 0.7, 3.4, 0.1, fiber=1.6, sugar=1.9, sodium=39),
            food("Turnip, cooked", 22, 0.7, 5.1, 0.1, fiber=2.0, sugar=3.0, sodium=25),
            food("Artichoke, cooked", 53, 2.9, 12.0, 0.3, fiber=5.7, sugar=1.0, sodium=60),
            food("Okra, cooked", 22, 1.9, 4.5, 0.2, fiber=2.5, sugar=2.4, sodium=6),
            food("Bok choy, cooked", 12, 1.6, 1.8, 0.2, fiber=1.0, sugar=0.8, sodium=58),
            food("Collard greens, cooked", 33, 2.7, 5.6, 0.7, fiber=4.0, sugar=0.4, sodium=20),
            food("Swiss chard, cooked", 19, 1.9, 3.7, 0.1, fiber=1.7, sugar=1.1, sodium=179),
        ],
    },
    {
        "id": "fruits",
        "label": "Fruits",
        "foods": [
            food("Banana", 89, 1.1, 23.0, 0.3, fiber=2.6, sugar=12.0, sodium=1),
            food("Apple", 52, 0.3, 14.0, 0.2, fiber=2.4, sugar=10.0, sodium=1),
            food("Orange", 47, 0.9, 12.0, 0.1, fiber=2.4, sugar=9.4, sodium=0),
            food("Strawberries", 32, 0.7, 7.7, 0.3, fiber=2.0, sugar=4.9, sodium=1),
            food("Blueberries", 57, 0.7, 14.0, 0.3, fiber=2.4, sugar=10.0, sodium=1),
            food("Raspberries", 52, 1.2, 12.0, 0.7, fiber=6.5, sugar=4.4, sodium=1),
            food("Blackberries", 43, 1.4, 10.0, 0.5, fiber=5.3, sugar=4.9, sodium=1),
            food("Grapes", 69, 0.7, 18.0, 0.2, fiber=0.9, sugar=16.0, sodium=2),
            food("Watermelon", 30, 0.6, 7.6, 0.2, fiber=0.4, sugar=6.2, sodium=1),
            food("Cantaloupe", 34, 0.8, 8.2, 0.2, fiber=0.9, sugar=7.9, sodium=16),
            food("Honeydew melon", 36, 0.5, 9.1, 0.1, fiber=0.8, sugar=8.1, sodium=18),
            food("Pineapple", 50, 0.5, 13.0, 0.1, fiber=1.4, sugar=10.0, sodium=1),
            food("Mango", 60, 0.8, 15.0, 0.4, fiber=1.6, sugar=14.0, sodium=1),
            food("Papaya", 43, 0.5, 11.0, 0.3, fiber=1.7, sugar=7.8, sodium=8),
            food("Peach", 39, 0.9, 10.0, 0.3, fiber=1.5, sugar=8.4, sodium=0),
            food("Nectarine", 44, 1.1, 11.0, 0.3, fiber=1.7, sugar=7.9, sodium=0),
            food("Pear", 57, 0.4, 15.0, 0.1, fiber=3.1, sugar=10.0, sodium=1),
            food("Plum", 46, 0.7, 11.0, 0.3, fiber=1.4, sugar=9.9, sodium=0),
            food("Cherries, sweet", 63, 1.1, 16.0, 0.2, fiber=2.1, sugar=13.0, sodium=0),
            food("Kiwi", 61, 1.1, 15.0, 0.5, fiber=3.0, sugar=9.0, sodium=3),
            food("Grapefruit", 42, 0.8, 11.0, 0.1, fiber=1.6, sugar=6.9, sodium=0),
            food("Lemon", 29, 1.1, 9.3, 0.3, fiber=2.8, sugar=2.5, sodium=2),
            food("Lime", 30, 0.7, 11.0, 0.2, fiber=2.8, sugar=1.7, sodium=2),
            food("Coconut, fresh meat", 354, 3.3, 15.0, 33.0, fiber=9.0, sugar=6.2, satFat=30.0, sodium=20),
            food("Dates, Medjool", 277, 1.8, 75.0, 0.2, fiber=6.7, sugar=66.0, sodium=1),
            food("Raisins", 299, 3.1, 79.0, 0.5, fiber=3.7, sugar=59.0, sodium=11),
            food("Dried apricots", 241, 3.4, 63.0, 0.5, fiber=7.3, sugar=53.0, sodium=10),
            food("Prunes / dried plums", 240, 2.2, 64.0, 0.4, fiber=7.1, sugar=38.0, sodium=2),
            food("Figs, fresh", 74, 0.8, 19.0, 0.3, fiber=2.9, sugar=16.0, sodium=1),
            food("Pomegranate", 83, 1.7, 19.0, 1.2, fiber=4.0, sugar=14.0, sodium=3),
            food("Passion fruit", 97, 2.2, 23.0, 0.7, fiber=10.4, sugar=11.0, sodium=28),
            food("Guava", 68, 2.6, 14.0, 1.0, fiber=5.4, sugar=8.9, sodium=2),
            food("Cranberries, raw", 46, 0.4, 12.0, 0.1, fiber=3.6, sugar=4.3, sodium=2),
            food("Apple sauce, unsweetened", 42, 0.2, 11.0, 0.1, fiber=1.1, sugar=9.4, sodium=2),
        ],
    },
    {
        "id": "nuts-seeds",
        "label": "Nuts & seeds",
        "foods": [
            food("Almonds", 579, 21.0, 22.0, 50.0, fiber=12.5, sugar=4.4, satFat=3.8, sodium=1),
            food("Walnuts", 654, 15.0, 14.0, 65.0, fiber=6.7, sugar=2.6, satFat=6.1, sodium=2),
            food("Cashews", 553, 18.0, 30.0, 44.0, fiber=3.3, sugar=5.9, satFat=7.8, sodium=12),
            food("Pistachios", 560, 20.0, 27.0, 45.0, fiber=10.6, sugar=7.7, satFat=5.6, sodium=1),
            food("Pecans", 691, 9.0, 14.0, 72.0, fiber=9.6, sugar=4.0, satFat=6.2, sodium=0),
            food("Hazelnuts", 628, 15.0, 17.0, 61.0, fiber=9.7, sugar=4.3, satFat=4.5, sodium=0),
            food("Macadamia nuts", 718, 7.9, 14.0, 76.0, fiber=8.6, sugar=4.6, satFat=12.0, sodium=5),
            food("Brazil nuts", 659, 14.0, 12.0, 67.0, fiber=7.5, sugar=2.3, satFat=16.0, sodium=3),
            food("Pine nuts", 673, 14.0, 13.0, 68.0, fiber=3.7, sugar=3.6, satFat=4.9, sodium=2),
            food("Peanuts, roasted unsalted", 587, 24.0, 21.0, 50.0, fiber=8.4, sugar=4.2, satFat=6.8, sodium=6),
            food("Chia seeds", 486, 17.0, 42.0, 31.0, fiber=34.0, sugar=0, satFat=3.3, sodium=16),
            food("Flaxseeds", 534, 18.0, 29.0, 42.0, fiber=27.0, sugar=1.6, satFat=3.7, sodium=30),
            food("Hemp seeds / hearts", 553, 32.0, 8.7, 49.0, fiber=4.0, sugar=1.5, satFat=4.6, sodium=5),
            food("Pumpkin seeds / pepitas", 559, 30.0, 11.0, 49.0, fiber=6.0, sugar=1.4, satFat=8.7, sodium=7),
            food("Sunflower seeds", 584, 21.0, 20.0, 51.0, fiber=8.6, sugar=2.6, satFat=4.5, sodium=9),
            food("Sesame seeds", 573, 18.0, 23.0, 50.0, fiber=12.0, sugar=0.3, satFat=7.0, sodium=11),
            food("Almond butter", 614, 21.0, 19.0, 56.0, fiber=10.0, sugar=4.4, satFat=4.2, sodium=7),
            food("Cashew butter", 587, 18.0, 27.0, 49.0, fiber=3.0, sugar=5.0, satFat=10.0, sodium=15),
            food("Tahini", 595, 17.0, 21.0, 54.0, fiber=9.0, sugar=0.5, satFat=7.5, sodium=17),
        ],
    },
    {
        "id": "oils-fats",
        "label": "Oils & fats",
        "foods": [
            food("Olive oil", 884, 0, 0, 100.0, satFat=14.0, sodium=2),
            food("Extra virgin olive oil", 884, 0, 0, 100.0, satFat=14.0, sodium=2),
            food("Avocado oil", 884, 0, 0, 100.0, satFat=12.0, sodium=0),
            food("Coconut oil", 862, 0, 0, 100.0, satFat=87.0, sodium=0),
            food("Canola oil", 884, 0, 0, 100.0, satFat=7.4, sodium=0),
            food("Sunflower oil", 884, 0, 0, 100.0, satFat=10.0, sodium=0),
            food("Sesame oil", 884, 0, 0, 100.0, satFat=14.0, sodium=0),
            food("Peanut oil", 884, 0, 0, 100.0, satFat=17.0, sodium=0),
            food("Vegetable oil (generic)", 884, 0, 0, 100.0, satFat=14.0, sodium=0),
            food("Ghee / clarified butter", 876, 0.3, 0, 99.5, satFat=62.0, sodium=2),
            food("Lard", 902, 0, 0, 100.0, satFat=39.0, sodium=0),
            food("Beef tallow", 902, 0, 0, 100.0, satFat=50.0, sodium=0),
        ],
    },
    {
        "id": "beverages",
        "label": "Beverages",
        "foods": [
            food("Water", 0, 0, 0, 0, sodium=0),
            food("Black coffee, brewed", 1, 0.1, 0, 0, sodium=2),
            food("Espresso", 9, 0.1, 1.7, 0.2, sodium=14),
            food("Tea, black, brewed", 1, 0, 0.3, 0, sodium=3),
            food("Tea, green, brewed", 1, 0, 0, 0, sodium=1),
            food("Orange juice", 45, 0.7, 10.0, 0.2, sugar=8.4, fiber=0.2, sodium=1),
            food("Apple juice", 46, 0.1, 11.0, 0.1, sugar=9.6, fiber=0.2, sodium=4),
            food("Cranberry juice, unsweetened", 46, 0.4, 12.0, 0.1, sugar=12.0, sodium=2),
            food("Coconut water", 19, 0.7, 3.7, 0.2, sugar=2.6, sodium=105),
            food("Almond milk, unsweetened", 15, 0.6, 0.3, 1.1, sugar=0, sodium=63),
            food("Oat milk, unsweetened", 40, 1.0, 6.0, 1.5, sugar=2.0, fiber=0.8, sodium=45),
            food("Soy milk, unsweetened", 33, 2.9, 1.2, 1.8, sugar=0.5, fiber=0.4, sodium=40),
        ],
    },
    {
        "id": "condiments",
        "label": "Condiments & sweeteners",
        "foods": [
            food("Honey", 304, 0.3, 82.0, 0, sugar=82.0, sodium=4),
            food("Maple syrup", 260, 0, 67.0, 0.1, sugar=60.0, sodium=12),
            food("Sugar, white", 387, 0, 100.0, 0, sugar=100.0, sodium=0),
            food("Sugar, brown", 380, 0.1, 98.0, 0, sugar=97.0, sodium=28),
            food("Molasses", 290, 0, 75.0, 0.1, sugar=55.0, sodium=37),
            food("Salt, table", 0, 0, 0, 0, sodium=38758),
            food("Vinegar, apple cider", 21, 0, 0.9, 0, sugar=0.4, sodium=5),
            food("Vinegar, balsamic", 88, 0.5, 17.0, 0, sugar=15.0, sodium=23),
            food("Soy sauce", 53, 8.1, 4.9, 0.1, sugar=0.4, sodium=5493),
            food("Mustard, yellow", 60, 3.7, 5.8, 3.3, fiber=3.3, sugar=1.5, sodium=1135),
            food("Ketchup", 112, 1.0, 27.0, 0.1, sugar=22.0, sodium=907),
            food("Mayonnaise", 680, 1.0, 0.6, 75.0, satFat=12.0, sodium=635),
            food("Tomato paste", 82, 4.3, 19.0, 0.5, fiber=4.1, sugar=12.0, sodium=59),
            food("Tomato sauce, plain", 24, 1.2, 5.3, 0.3, fiber=1.5, sugar=3.6, sodium=524),
            food("Salsa", 36, 1.5, 7.0, 0.2, fiber=1.4, sugar=3.0, sodium=430),
            food("Hot sauce", 11, 0.5, 1.8, 0.4, sugar=1.3, sodium=1412),
            food("Cocoa powder, unsweetened", 228, 20.0, 58.0, 14.0, fiber=37.0, sugar=1.8, satFat=8.0, sodium=21),
            food("Dark chocolate (70–85%)", 598, 7.8, 46.0, 43.0, fiber=11.0, sugar=24.0, satFat=24.0, sodium=20),
        ],
    },
]


def normalize_categories(categories: list[dict]) -> list[dict]:
    out = []
    seen_names: set[str] = set()
    for cat in categories:
        foods = []
        for item in cat["foods"]:
            key = item["name"].lower()
            if key in seen_names:
                raise SystemExit(f"Duplicate food name across catalog: {item['name']}")
            seen_names.add(key)
            foods.append(item)
        foods = sorted(foods, key=lambda f: f["name"].lower())
        out.append({**cat, "foods": foods, "count": len(foods)})
    return out


def main() -> None:
    categories = normalize_categories(CATEGORIES)
    CATEGORIES_DIR.mkdir(parents=True, exist_ok=True)

    # Remove old USDA category files so stale chunks cannot remain.
    for path in CATEGORIES_DIR.glob("*.json"):
        path.unlink()

    total = 0
    manifest_cats = []
    for cat in categories:
        payload = {
            "id": cat["id"],
            "label": cat["label"],
            "foods": cat["foods"],
        }
        path = CATEGORIES_DIR / f"{cat['id']}.json"
        path.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
        total += len(cat["foods"])
        manifest_cats.append(
            {"id": cat["id"], "label": cat["label"], "count": len(cat["foods"])}
        )
        print(f"  {cat['id']}: {len(cat['foods'])} foods")

    manifest = {
        "source": "Curated whole foods (USDA FoodData Central values)",
        "license": "Public domain nutrition values (USDA); curated naming",
        "portal": "https://fdc.nal.usda.gov/",
        "basis": (
            "Amounts per 100 g edible portion. Focused on whole foods with "
            "everyday names. Category JSON files are lazy-loaded."
        ),
        "total": total,
        "categories": manifest_cats,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nWrote {total} foods across {len(categories)} categories → {OUT_DIR}")


if __name__ == "__main__":
    main()
