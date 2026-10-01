#!/usr/bin/env python3
"""Compile the curated whole-foods catalog from public composition databases.

Sources (per 100 g edible portion):
  - USDA FoodData Central, SR Legacy (April 2018) and Foundation Foods (April 2026)
  - UK Composition of Foods Integrated Dataset (CoFID) 2021
  - Health Canada Canadian Nutrient File

This script expects those datasets already unpacked under /tmp/food-sources.
It writes a standalone generator, scripts/build-whole-foods-catalog.py, whose
embedded values do not need the datasets to regenerate category JSON.

Curation rules:
  - Whole foods from the source databases, plus plain staples (bread, pasta,
    milk, oil, spices). No branded products, fast food, restaurant meals,
    baby food, or candy.
  - Keep a food when it is nutritionally distinct from foods already kept.
    Drop it only when it is obviously the same food (same cut, grade, trim,
    or salt note) and the macros are not meaningfully different.
  - Curated display names below win over the automatic names for the same
    database row. Every value is a lookup; nothing is hand-typed.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import openpyxl

ROOT = Path("/tmp/food-sources")
REPO = Path(__file__).resolve().parents[1]
OUT_SCRIPT = REPO / "scripts" / "build-whole-foods-catalog.py"

CATEGORIES = [
    ("poultry", "Poultry"),
    ("beef", "Beef"),
    ("pork", "Pork"),
    ("lamb-goat-game", "Lamb, goat & game"),
    ("fish", "Fish"),
    ("shellfish", "Shellfish"),
    ("dairy-eggs", "Dairy & eggs"),
    ("grains", "Grains, bread & pasta"),
    ("legumes", "Legumes & soy"),
    ("vegetables", "Vegetables"),
    ("starches", "Potatoes & starches"),
    ("fruits", "Fruits"),
    ("nuts-seeds", "Nuts & seeds"),
    ("oils-fats", "Oils & fats"),
    ("beverages", "Beverages"),
    ("seasonings", "Sauces, seasonings & sweeteners"),
]


def S(cat: str, name: str, key: str) -> tuple:
    return (cat, name, "sr", key)


def F(cat: str, name: str, key: str) -> tuple:
    return (cat, name, "fd", key)


def C(cat: str, name: str, key: str) -> tuple:
    return (cat, name, "cofid", key)


def N(cat: str, name: str, code: int) -> tuple:
    return (cat, name, "cnf", code)


# (category, display name, source, lookup key)
# source sr/fd/cofid keys are exact descriptions. cnf keys are food codes.
SPECS: list[tuple] = [
    # --- Poultry ---
    S("poultry", "Chicken breast", "Chicken, broilers or fryers, breast, meat only, cooked, roasted"),
    S("poultry", "Chicken breast, raw", "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw"),
    S("poultry", "Chicken thigh, cooked, skinless", "Chicken, broilers or fryers, thigh, meat only, cooked, roasted"),
    S("poultry", "Chicken thigh, raw, skinless", "Chicken, broilers or fryers, dark meat, thigh, meat only, raw"),
    S("poultry", "Chicken drumstick, cooked, skinless", "Chicken, broilers or fryers, dark meat, drumstick, meat only, cooked, roasted"),
    S("poultry", "Chicken drumstick, raw, skinless", "Chicken, broilers or fryers, dark meat, drumstick, meat only, raw"),
    S("poultry", "Chicken wing, cooked, skinless", "Chicken, broilers or fryers, wing, meat only, cooked, roasted"),
    S("poultry", "Chicken wing, raw, skinless", "Chicken, broilers or fryers, wing, meat only, raw"),
    S("poultry", "Chicken, dark meat, cooked, skinless", "Chicken, broilers or fryers, dark meat, meat only, cooked, roasted"),
    S("poultry", "Chicken, light meat, cooked, skinless", "Chicken, broilers or fryers, light meat, meat only, cooked, roasted"),
    S("poultry", "Whole chicken, roasted, meat only", "Chicken, broilers or fryers, meat only, cooked, roasted"),
    S("poultry", "Whole chicken, raw, meat only", "Chicken, broilers or fryers, meat only, raw"),
    S("poultry", "Ground chicken, cooked", "Chicken, ground, crumbles, cooked, pan-browned"),
    S("poultry", "Ground chicken, raw", "Chicken, ground, raw"),
    S("poultry", "Chicken liver, cooked", "Chicken, liver, all classes, cooked, simmered"),
    S("poultry", "Rotisserie chicken breast", "Chicken, broiler, rotisserie, BBQ, breast, meat only"),
    S("poultry", "Rotisserie chicken thigh", "Chicken, broiler, rotisserie, BBQ, thigh, meat only"),
    S("poultry", "Rotisserie chicken drumstick", "Chicken, broiler, rotisserie, BBQ, drumstick, meat only"),
    S("poultry", "Turkey breast, deli", "Turkey breast, sliced, prepackaged"),
    S("poultry", "Cornish game hen, roasted, meat only", "Chicken, cornish game hens, meat only, cooked, roasted"),
    S("poultry", "Turkey breast, cooked", "Turkey, retail parts, breast, meat only, cooked, roasted"),
    S("poultry", "Turkey breast, raw", "Turkey, retail parts, breast, meat only, raw"),
    S("poultry", "Turkey thigh, cooked", "Turkey, retail parts, thigh, meat only, cooked, roasted"),
    S("poultry", "Turkey drumstick, cooked", "Turkey, retail parts, drumstick, meat only, cooked, roasted"),
    S("poultry", "Whole turkey, roasted, meat only", "Turkey, whole, meat only, cooked, roasted"),
    S("poultry", "Ground turkey, cooked (93% lean)", "Turkey, ground, 93% lean, 7% fat, pan-broiled crumbles"),
    S("poultry", "Ground turkey, raw (93% lean)", "Turkey, ground, 93% lean, 7% fat, raw"),
    S("poultry", "Ground turkey, cooked (85% lean)", "Turkey, ground, 85% lean, 15% fat, pan-broiled crumbles"),
    S("poultry", "Ground turkey, cooked, fat-free", "Turkey, ground, fat free, pan-broiled crumbles"),
    S("poultry", "Duck, roasted, meat only", "Duck, domesticated, meat only, cooked, roasted"),
    S("poultry", "Duck, raw, meat only", "Duck, domesticated, meat only, raw"),
    S("poultry", "Goose, roasted, meat only", "Goose, domesticated, meat only, cooked, roasted"),
    # --- Beef ---
    S("beef", "Beef sirloin steak, cooked", "Beef, top sirloin, steak, separable lean only, trimmed to 0\" fat, choice, cooked, broiled"),
    S("beef", "Beef sirloin steak, raw", "Beef, top sirloin, steak, separable lean only, trimmed to 1/8\" fat, choice, raw"),
    S("beef", "Beef tenderloin, cooked", "Beef, tenderloin, steak, separable lean only, trimmed to 1/8\" fat, choice, cooked, broiled"),
    S("beef", "Beef ribeye steak, cooked", "Beef, rib eye steak, boneless, lip-on, separable lean only, trimmed to 1/8\" fat, choice, cooked, grilled"),
    S("beef", "Beef flank steak, cooked", "Beef, flank, steak, separable lean only, trimmed to 0\" fat, choice, cooked, broiled"),
    S("beef", "Beef flank steak, raw", "Beef, flank, steak, separable lean only, trimmed to 0\" fat, choice, raw"),
    S("beef", "Beef skirt steak, cooked", "Beef, plate, inside skirt steak, separable lean only, trimmed to 0\" fat, all grades, cooked, broiled"),
    S("beef", "Beef brisket, cooked", "Beef, brisket, flat half, separable lean only, trimmed to 0\" fat, choice, cooked, braised"),
    S("beef", "Beef chuck roast, cooked", "Beef, chuck, arm pot roast, separable lean only, trimmed to 0\" fat, choice, cooked, braised"),
    S("beef", "Beef round roast, cooked", "Beef, round, eye of round roast, boneless, separable lean only, trimmed to 0\" fat, select, cooked, roasted"),
    S("beef", "Beef short ribs, cooked", "Beef, rib, back ribs, bone-in, separable lean only, trimmed to 0\" fat, choice, cooked, braised"),
    S("beef", "Ground beef, cooked (95% lean)", "Beef, ground, 95% lean meat / 5% fat, crumbles, cooked, pan-browned"),
    S("beef", "Ground beef, raw (95% lean)", "Beef, ground, 95% lean meat / 5% fat, raw"),
    S("beef", "Ground beef, cooked (90% lean)", "Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned"),
    S("beef", "Ground beef, raw (90% lean)", "Beef, ground, 90% lean meat / 10% fat, raw"),
    S("beef", "Ground beef, cooked (85% lean)", "Beef, ground, 85% lean meat / 15% fat, crumbles, cooked, pan-browned"),
    S("beef", "Ground beef, cooked (80% lean)", "Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned"),
    S("beef", "Beef liver, cooked", "Beef, variety meats and by-products, liver, cooked, braised"),
    S("beef", "Beef strip steak, cooked", "Beef, loin, top loin steak, boneless, lip-on, separable lean only, trimmed to 1/8\" fat, choice, cooked, grilled"),
    S("beef", "Beef strip steak, raw", "Beef, loin, top loin steak, boneless, lip-on, separable lean only, trimmed to 1/8\" fat, choice, raw"),
    S("beef", "Beef porterhouse steak, cooked", "Beef, short loin, porterhouse steak, separable lean only, trimmed to 1/8\" fat, choice, cooked, grilled"),
    S("beef", "Corned beef, cooked", "Beef, cured, corned beef, brisket, cooked"),
    # --- Pork ---
    S("pork", "Pork tenderloin, cooked", "Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted"),
    S("pork", "Pork tenderloin, raw", "Pork, fresh, loin, tenderloin, separable lean only, raw"),
    S("pork", "Pork loin chop, cooked, lean", "Pork, fresh, loin, center loin (chops), bone-in, separable lean only, cooked, broiled"),
    S("pork", "Pork loin chop, raw, lean", "Pork, fresh, loin, center loin (chops), bone-in, separable lean only, raw"),
    S("pork", "Pork shoulder, cooked", "Pork, fresh, shoulder, arm picnic, separable lean only, cooked, braised"),
    S("pork", "Pork country-style ribs, cooked", "Pork, fresh, loin, country-style ribs, separable lean only, cooked, braised"),
    S("pork", "Pork spareribs, cooked", "Pork, fresh, spareribs, separable lean and fat, cooked, braised"),
    S("pork", "Ground pork, cooked", "Pork, fresh, ground, cooked"),
    S("pork", "Ground pork, raw", "Pork, fresh, ground, raw"),
    S("pork", "Pork belly, raw", "Pork, fresh, belly, raw"),
    S("pork", "Bacon, cooked", "Pork, cured, bacon, pre-sliced, cooked, pan-fried"),
    S("pork", "Bacon, raw", "Pork, cured, bacon, unprepared"),
    S("pork", "Canadian bacon, cooked", "Canadian bacon, cooked, pan-fried"),
    S("pork", "Ham, roasted, lean", "Pork, cured, ham, whole, separable lean only, roasted"),
    S("pork", "Ham, deli, extra lean", "Ham, sliced, pre-packaged, deli meat (96%fat free, water added)"),
    # --- Lamb, goat & game ---
    S("lamb-goat-game", "Lamb leg, cooked, lean", "Lamb, leg, whole (shank and sirloin), separable lean only, trimmed to 1/4\" fat, choice, cooked, roasted"),
    S("lamb-goat-game", "Lamb loin chop, cooked", "Lamb, loin, separable lean only, trimmed to 1/4\" fat, choice, cooked, broiled"),
    S("lamb-goat-game", "Lamb shoulder, cooked", "Lamb, shoulder, whole (arm and blade), separable lean only, trimmed to 1/4\" fat, choice, cooked, roasted"),
    S("lamb-goat-game", "Lamb rack, cooked", "Lamb, rib, separable lean only, trimmed to 1/4\" fat, choice, cooked, roasted"),
    S("lamb-goat-game", "Ground lamb, cooked", "Lamb, ground, cooked, broiled"),
    S("lamb-goat-game", "Ground lamb, raw", "Lamb, ground, raw"),
    S("lamb-goat-game", "Lamb stew meat, cooked", "Lamb, cubed for stew or kabob (leg and shoulder), separable lean only, trimmed to 1/4\" fat, cooked, braised"),
    S("lamb-goat-game", "Goat, roasted", "Game meat, goat, cooked, roasted"),
    S("lamb-goat-game", "Goat, raw", "Game meat, goat, raw"),
    S("lamb-goat-game", "Venison, roasted", "Game meat, deer, cooked, roasted"),
    S("lamb-goat-game", "Venison, raw", "Game meat, deer, raw"),
    S("lamb-goat-game", "Ground venison, cooked", "Game meat, deer, ground, cooked, pan-broiled"),
    S("lamb-goat-game", "Bison, roasted", "Game meat, bison, separable lean only, cooked, roasted"),
    S("lamb-goat-game", "Bison, raw", "Game meat, bison, separable lean only, raw"),
    S("lamb-goat-game", "Ground bison, cooked", "Game meat, bison, ground, cooked, pan-broiled"),
    S("lamb-goat-game", "Rabbit, roasted", "Game meat, rabbit, domesticated, composite of cuts, cooked, roasted"),
    S("lamb-goat-game", "Veal loin, cooked", "Veal, loin, separable lean only, cooked, roasted"),
    S("lamb-goat-game", "Ground veal, cooked", "Veal, ground, cooked, broiled"),
    # --- Fish ---
    S("fish", "Salmon, Atlantic, cooked", "Fish, salmon, Atlantic, farmed, cooked, dry heat"),
    S("fish", "Salmon, Atlantic, raw", "Fish, salmon, Atlantic, farmed, raw"),
    S("fish", "Salmon, sockeye, cooked", "Fish, salmon, sockeye, cooked, dry heat"),
    S("fish", "Salmon, sockeye, raw", "Fish, salmon, sockeye, raw"),
    S("fish", "Smoked salmon", "Fish, salmon, chinook, smoked"),
    S("fish", "Tuna, yellowfin, cooked", "Fish, tuna, yellowfin, fresh, cooked, dry heat"),
    S("fish", "Tuna, yellowfin, raw", "Fish, tuna, fresh, yellowfin, raw"),
    S("fish", "Tuna, canned in water, drained", "Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)"),
    S("fish", "Tuna, canned in oil, drained", "Fish, tuna, light, canned in oil, drained solids"),
    S("fish", "Tuna, albacore, canned in water", "Fish, tuna, white, canned in water, drained solids"),
    S("fish", "Salmon, canned, drained", "Fish, Salmon, pink, canned, drained solids, without skin and bones"),
    S("fish", "Cod, cooked", "Fish, cod, Atlantic, cooked, dry heat"),
    S("fish", "Cod, raw", "Fish, cod, Atlantic, raw"),
    S("fish", "Haddock, cooked", "Fish, haddock, cooked, dry heat"),
    S("fish", "Haddock, smoked", "Fish, haddock, smoked"),
    S("fish", "Pollock, cooked", "Fish, pollock, Alaska, cooked, dry heat (may contain additives to retain moisture)"),
    S("fish", "Tilapia, cooked", "Fish, tilapia, cooked, dry heat"),
    S("fish", "Tilapia, raw", "Fish, tilapia, raw"),
    S("fish", "Halibut, cooked", "Fish, halibut, Atlantic and Pacific, cooked, dry heat"),
    S("fish", "Trout, cooked", "Fish, trout, rainbow, farmed, cooked, dry heat"),
    S("fish", "Sea bass, cooked", "Fish, sea bass, mixed species, cooked, dry heat"),
    S("fish", "Striped bass, cooked", "Fish, bass, striped, cooked, dry heat"),
    S("fish", "Snapper, cooked", "Fish, snapper, mixed species, cooked, dry heat"),
    S("fish", "Mahi-mahi, cooked", "Fish, mahimahi, cooked, dry heat"),
    S("fish", "Swordfish, cooked", "Fish, swordfish, cooked, dry heat"),
    S("fish", "Catfish, cooked", "Fish, catfish, channel, farmed, cooked, dry heat"),
    S("fish", "Sole / flounder, cooked", "Fish, flatfish (flounder and sole species), cooked, dry heat"),
    S("fish", "Perch, cooked", "Fish, perch, mixed species, cooked, dry heat"),
    S("fish", "Walleye, cooked", "Fish, pike, walleye, cooked, dry heat"),
    S("fish", "Mackerel, cooked", "Fish, mackerel, Atlantic, cooked, dry heat"),
    S("fish", "Herring, cooked", "Fish, herring, Atlantic, cooked, dry heat"),
    S("fish", "Sardines, canned in oil, drained", "Fish, sardine, Atlantic, canned in oil, drained solids with bone"),
    S("fish", "Anchovy, canned in oil, drained", "Fish, anchovy, european, canned in oil, drained solids"),
    N("fish", "Arctic char, cooked", 5838),
    # --- Shellfish ---
    S("shellfish", "Shrimp, cooked", "Crustaceans, shrimp, mixed species, cooked, moist heat (may contain additives to retain moisture)"),
    S("shellfish", "Shrimp, raw", "Crustaceans, shrimp, mixed species, raw (may contain additives to retain moisture)"),
    S("shellfish", "Crab, blue, cooked", "Crustaceans, crab, blue, cooked, moist heat"),
    S("shellfish", "Crab, Dungeness, cooked", "Crustaceans, crab, dungeness, cooked, moist heat"),
    S("shellfish", "Lobster, cooked", "Crustaceans, lobster, northern, cooked, moist heat"),
    S("shellfish", "Crayfish, cooked", "Crustaceans, crayfish, mixed species, farmed, cooked, moist heat"),
    S("shellfish", "Scallops, cooked", "Mollusks, scallop, (bay and sea), cooked, steamed"),
    S("shellfish", "Scallops, raw", "Mollusks, scallop, mixed species, raw"),
    S("shellfish", "Mussels, cooked", "Mollusks, mussel, blue, cooked, moist heat"),
    S("shellfish", "Mussels, raw", "Mollusks, mussel, blue, raw"),
    S("shellfish", "Clams, cooked", "Mollusks, clam, mixed species, cooked, moist heat"),
    S("shellfish", "Oysters, cooked", "Mollusks, oyster, eastern, wild, cooked, dry heat"),
    S("shellfish", "Squid, raw", "Mollusks, squid, mixed species, raw"),
    S("shellfish", "Octopus, cooked", "Mollusks, octopus, common, cooked, moist heat"),
    # --- Dairy & eggs ---
    S("dairy-eggs", "Whole egg", "Egg, whole, raw, fresh"),
    S("dairy-eggs", "Egg white", "Egg, white, raw, fresh"),
    S("dairy-eggs", "Egg yolk", "Egg, yolk, raw, fresh"),
    S("dairy-eggs", "Egg, hard-boiled", "Egg, whole, cooked, hard-boiled"),
    S("dairy-eggs", "Egg, scrambled", "Egg, whole, cooked, scrambled"),
    S("dairy-eggs", "Egg, fried", "Egg, whole, cooked, fried"),
    S("dairy-eggs", "Egg, poached", "Egg, whole, cooked, poached"),
    S("dairy-eggs", "Omelet, plain", "Egg, whole, cooked, omelet"),
    S("dairy-eggs", "Duck egg", "Egg, duck, whole, fresh, raw"),
    S("dairy-eggs", "Milk, whole (3.25%)", "Milk, whole, 3.25% milkfat, with added vitamin D"),
    S("dairy-eggs", "Milk, 2%", "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D"),
    S("dairy-eggs", "Milk, 1%", "Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D"),
    S("dairy-eggs", "Milk, skim / nonfat", "Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)"),
    S("dairy-eggs", "Milk, goat", "Milk, goat, fluid, with added vitamin D"),
    S("dairy-eggs", "Buttermilk, low-fat", "Milk, buttermilk, fluid, cultured, lowfat"),
    S("dairy-eggs", "Evaporated milk", "Milk, canned, evaporated, with added vitamin D and without added vitamin A"),
    S("dairy-eggs", "Sweetened condensed milk", "Milk, canned, condensed, sweetened"),
    S("dairy-eggs", "Greek yogurt, nonfat", "Yogurt, Greek, plain, nonfat (Includes foods for USDA's Food Distribution Program)"),
    S("dairy-eggs", "Greek yogurt, 2%", "Yogurt, Greek, plain, lowfat"),
    S("dairy-eggs", "Greek yogurt, whole milk", "Yogurt, Greek, plain, whole milk"),
    S("dairy-eggs", "Plain yogurt, nonfat", "Yogurt, plain, skim milk"),
    S("dairy-eggs", "Plain yogurt, low-fat", "Yogurt, plain, low fat"),
    S("dairy-eggs", "Plain yogurt, whole milk", "Yogurt, plain, whole milk"),
    N("dairy-eggs", "Kefir, plain", 6291),
    N("dairy-eggs", "Kefir, plain, low-fat", 6999),
    C("dairy-eggs", "Quark", "Cheese, Quark"),
    C("dairy-eggs", "Fromage frais, nonfat", "Fromage frais, virtually fat free, natural"),
    S("dairy-eggs", "Cottage cheese, creamed", "Cheese, cottage, creamed, large or small curd"),
    S("dairy-eggs", "Cottage cheese, low-fat (2%)", "Cheese, cottage, lowfat, 2% milkfat"),
    S("dairy-eggs", "Cottage cheese, low-fat (1%)", "Cheese, cottage, lowfat, 1% milkfat"),
    S("dairy-eggs", "Cottage cheese, nonfat", "Cheese, cottage, nonfat, uncreamed, dry, large or small curd"),
    S("dairy-eggs", "Ricotta, whole milk", "Cheese, ricotta, whole milk"),
    S("dairy-eggs", "Ricotta, part-skim", "Cheese, ricotta, part skim milk"),
    S("dairy-eggs", "Cheddar cheese", "Cheese, cheddar (Includes foods for USDA's Food Distribution Program)"),
    S("dairy-eggs", "American cheese", "Cheese, pasteurized process, American, fortified with vitamin D"),
    S("dairy-eggs", "Mozzarella, part-skim", "Cheese, mozzarella, part skim milk"),
    S("dairy-eggs", "Mozzarella, whole milk", "Cheese, mozzarella, whole milk"),
    S("dairy-eggs", "Parmesan cheese", "Cheese, parmesan, hard"),
    S("dairy-eggs", "Romano cheese", "Cheese, romano"),
    S("dairy-eggs", "Swiss cheese", "Cheese, swiss"),
    C("dairy-eggs", "Emmental cheese", "Cheese, Emmental"),
    S("dairy-eggs", "Gruyère cheese", "Cheese, gruyere"),
    S("dairy-eggs", "Gouda cheese", "Cheese, gouda"),
    S("dairy-eggs", "Provolone cheese", "Cheese, provolone"),
    S("dairy-eggs", "Colby cheese", "Cheese, colby"),
    S("dairy-eggs", "Monterey Jack cheese", "Cheese, monterey"),
    S("dairy-eggs", "Feta cheese", "Cheese, feta"),
    S("dairy-eggs", "Goat cheese, soft", "Cheese, goat, soft type"),
    S("dairy-eggs", "Brie cheese", "Cheese, brie"),
    S("dairy-eggs", "Camembert cheese", "Cheese, camembert"),
    S("dairy-eggs", "Blue cheese", "Cheese, blue"),
    C("dairy-eggs", "Stilton, blue", "Cheese, Stilton, blue"),
    C("dairy-eggs", "Halloumi", "Cheese, Halloumi"),
    C("dairy-eggs", "Paneer", "Cheese, Paneer"),
    S("dairy-eggs", "Cream cheese", "Cheese, cream"),
    S("dairy-eggs", "Neufchâtel cheese", "Cheese, neufchatel"),
    S("dairy-eggs", "Heavy cream", "Cream, fluid, heavy whipping"),
    S("dairy-eggs", "Light whipping cream", "Cream, fluid, light whipping"),
    S("dairy-eggs", "Half-and-half", "Cream, fluid, half and half"),
    S("dairy-eggs", "Sour cream", "Cream, sour, cultured"),
    C("dairy-eggs", "Crème fraîche", "Creme fraiche, full fat"),
    C("dairy-eggs", "Crème fraîche, half-fat", "Creme fraiche, half fat"),
    C("dairy-eggs", "Clotted cream", "Cream, fresh, clotted"),
    S("dairy-eggs", "Whey protein powder", "Beverages, Protein powder whey based"),
    S("dairy-eggs", "Soy protein powder", "Beverages, Protein powder soy based"),
    # --- Grains ---
    S("grains", "White rice, cooked", "Rice, white, long-grain, regular, enriched, cooked"),
    S("grains", "White rice, dry", "Rice, white, long-grain, regular, raw, enriched"),
    S("grains", "Brown rice, cooked", "Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)"),
    S("grains", "Brown rice, dry", "Rice, brown, long-grain, raw (Includes foods for USDA's Food Distribution Program)"),
    S("grains", "Parboiled rice, cooked", "Rice, white, long-grain, parboiled, enriched, cooked"),
    S("grains", "Sticky rice, cooked", "Rice, white, glutinous, unenriched, cooked"),
    S("grains", "Wild rice, cooked", "Wild rice, cooked"),
    S("grains", "Wild rice, dry", "Wild rice, raw"),
    F("grains", "Black rice, dry", "Rice, black, unenriched, raw"),
    S("grains", "Rolled oats", "Cereals, oats, regular and quick, not fortified, dry"),
    S("grains", "Oatmeal, cooked with water", "Cereals, oats, regular and quick, unenriched, cooked with water (includes boiling and microwaving), without salt"),
    S("grains", "Quinoa, cooked", "Quinoa, cooked"),
    S("grains", "Quinoa, dry", "Quinoa, uncooked"),
    S("grains", "Couscous, cooked", "Couscous, cooked"),
    S("grains", "Couscous, dry", "Couscous, dry"),
    S("grains", "Bulgur, cooked", "Bulgur, cooked"),
    S("grains", "Bulgur, dry", "Bulgur, dry"),
    S("grains", "Barley, pearled, cooked", "Barley, pearled, cooked"),
    S("grains", "Barley, pearled, dry", "Barley, pearled, raw"),
    F("grains", "Farro, dry", "Farro, pearled, dry, raw"),
    S("grains", "Millet, cooked", "Millet, cooked"),
    S("grains", "Buckwheat groats, cooked", "Buckwheat groats, roasted, cooked"),
    S("grains", "Amaranth, cooked", "Amaranth grain, cooked"),
    S("grains", "Spelt, cooked", "Spelt, cooked"),
    S("grains", "Kamut, cooked", "Wheat, KAMUT khorasan, cooked"),
    S("grains", "Teff, cooked", "Teff, cooked"),
    S("grains", "Pasta, white, cooked", "Pasta, cooked, enriched, without added salt"),
    S("grains", "Pasta, whole wheat, cooked", "Pasta, whole-wheat, cooked (Includes foods for USDA's Food Distribution Program)"),
    S("grains", "Pasta, dry", "Pasta, dry, enriched"),
    S("grains", "Pasta, whole wheat, dry", "Pasta, whole-wheat, dry (Includes foods for USDA's Food Distribution Program)"),
    S("grains", "Instant rice, prepared", "Rice, white, long-grain, precooked or instant, enriched, prepared"),
    S("grains", "Farina, cooked", "Cereals, farina, enriched, assorted brands including CREAM OF WHEAT, quick (1-3 minutes), cooked with water, without salt"),
    S("grains", "Bread crumbs, dry", "Bread, crumbs, dry, grated, plain"),
    S("grains", "Popcorn, air-popped", "Snacks, popcorn, air-popped (Unsalted)"),
    S("grains", "Egg noodles, cooked", "Noodles, egg, cooked, enriched, with added salt"),
    S("grains", "Bread, white", "Bread, white, commercially prepared (includes soft bread crumbs)"),
    S("grains", "Bread, whole wheat", "Bread, whole-wheat, commercially prepared"),
    S("grains", "Bread, sourdough", "Bread, french or vienna (includes sourdough)"),
    S("grains", "Bread, rye", "Bread, rye"),
    S("grains", "Bread, pumpernickel", "Bread, pumpernickel"),
    S("grains", "Pita bread, white", "Bread, pita, white, enriched"),
    S("grains", "Pita bread, whole wheat", "Bread, pita, whole-wheat"),
    S("grains", "Naan", "Bread, naan, plain, commercially prepared, refrigerated"),
    S("grains", "Chapati / roti", "Bread, chapati or roti, plain, commercially prepared"),
    C("grains", "Crumpet, toasted", "Crumpets, toasted"),
    C("grains", "Oatcakes, plain", "Oatcakes, plain, retail"),
    S("grains", "Tortilla, flour", "Tortillas, ready-to-bake or -fry, flour, shelf stable"),
    S("grains", "Tortilla, corn", "Tortillas, ready-to-bake or -fry, corn, without added salt"),
    S("grains", "English muffin", "English muffins, plain, enriched, without calcium propionate(includes sourdough)"),
    S("grains", "Bagel, plain", "Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)"),
    S("grains", "Hamburger bun", "Rolls, hamburger or hotdog, plain"),
    S("grains", "Cornmeal, whole grain", "Cornmeal, whole-grain, yellow"),
    S("grains", "Grits, cooked", "Cereals, corn grits, yellow, regular and quick, enriched, cooked with water, without salt"),
    S("grains", "Flour, all-purpose", "Wheat flour, white, all-purpose, enriched, bleached"),
    S("grains", "Flour, whole wheat", "Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)"),
    S("grains", "Cornstarch", "Cornstarch"),
    S("grains", "Saltines", "Crackers, saltines (includes oyster, soda, soup)"),
    S("grains", "Crackers, whole wheat", "Crackers, whole-wheat"),
    # --- Legumes ---
    S("legumes", "Black beans, cooked", "Beans, black, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Black beans, dry", "Beans, black, mature seeds, raw"),
    S("legumes", "Kidney beans, cooked", "Beans, kidney, all types, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Kidney beans, dry", "Beans, kidney, all types, mature seeds, raw"),
    S("legumes", "Pinto beans, cooked", "Beans, pinto, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Navy beans, cooked", "Beans, navy, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Cannellini beans, cooked", "Beans, white, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Chickpeas, cooked", "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt"),
    S("legumes", "Chickpeas, dry", "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw"),
    S("legumes", "Lentils, cooked", "Lentils, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Lentils, dry", "Lentils, raw"),
    S("legumes", "Black-eyed peas, cooked", "Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, without salt"),
    S("legumes", "Split peas, cooked", "Peas, split, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Lima beans, cooked", "Lima beans, large, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Fava beans, cooked", "Broadbeans (fava beans), mature seeds, cooked, boiled, without salt"),
    S("legumes", "Adzuki beans, cooked", "Beans, adzuki, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Mung beans, cooked", "Mung beans, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Edamame, cooked", "Edamame, frozen, prepared"),
    S("legumes", "Soybeans, cooked", "Soybeans, mature cooked, boiled, without salt"),
    S("legumes", "Tofu, firm", "Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)"),
    S("legumes", "Tofu, soft / silken", "Tofu, soft, prepared with calcium sulfate and magnesium chloride (nigari)"),
    S("legumes", "Tempeh", "Tempeh"),
    S("legumes", "Hummus", "Hummus, commercial"),
    S("legumes", "Baked beans, vegetarian", "Beans, baked, canned, plain or vegetarian"),
    S("legumes", "Refried beans", "Refried beans, canned, traditional style"),
    S("legumes", "Miso", "Miso"),
    # --- Vegetables ---
    S("vegetables", "Broccoli, raw", "Broccoli, raw"),
    S("vegetables", "Broccoli, cooked", "Broccoli, cooked, boiled, drained, without salt"),
    S("vegetables", "Broccoli rabe, raw", "Broccoli raab, raw"),
    S("vegetables", "Spinach, raw", "Spinach, raw"),
    S("vegetables", "Spinach, cooked", "Spinach, cooked, boiled, drained, without salt"),
    S("vegetables", "Kale, raw", "Kale, raw"),
    S("vegetables", "Kale, cooked", "Kale, cooked, boiled, drained, without salt"),
    S("vegetables", "Lettuce, romaine", "Lettuce, cos or romaine, raw"),
    S("vegetables", "Lettuce, iceberg", "Lettuce, iceberg (includes crisphead types), raw"),
    S("vegetables", "Lettuce, green leaf", "Lettuce, green leaf, raw"),
    S("vegetables", "Endive", "Endive, raw"),
    S("vegetables", "Radicchio", "Radicchio, raw"),
    S("vegetables", "Arugula", "Arugula, raw"),
    S("vegetables", "Cabbage, green, raw", "Cabbage, raw"),
    S("vegetables", "Cabbage, cooked", "Cabbage, cooked, boiled, drained, without salt"),
    S("vegetables", "Cabbage, savoy, raw", "Cabbage, savoy, raw"),
    S("vegetables", "Cabbage, red, raw", "Cabbage, red, raw"),
    S("vegetables", "Napa cabbage, raw", "Cabbage, chinese (pe-tsai), raw"),
    S("vegetables", "Bok choy, cooked", "Cabbage, chinese (pak-choi), cooked, boiled, drained, without salt"),
    S("vegetables", "Cauliflower, raw", "Cauliflower, raw"),
    S("vegetables", "Cauliflower, cooked", "Cauliflower, cooked, boiled, drained, without salt"),
    S("vegetables", "Brussels sprouts, raw", "Brussels sprouts, raw"),
    S("vegetables", "Brussels sprouts, cooked", "Brussels sprouts, cooked, boiled, drained, without salt"),
    S("vegetables", "Asparagus, raw", "Asparagus, raw"),
    S("vegetables", "Asparagus, cooked", "Asparagus, cooked, boiled, drained"),
    S("vegetables", "Green beans, raw", "Beans, snap, green, raw"),
    S("vegetables", "Green beans, cooked", "Beans, snap, green, cooked, boiled, drained, without salt"),
    S("vegetables", "Peas, green, raw", "Peas, green, raw"),
    S("vegetables", "Peas, green, cooked", "Peas, green, cooked, boiled, drained, without salt"),
    S("vegetables", "Snow peas, raw", "Peas, edible-podded, raw"),
    S("vegetables", "Snow peas, cooked", "Peas, edible-podded, boiled, drained, without salt"),
    S("vegetables", "Bean sprouts", "Mung beans, mature seeds, sprouted, raw"),
    S("vegetables", "Carrot, raw", "Carrots, raw"),
    S("vegetables", "Carrot, cooked", "Carrots, cooked, boiled, drained, without salt"),
    S("vegetables", "Bell pepper, red, raw", "Peppers, sweet, red, raw"),
    S("vegetables", "Bell pepper, green, raw", "Peppers, sweet, green, raw"),
    S("vegetables", "Bell pepper, yellow, raw", "Peppers, sweet, yellow, raw"),
    S("vegetables", "Jalapeño, raw", "Peppers, jalapeno, raw"),
    S("vegetables", "Tomato, raw", "Tomatoes, red, ripe, raw, year round average"),
    S("vegetables", "Tomatoes, canned, no salt", "Tomatoes, red, ripe, canned, packed in tomato juice, no salt added"),
    S("vegetables", "Cucumber, raw", "Cucumber, with peel, raw"),
    S("vegetables", "Zucchini, raw", "Squash, summer, zucchini, includes skin, raw"),
    S("vegetables", "Zucchini, cooked", "Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt"),
    S("vegetables", "Yellow squash, raw", "Squash, summer, crookneck and straightneck, raw"),
    S("vegetables", "Eggplant, cooked", "Eggplant, cooked, boiled, drained, without salt"),
    S("vegetables", "Onion, raw", "Onions, raw"),
    S("vegetables", "Onion, cooked", "Onions, cooked, boiled, drained, without salt"),
    S("vegetables", "Scallions", "Onions, spring or scallions (includes tops and bulb), raw"),
    S("vegetables", "Shallot, raw", "Shallots, raw"),
    S("vegetables", "Leek, raw", "Leeks, (bulb and lower leaf-portion), raw"),
    S("vegetables", "Fennel, raw", "Fennel, bulb, raw"),
    S("vegetables", "Garlic, raw", "Garlic, raw"),
    S("vegetables", "Ginger root, raw", "Ginger root, raw"),
    S("vegetables", "Beet, raw", "Beets, raw"),
    S("vegetables", "Beet, cooked", "Beets, cooked, boiled, drained"),
    S("vegetables", "Celery, raw", "Celery, raw"),
    S("vegetables", "Mushroom, white, raw", "Mushrooms, white, raw"),
    S("vegetables", "Mushroom, white, cooked", "Mushrooms, white, cooked, boiled, drained, without salt"),
    S("vegetables", "Mushroom, cremini, raw", "Mushrooms, brown, italian, or crimini, raw"),
    S("vegetables", "Mushroom, shiitake, raw", "Mushrooms, shiitake, raw"),
    S("vegetables", "Mushroom, shiitake, cooked", "Mushrooms, shiitake, cooked, without salt"),
    S("vegetables", "Mushroom, portabella, raw", "Mushrooms, portabella, raw"),
    S("vegetables", "Radish, raw", "Radishes, raw"),
    N("vegetables", "Daikon, raw", 2196),
    N("vegetables", "Daikon, cooked", 2197),
    S("vegetables", "Turnip, cooked", "Turnips, cooked, boiled, drained, without salt"),
    S("vegetables", "Artichoke, cooked", "Artichokes, (globe or french), cooked, boiled, drained, without salt"),
    S("vegetables", "Okra, cooked", "Okra, cooked, boiled, drained, without salt"),
    S("vegetables", "Collard greens, cooked", "Collards, cooked, boiled, drained, without salt"),
    S("vegetables", "Swiss chard, cooked", "Chard, swiss, cooked, boiled, drained, without salt"),
    S("vegetables", "Beet greens, cooked", "Beet greens, cooked, boiled, drained, without salt"),
    S("vegetables", "Pumpkin, cooked", "Pumpkin, cooked, boiled, drained, without salt"),
    S("vegetables", "Butternut squash, cooked", "Squash, winter, butternut, cooked, baked, without salt"),
    S("vegetables", "Acorn squash, cooked", "Squash, winter, acorn, cooked, baked, without salt"),
    S("vegetables", "Spaghetti squash, cooked", "Squash, winter, spaghetti, cooked, boiled, drained, or baked, without salt"),
    S("vegetables", "Avocado", "Avocados, raw, all commercial varieties"),
    S("vegetables", "Olives, green", "Olives, pickled, canned or bottled, green"),
    S("vegetables", "Olives, black", "Olives, ripe, canned (small-extra large)"),
    S("vegetables", "Kimchi", "Cabbage, kimchi"),
    S("vegetables", "Sauerkraut", "Sauerkraut, canned, solids and liquids"),
    S("vegetables", "Dill pickle", "Pickles, cucumber, dill or kosher dill"),
    C("vegetables", "Nori, dried", "Seaweed, nori, dried, raw"),
    S("vegetables", "Wakame, raw", "Seaweed, wakame, raw"),
    S("vegetables", "Bamboo shoots, canned", "Bamboo shoots, canned, drained solids"),
    S("vegetables", "Water chestnuts, canned", "Waterchestnuts, chinese, canned, solids and liquids"),
    S("vegetables", "Kohlrabi, raw", "Kohlrabi, raw"),
    # --- Potatoes & starches ---
    S("starches", "Potato, baked, flesh and skin", "Potatoes, white, flesh and skin, baked"),
    S("starches", "Potato, boiled", "Potatoes, boiled, cooked without skin, flesh, without salt"),
    S("starches", "Potato, raw", "Potatoes, flesh and skin, raw"),
    S("starches", "Sweet potato, baked", "Sweet potato, cooked, baked in skin, flesh, without salt"),
    S("starches", "Sweet potato, boiled", "Sweet potato, cooked, boiled, without skin"),
    S("starches", "Sweet potato, raw", "Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)"),
    S("starches", "Yam, cooked", "Yam, cooked, boiled, drained, or baked, without salt"),
    S("starches", "Plantain, green, raw", "Plantains, green, raw"),
    S("starches", "Plantain, green, boiled", "Plantains, green, boiled"),
    S("starches", "Plantain, ripe, raw", "Plantains, yellow, raw"),
    S("starches", "Cassava, raw", "Cassava, raw"),
    C("starches", "Cassava, boiled", "Cassava, boiled in unsalted water"),
    S("starches", "Taro, cooked", "Taro, cooked, without salt"),
    S("starches", "Corn, sweet, cooked", "Corn, sweet, yellow, cooked, boiled, drained, without salt"),
    S("starches", "Corn, sweet, raw", "Corn, sweet, yellow, raw"),
    S("starches", "Parsnip, raw", "Parsnips, raw"),
    S("starches", "Rutabaga, cooked", "Rutabagas, cooked, boiled, drained, without salt"),
    S("starches", "Jicama, raw", "Yambean (jicama), raw"),
    # --- Fruits ---
    S("fruits", "Banana", "Bananas, raw"),
    S("fruits", "Apple", "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)"),
    S("fruits", "Orange", "Oranges, raw, all commercial varieties"),
    S("fruits", "Tangerine / mandarin", "Tangerines, (mandarin oranges), raw"),
    S("fruits", "Clementine", "Clementines, raw"),
    S("fruits", "Strawberries", "Strawberries, raw"),
    S("fruits", "Blueberries", "Blueberries, raw"),
    S("fruits", "Raspberries", "Raspberries, raw"),
    S("fruits", "Blackberries", "Blackberries, raw"),
    S("fruits", "Grapes", "Grapes, red or green (European type, such as Thompson seedless), raw"),
    S("fruits", "Watermelon", "Watermelon, raw"),
    S("fruits", "Cantaloupe", "Melons, cantaloupe, raw"),
    S("fruits", "Honeydew melon", "Melons, honeydew, raw"),
    S("fruits", "Pineapple", "Pineapple, raw, all varieties"),
    S("fruits", "Pineapple, canned in juice, drained", "Pineapple, canned, juice pack, drained"),
    S("fruits", "Mango", "Mangos, raw"),
    S("fruits", "Papaya", "Papayas, raw"),
    S("fruits", "Peach", "Peaches, yellow, raw"),
    S("fruits", "Peaches, canned in juice", "Peaches, canned, juice pack, solids and liquids"),
    S("fruits", "Nectarine", "Nectarines, raw"),
    S("fruits", "Pear", "Pears, raw"),
    S("fruits", "Plum", "Plums, raw"),
    S("fruits", "Apricot", "Apricots, raw"),
    S("fruits", "Cherries, sweet", "Cherries, sweet, raw"),
    S("fruits", "Cherries, sour", "Cherries, sour, red, raw"),
    S("fruits", "Kiwi", "Kiwifruit, green, raw"),
    S("fruits", "Grapefruit", "Grapefruit, raw, pink and red, all areas"),
    S("fruits", "Lemon", "Lemons, raw, without peel"),
    S("fruits", "Lime", "Limes, raw"),
    S("fruits", "Coconut, fresh meat", "Nuts, coconut meat, raw"),
    S("fruits", "Coconut, dried, unsweetened", "Nuts, coconut meat, dried (desiccated), not sweetened"),
    S("fruits", "Dates, Medjool", "Dates, medjool"),
    S("fruits", "Raisins", "Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)"),
    S("fruits", "Dried currants", "Currants, zante, dried"),
    S("fruits", "Dried apricots", "Apricots, dried, sulfured, uncooked"),
    S("fruits", "Prunes / dried plums", "Plums, dried (prunes), uncooked"),
    S("fruits", "Figs, fresh", "Figs, raw"),
    S("fruits", "Figs, dried", "Figs, dried, uncooked"),
    S("fruits", "Pomegranate", "Pomegranates, raw"),
    S("fruits", "Passion fruit", "Passion-fruit, (granadilla), purple, raw"),
    S("fruits", "Guava", "Guavas, common, raw"),
    S("fruits", "Lychee", "Litchis, raw"),
    S("fruits", "Persimmon", "Persimmons, japanese, raw"),
    S("fruits", "Rhubarb, raw", "Rhubarb, raw"),
    S("fruits", "Cranberries, raw", "Cranberries, raw"),
    S("fruits", "Apple sauce, unsweetened", "Applesauce, canned, unsweetened, without added ascorbic acid (Includes foods for USDA's Food Distribution Program)"),
    # --- Nuts & seeds ---
    S("nuts-seeds", "Almonds", "Nuts, almonds"),
    S("nuts-seeds", "Almonds, dry roasted, unsalted", "Nuts, almonds, dry roasted, without salt added"),
    S("nuts-seeds", "Walnuts", "Nuts, walnuts, english"),
    S("nuts-seeds", "Cashews", "Nuts, cashew nuts, raw"),
    S("nuts-seeds", "Pistachios", "Nuts, pistachio nuts, raw"),
    S("nuts-seeds", "Pecans", "Nuts, pecans"),
    S("nuts-seeds", "Hazelnuts", "Nuts, hazelnuts or filberts"),
    S("nuts-seeds", "Macadamia nuts", "Nuts, macadamia nuts, raw"),
    S("nuts-seeds", "Brazil nuts", "Nuts, brazilnuts, dried, unblanched"),
    S("nuts-seeds", "Pine nuts", "Nuts, pine nuts, dried"),
    S("nuts-seeds", "Peanuts, raw", "Peanuts, all types, raw"),
    S("nuts-seeds", "Peanuts, roasted unsalted", "Peanuts, all types, dry-roasted, without salt"),
    S("nuts-seeds", "Peanut butter, natural", "Peanut butter, smooth style, without salt"),
    S("nuts-seeds", "Almond butter", "Nuts, almond butter, plain, without salt added"),
    S("nuts-seeds", "Cashew butter", "Nuts, cashew butter, plain, without salt added"),
    S("nuts-seeds", "Chia seeds", "Seeds, chia seeds, dried"),
    S("nuts-seeds", "Flaxseeds", "Seeds, flaxseed"),
    S("nuts-seeds", "Hemp seeds", "Seeds, hemp seed, hulled"),
    S("nuts-seeds", "Pumpkin seeds", "Seeds, pumpkin and squash seed kernels, dried"),
    S("nuts-seeds", "Sunflower seeds", "Seeds, sunflower seed kernels, dried"),
    S("nuts-seeds", "Sunflower seeds, roasted unsalted", "Seeds, sunflower seed kernels, dry roasted, without salt"),
    S("nuts-seeds", "Sesame seeds", "Seeds, sesame seeds, whole, dried"),
    S("nuts-seeds", "Tahini", "Seeds, sesame butter, tahini, from roasted and toasted kernels (most common type)"),
    # --- Oils & fats ---
    S("oils-fats", "Olive oil", "Oil, olive, salad or cooking"),
    S("oils-fats", "Avocado oil", "Oil, avocado"),
    S("oils-fats", "Coconut oil", "Oil, coconut"),
    S("oils-fats", "Canola oil", "Oil, canola"),
    S("oils-fats", "Sunflower oil", "Oil, sunflower, linoleic, (approx. 65%)"),
    S("oils-fats", "Safflower oil", "Oil, safflower, salad or cooking, high oleic (primary safflower oil of commerce)"),
    S("oils-fats", "Sesame oil", "Oil, sesame, salad or cooking"),
    S("oils-fats", "Peanut oil", "Oil, peanut, salad or cooking"),
    S("oils-fats", "Corn oil", "Oil, corn, industrial and retail, all purpose salad or cooking"),
    S("oils-fats", "Grapeseed oil", "Oil, grapeseed"),
    S("oils-fats", "Flaxseed oil", "Oil, flaxseed, cold pressed"),
    S("oils-fats", "Walnut oil", "Oil, walnut"),
    S("oils-fats", "Soybean / vegetable oil", "Oil, soybean, salad or cooking"),
    S("oils-fats", "Butter, unsalted", "Butter, without salt"),
    S("oils-fats", "Butter, salted", "Butter, salted"),
    S("oils-fats", "Ghee", "Butter, Clarified butter (ghee)"),
    S("oils-fats", "Lard", "Lard"),
    S("oils-fats", "Beef tallow", "Fat, beef tallow"),
    # --- Beverages ---
    S("beverages", "Water", "Beverages, water, tap, municipal"),
    S("beverages", "Black coffee, brewed", "Beverages, coffee, brewed, prepared with tap water"),
    S("beverages", "Coffee, decaf, brewed", "Beverages, coffee, brewed, prepared with tap water, decaffeinated"),
    S("beverages", "Espresso", "Beverages, coffee, brewed, espresso, restaurant-prepared"),
    S("beverages", "Tea, black, brewed", "Beverages, tea, black, brewed, prepared with tap water"),
    S("beverages", "Tea, green, brewed", "Beverages, tea, green, brewed, regular"),
    S("beverages", "Tea, herbal, brewed", "Beverages, tea, herb, other than chamomile, brewed"),
    S("beverages", "Orange juice", "Orange juice, raw (Includes foods for USDA's Food Distribution Program)"),
    S("beverages", "Apple juice", "Apple juice, canned or bottled, unsweetened, without added ascorbic acid"),
    S("beverages", "Grapefruit juice", "Grapefruit juice, white, canned or bottled, unsweetened"),
    S("beverages", "Grape juice", "Grape juice, canned or bottled, unsweetened, without added ascorbic acid"),
    S("beverages", "Cranberry juice, unsweetened", "Cranberry juice, unsweetened"),
    S("beverages", "Tomato juice", "Tomato juice, canned, without salt added"),
    S("beverages", "Coconut water", "Nuts, coconut water (liquid from coconuts)"),
    S("beverages", "Coconut milk, canned", "Nuts, coconut milk, canned (liquid expressed from grated meat and water)"),
    S("beverages", "Almond milk, unsweetened", "Beverages, almond milk, unsweetened, shelf stable"),
    F("beverages", "Oat milk, unsweetened", "Oat milk, unsweetened, plain, refrigerated"),
    F("beverages", "Soy milk, unsweetened", "Soy milk, unsweetened, plain, shelf stable"),
    S("beverages", "Rice milk, unsweetened", "Beverages, rice milk, unsweetened"),
    S("beverages", "Chicken broth", "Soup, chicken broth, ready-to-serve"),
    S("beverages", "Beef broth", "Soup, beef broth or bouillon canned, ready-to-serve"),
    S("beverages", "Vegetable broth", "Soup, vegetable broth, ready to serve"),
    S("beverages", "Club soda", "Beverages, carbonated, club soda"),
    S("beverages", "Lemon juice", "Lemon juice, raw"),
    S("beverages", "Lime juice", "Lime juice, raw"),
    # --- Seasonings ---
    S("seasonings", "Salt, table", "Salt, table"),
    S("seasonings", "Black pepper", "Spices, pepper, black"),
    S("seasonings", "Paprika", "Spices, paprika"),
    S("seasonings", "Cayenne pepper", "Spices, pepper, red or cayenne"),
    S("seasonings", "Chili powder", "Spices, chili powder"),
    S("seasonings", "Cumin seed", "Spices, cumin seed"),
    S("seasonings", "Coriander seed", "Spices, coriander seed"),
    S("seasonings", "Cinnamon", "Spices, cinnamon, ground"),
    S("seasonings", "Turmeric", "Spices, turmeric, ground"),
    S("seasonings", "Oregano, dried", "Spices, oregano, dried"),
    S("seasonings", "Basil, dried", "Spices, basil, dried"),
    S("seasonings", "Basil, fresh", "Basil, fresh"),
    S("seasonings", "Parsley, fresh", "Parsley, fresh"),
    S("seasonings", "Cilantro, fresh", "Coriander (cilantro) leaves, raw"),
    S("seasonings", "Rosemary, dried", "Spices, rosemary, dried"),
    S("seasonings", "Thyme, dried", "Spices, thyme, dried"),
    S("seasonings", "Dill, dried", "Spices, dill weed, dried"),
    S("seasonings", "Nutmeg", "Spices, nutmeg, ground"),
    S("seasonings", "Garlic powder", "Spices, garlic powder"),
    S("seasonings", "Onion powder", "Spices, onion powder"),
    S("seasonings", "Ginger, ground", "Spices, ginger, ground"),
    S("seasonings", "Vanilla extract", "Vanilla extract"),
    S("seasonings", "Honey", "Honey"),
    S("seasonings", "Maple syrup", "Syrups, maple"),
    S("seasonings", "Agave syrup", "Sweetener, syrup, agave"),
    S("seasonings", "Sugar, white", "Sugars, granulated"),
    S("seasonings", "Sugar, brown", "Sugars, brown"),
    S("seasonings", "Sugar, powdered", "Sugars, powdered"),
    S("seasonings", "Molasses", "Molasses"),
    C("seasonings", "Black treacle", "Treacle, black"),
    S("seasonings", "Vinegar, apple cider", "Vinegar, cider"),
    S("seasonings", "Vinegar, balsamic", "Vinegar, balsamic"),
    S("seasonings", "Vinegar, distilled", "Vinegar, distilled"),
    S("seasonings", "Vinegar, red wine", "Vinegar, red wine"),
    S("seasonings", "Soy sauce", "Soy sauce made from soy and wheat (shoyu)"),
    S("seasonings", "Tamari", "Soy sauce made from soy (tamari)"),
    S("seasonings", "Fish sauce", "Sauce, fish, ready-to-serve"),
    S("seasonings", "Mustard, yellow", "Mustard, prepared, yellow"),
    S("seasonings", "Ketchup", "Catsup"),
    S("seasonings", "Mayonnaise", "Salad dressing, mayonnaise, regular"),
    S("seasonings", "Hot sauce, sriracha", "Sauce, hot chile, sriracha"),
    S("seasonings", "Worcestershire sauce", "Sauce, worcestershire"),
    S("seasonings", "Tomato paste", "Tomato products, canned, paste, without salt added (Includes foods for USDA's Food Distribution Program)"),
    S("seasonings", "Tomato sauce, plain", "Tomato sauce, canned, no salt added"),
    S("seasonings", "Marinara sauce", "Sauce, pasta, spaghetti/marinara, ready-to-serve"),
    S("seasonings", "Salsa", "Sauce, salsa, ready-to-serve"),
    S("seasonings", "Pesto", "Sauce, pesto, ready-to-serve, shelf stable"),
    S("seasonings", "Teriyaki sauce", "Sauce, teriyaki, ready-to-serve"),
    S("seasonings", "Hoisin sauce", "Sauce, hoisin, ready-to-serve"),
    S("seasonings", "Cocoa powder, unsweetened", "Cocoa, dry powder, unsweetened"),
    S("seasonings", "Dark chocolate (70–85%)", "Chocolate, dark, 70-85% cacao solids"),
    C("seasonings", "Yeast extract", "Yeast extract"),
    S("seasonings", "Oyster sauce", "Sauce, oyster, ready-to-serve"),
    S("seasonings", "Horseradish", "Horseradish, prepared"),
    S("seasonings", "Bay leaf", "Spices, bay leaf"),
    S("seasonings", "Cloves", "Spices, cloves, ground"),
    S("seasonings", "Cardamom", "Spices, cardamom"),
    S("seasonings", "Sage, dried", "Spices, sage, ground"),
    S("seasonings", "Mint, fresh", "Spearmint, fresh"),
    # Everyday Asian names. The automatic pass still adds other whole foods
    # from the same rows' source databases; these names are the ones people search.
    S("legumes", "Mung beans, dry", "Mung beans, mature seeds, raw"),
    C("legumes", "Mung dal, cooked", "Beans, mung, dahl, dried, boiled in unsalted water"),
    C("legumes", "Urad beans (black gram), cooked", "Black gram, urad gram, whole, dried, boiled in unsalted water"),
    C("legumes", "Urad dal, cooked", "Black gram, duhli urad dahl, split, dried, boiled in unsalted water"),
    S("legumes", "Winged beans, mature, cooked", "Winged beans, mature seeds, cooked, boiled, without salt"),
    S("legumes", "Winged beans, mature, dry", "Winged beans, mature seeds, raw"),
    S("legumes", "Pigeon peas, cooked", "Pigeon peas (red gram), mature seeds, cooked, boiled, without salt"),
    S("legumes", "Adzuki beans, dry", "Beans, adzuki, mature seeds, raw"),
    S("legumes", "Soybeans, dry", "Soybeans, mature seeds, raw"),
    S("legumes", "Natto", "Natto"),
    S("legumes", "Tofu, fried", "Tofu, fried"),
    S("vegetables", "Winged beans (sigarilyas), cooked", "Winged beans, immature seeds, cooked, boiled, drained, without salt"),
    S("vegetables", "Winged beans (sigarilyas), raw", "Winged beans, immature seeds, raw"),
    S("vegetables", "Mung bean sprouts, cooked", "Mung beans, mature seeds, sprouted, cooked, boiled, drained, without salt"),
    S("vegetables", "Yardlong beans, cooked", "Yardlong bean, cooked, boiled, drained, without salt"),
    S("vegetables", "Bitter melon, cooked", "Balsam-pear (bitter gourd), pods, cooked, boiled, drained, without salt"),
    S("vegetables", "Bitter melon, raw", "Balsam-pear (bitter gourd), pods, raw"),
    S("vegetables", "Chayote, cooked", "Chayote, fruit, cooked, boiled, drained, without salt"),
    S("vegetables", "Lotus root, cooked", "Lotus root, cooked, boiled, drained, without salt"),
    S("vegetables", "Lotus root, raw", "Lotus root, raw"),
    S("vegetables", "Water spinach (kangkong), cooked", "Water convolvulus, cooked, boiled, drained, without salt"),
    S("vegetables", "Mustard greens, cooked", "Mustard greens, cooked, boiled, drained, without salt"),
    S("vegetables", "Bok choy, raw", "Cabbage, chinese (pak-choi), raw"),
    S("vegetables", "Enoki mushrooms", "Mushrooms, enoki, raw"),
    S("vegetables", "Oyster mushrooms", "Mushrooms, oyster, raw"),
    S("vegetables", "Maitake mushrooms", "Mushrooms, maitake, raw"),
    S("vegetables", "Wood ear mushrooms, dried", "Fungi, Cloud ears, dried"),
    S("vegetables", "Lemongrass", "Lemon grass (citronella), raw"),
    S("vegetables", "Chives", "Chives, raw"),
    S("vegetables", "Watercress", "Watercress, raw"),
    S("vegetables", "Amaranth leaves, cooked", "Amaranth leaves, cooked, boiled, drained, without salt"),
    S("vegetables", "Garland chrysanthemum, cooked", "Chrysanthemum, garland, cooked, boiled, drained, without salt"),
    S("vegetables", "Malabar spinach, cooked", "Malabar spinach, cooked"),
    S("vegetables", "Bamboo shoots, cooked", "Bamboo shoots, cooked, boiled, drained, without salt"),
    S("vegetables", "Kelp, raw", "Seaweed, kelp, raw"),
    S("vegetables", "Agar, dried", "Seaweed, agar, dried"),
    C("vegetables", "Kombu, dried", "Seaweed, kombu, dried, raw"),
    C("vegetables", "Curry leaves", "Curry leaves, fresh"),
    C("vegetables", "Fenugreek leaves", "Fenugreek leaves, raw"),
    S("starches", "Breadfruit", "Breadfruit, raw"),
    S("fruits", "Pomelo", "Pummelo, raw"),
    S("fruits", "Durian", "Durian, raw or frozen"),
    S("fruits", "Jackfruit", "Jackfruit, raw"),
    S("fruits", "Longan", "Longans, raw"),
    S("fruits", "Longan, dried", "Longans, dried"),
    S("fruits", "Starfruit", "Carambola, (starfruit), raw"),
    S("fruits", "Jujube", "Jujube, raw"),
    S("fruits", "Tamarind", "Tamarinds, raw"),
    C("fruits", "Rambutan", "Rambutan, flesh only"),
    C("fruits", "Mangosteen", "Mangosteen, flesh only"),
    S("grains", "Cellophane noodles (mung bean), dry", "Noodles, chinese, cellophane or long rice (mung beans), dehydrated"),
    S("grains", "Rice noodles, cooked", "Rice noodles, cooked"),
    S("grains", "Rice noodles, dry", "Rice noodles, dry"),
    S("grains", "Soba noodles, cooked", "Noodles, japanese, soba, cooked"),
    S("grains", "Soba noodles, dry", "Noodles, japanese, soba, dry"),
    S("grains", "Somen noodles, cooked", "Noodles, japanese, somen, cooked"),
    S("grains", "Short-grain rice, cooked", "Rice, white, short-grain, enriched, cooked"),
    S("grains", "Rice flour", "Rice flour, white, unenriched"),
    S("grains", "Wonton wrappers", "Wonton wrappers (includes egg roll wrappers)"),
    S("fish", "Eel, cooked", "Fish, eel, mixed species, cooked, dry heat"),
    S("fish", "Yellowtail, cooked", "Fish, yellowtail, mixed species, cooked, dry heat"),
    S("fish", "Milkfish, cooked", "Fish, milkfish, cooked, dry heat"),
    S("dairy-eggs", "Quail egg", "Egg, quail, whole, fresh, raw"),
    S("nuts-seeds", "Coconut cream", "Nuts, coconut cream, raw (liquid expressed from grated meat)"),
    S("nuts-seeds", "Chestnuts, roasted", "Nuts, chestnuts, european, roasted"),
    S("oils-fats", "Rice bran oil", "Oil, rice bran"),
    S("oils-fats", "Palm oil", "Oil, palm"),
    S("seasonings", "Curry powder", "Spices, curry powder"),
    S("seasonings", "White pepper", "Spices, pepper, white"),
    S("seasonings", "Fenugreek seed", "Spices, fenugreek seed"),
    S("seasonings", "Fennel seed", "Spices, fennel seed"),
    S("shellfish", "Squid, fried", "Mollusks, squid, mixed species, cooked, fried"),
]


def round_half_up(value: float, places: int) -> float:
    quantum = Decimal("1") if places == 0 else Decimal("0.1")
    # format() avoids binary float artifacts like 3.5700000000000003
    rendered = format(value, "f")
    rounded = Decimal(rendered).quantize(quantum, rounding=ROUND_HALF_UP)
    return float(rounded)


def as_num(value: float, places: int) -> int | float:
    rounded = round_half_up(value, places)
    if rounded == int(rounded):
        return int(rounded)
    return rounded


def load_usda(path: Path, data_type: str) -> list[dict]:
    foods = {}
    folder = path
    import csv

    with (folder / "food.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            if row["data_type"] == data_type:
                foods[row["fdc_id"]] = {
                    "fdc_id": int(row["fdc_id"]),
                    "description": row["description"],
                    "category_id": row.get("food_category_id") or "",
                    "n": {},
                }
    wanted = {"1003", "1004", "1005", "1008", "1079", "1093", "1258", "2000", "1063", "2047", "2048", "2033", "2039", "1050", "2044"}
    with (folder / "food_nutrient.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            food = foods.get(row["fdc_id"])
            if not food or row["nutrient_id"] not in wanted or row["amount"] == "":
                continue
            food["n"][row["nutrient_id"]] = float(row["amount"])

    def pick(nutrients: dict, *ids: str):
        for nutrient_id in ids:
            if nutrient_id in nutrients:
                return nutrients[nutrient_id]
        return None

    compiled = []
    for food in foods.values():
        kcal = pick(food["n"], "1008", "2047", "2048")
        if kcal is None:
            continue
        compiled.append(
            {
                "fdc_id": food["fdc_id"],
                "description": food["description"],
                "category_id": food.get("category_id") or "",
                "kcal": kcal,
                "protein": pick(food["n"], "1003"),
                "fat": pick(food["n"], "1004", "2044"),
                "carbs": pick(food["n"], "1005", "2039", "1050"),
                "fiber": pick(food["n"], "1079", "2033"),
                "sugar": pick(food["n"], "2000", "1063"),
                "sat": pick(food["n"], "1258"),
                "sodium": pick(food["n"], "1093"),
            }
        )
    return compiled


def parse_cofid_number(value):
    if value is None or value == "" or value == "N":
        return None
    if value == "Tr":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def load_cofid(path: Path) -> dict[str, dict]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    proximates = {}
    for row in wb["1.3 Proximates"].iter_rows(min_row=4, values_only=True):
        if not row or not row[0] or not row[1]:
            continue
        proximates[row[1]] = {
            "code": str(row[0]),
            "group": str(row[3] or ""),
            "kcal": parse_cofid_number(row[12]),
            "protein": parse_cofid_number(row[9]),
            "fat": parse_cofid_number(row[10]),
            "carbs": parse_cofid_number(row[11]),
            "sugar": parse_cofid_number(row[16]),
            "fiber": parse_cofid_number(row[25]),
            "sat": parse_cofid_number(row[27]),
            "sodium": None,
        }
    for row in wb["1.4 Inorganics"].iter_rows(min_row=4, values_only=True):
        if not row or not row[1] or row[1] not in proximates:
            continue
        proximates[row[1]]["sodium"] = parse_cofid_number(row[7])
    return proximates


def load_cnf_food(code: int) -> dict:
    import urllib.request

    url = (
        "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientamount/"
        f"?id={code}&lang=en&type=json"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "macro-tracker-catalog/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        rows = json.load(response)
    by_id = {row["nutrient_name_id"]: row["nutrient_value"] for row in rows}
    foods = json.load(open(ROOT / "cnf-foods.json"))
    name = next(item["food_description"] for item in foods if item["food_code"] == code)
    return {
        "description": name,
        "kcal": by_id.get(208),
        "protein": by_id.get(203),
        "fat": by_id.get(204),
        "carbs": by_id.get(205),
        "fiber": by_id.get(291),
        "sugar": by_id.get(269),
        "sat": by_id.get(606),
        "sodium": by_id.get(307),
        "fdc_id": None,
        "source_ref": code,
    }


def index_by_description(rows: list[dict]) -> dict[str, dict]:
    found: dict[str, dict] = {}
    for row in rows:
        found.setdefault(row["description"], row)
    return found


def to_food(name: str, row: dict, source: str) -> dict:
    if row.get("kcal") is None or row.get("protein") is None or row.get("carbs") is None or row.get("fat") is None:
        raise SystemExit(f"Incomplete macros for {name} from {source}: {row.get('description')}")
    macros = {
        "protein": as_num(row["protein"], 1),
        "carbs": as_num(row["carbs"], 1),
        "fat": as_num(row["fat"], 1),
    }
    for key, places in (("fiber", 1), ("sugar", 1), ("satFat", 1), ("sodium", 0)):
        raw_key = {"satFat": "sat"}.get(key, key)
        if row.get(raw_key) is not None:
            macros[key] = as_num(row[raw_key], places)
    # Carbohydrate-by-difference in Foundation Foods can be slightly negative.
    # That is zero carbohydrate, not a negative amount someone could log.
    for key, value in list(macros.items()):
        if value < 0:
            macros[key] = 0
    calories = as_num(row["kcal"], 0)
    if calories < 0:
        calories = 0
    food = {
        "name": name,
        "grams": 100,
        "calories": calories,
        "macros": macros,
        "source": source,
        "sourceName": row.get("description") or name,
    }
    if row.get("fdc_id"):
        food["fdcId"] = row["fdc_id"]
    source_ref = row.get("source_ref")
    if source_ref is None and row.get("fdc_id"):
        source_ref = row["fdc_id"]
    if source_ref is None and row.get("code"):
        source_ref = row["code"]
    if source_ref is None:
        raise SystemExit(f"No source ref for {name} ({source})")
    food["sourceRef"] = source_ref
    return food


def macro_signature(food: dict) -> tuple:
    macros = food["macros"]
    return (
        food["calories"],
        macros.get("protein"),
        macros.get("carbs"),
        macros.get("fat"),
        macros.get("satFat"),
        macros.get("sodium"),
    )


# USDA SR / Foundation category ids. Baby food, fast food, restaurant meals,
# sweets, snacks, and mixed entrees stay out. Branded rows are filtered by name.
USDA_WHOLE_FOOD_CATEGORIES = {
    "1",  # dairy and eggs
    "2",  # spices and herbs
    "4",  # fats and oils
    "5",  # poultry
    "9",  # fruits
    "10",  # pork
    "11",  # vegetables
    "12",  # nuts and seeds
    "13",  # beef
    "14",  # beverages
    "15",  # finfish and shellfish
    "16",  # legumes
    "17",  # lamb, veal, and game
    "18",  # baked goods (plain breads only)
    "20",  # cereal grains and pasta
}

# CoFID groups that are single foods rather than recipes or branded dishes.
COFID_WHOLE_FOOD_GROUPS = {
    "DG", "DI", "DF", "FA", "F", "GA", "G", "H", "WY",
    "JC", "JA", "JK", "JR", "DB", "AC", "AA", "AP", "AG", "AF",
    "CA", "CD", "BC", "BAH", "BAE", "BAK", "BA", "BAB", "BL", "BN", "BNE", "BJC",
    "OA", "OC", "OB", "OE", "OF", "DAM", "DAE", "FC", "WC",
}

NOT_A_WHOLE_FOOD = re.compile(
    r"|".join(
        [
            r"babyfood",
            r"\binfant\b",
            r"\btoddler\b",
            r"fast foods",
            r"restaurant,",
            r"cand(?:y|ies)",
            r"ice cream",
            r"\bsherbet\b",
            r"\bsorbet\b",
            r"\bcookies?\b",
            r"\bdoughnut",
            r"\bdonut",
            r"\bpastry\b",
            r"\bbrownie\b",
            r"with added solution",
            r"mechanically separated",
            r"mechanically deboned",
            r"\bbreaded\b",
            r"\bbattered\b",
            r"fried, flour",
            r"fried, batter",
            r"\bmeatless\b",
            r"\bimitation\b",
            r"alcoholic",
            r"\bcarbonated\b",
            r"soft drink",
            r"fruit-flavored drink",
            r"drink mix",
            r"granola bar",
            r"snack bar",
            r"breakfast bar",
            r"\bpudding\b",
            r"\bgelatin\b",
            r"syrup pack",
            r"heavy syrup",
            r"light syrup",
            r"\bsweetened\b",
            r"chocolate milk",
            r"milk shakes?",
            r"\beggnog\b",
            r"whipped topping",
            r"cream substitute",
            r"\bmargarine\b",
            r"\bshortening\b",
            r"\bhydrogenated\b",
            r"\bindustrial\b",
            r"\bsoup,",
            r"\bgravy,",
            r"separable fat",
            r"composite of trimmed",
            r"\bpatty\b",
            r"\bnugget",
            r"\bglazed\b",
            r"barbecue flavored",
            r"homemade",
            r"takeaway",
            r"ready meal",
            r"\bsandwich\b",
            r"\bpizza\b",
            r"\bbhaji\b",
            r"\bcurry,",
            r"fried in ",
            r"coated,",
            r"\bsupplement\b",
            r"\bformulated\b",
            r"cooking spray",
            r"meal replacement",
        ]
    ),
    re.I,
)

BRANDED = re.compile(r"\b(?!(?:USDA|KAMUT|AOAC|EMI)\b)[A-Z]{4,}\b")
PLAIN_BREAD = re.compile(
    r"bread|tortilla|bagel|pita|english muffin|rolls,|crackers|naan|chapati|roti|matzo|biscuits|cornbread|pancakes|waffles|croissant|focaccia|\bbuns?\b",
    re.I,
)
NOT_PLAIN_BREAD = re.compile(r"cookie|cake|pie|doughnut|donut|pastry|brownie|muffin|stuffing|coating|snack", re.I)

# Words that do not make two foods "the same thing".
CORE_STOP = re.compile(
    r"\b("
    r"choice|select|prime|all grades|grass-fed|grass fed|imported|australian|new zealand|"
    r"boneless|bone-in|lip-on|lip-off|lip off|"
    r"cooked|roasted|broiled|grilled|braised|stewed|fried|baked|simmered|boiled|steamed|"
    r"poached|pan-fried|pan-broiled|dry heat|moist heat|raw|unprepared|prepared|"
    r"drained|solids|liquids|unsalted|salted"
    r")\b",
    re.I,
)


def _num_diff(a, b, places: int) -> float:
    if a is None or b is None:
        return 0.0
    return abs(as_num(a, places) - as_num(b, places))


def nutritionally_distinct(a: dict, b: dict) -> bool:
    """True when two rows would log differently per 100 g.

    Grade, trim, and salt notes on the same food are not distinct when calories
    and the gram macros stay this close. A different cut, species, or preparation
    whose numbers move past the threshold is kept.
    """
    return (
        _num_diff(a.get("kcal"), b.get("kcal"), 0) > 12
        or _num_diff(a.get("protein"), b.get("protein"), 1) > 1.5
        or _num_diff(a.get("carbs"), b.get("carbs"), 1) > 1.5
        or _num_diff(a.get("fat"), b.get("fat"), 1) > 1.5
    )


def core_key(description: str) -> str:
    text = description.lower()
    text = re.sub(r"\(includes foods for usda's food distribution program\)", "", text)
    text = re.sub(r"\(may contain additives to retain moisture\)", "", text)
    text = re.sub(r"\(may have been previously frozen\)", "", text)
    text = re.sub(r"trimmed to [^,]+", "", text)
    text = re.sub(r",?\s*with salt\b", "", text)
    text = re.sub(r",?\s*without salt\b", "", text)
    text = re.sub(r",?\s*no salt added\b", "", text)
    text = re.sub(r",?\s*without added salt\b", "", text)
    text = CORE_STOP.sub(" ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def display_name(description: str) -> str:
    text = description
    text = re.sub(r"\s*\(Includes foods for USDA's Food Distribution Program\)", "", text, flags=re.I)
    text = re.sub(r"\s*\(may contain additives to retain moisture\)", "", text, flags=re.I)
    text = re.sub(r"\s*\(may have been previously frozen\)", "", text, flags=re.I)
    text = re.sub(r",?\s*without salt\b", "", text, flags=re.I)
    text = re.sub(r",?\s*with salt\b", "", text, flags=re.I)
    text = re.sub(r",?\s*no salt added\b", "", text, flags=re.I)
    text = re.sub(r",?\s*drained solids\b", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip(" ,")
    return text


def prefer_key(row: dict) -> tuple:
    text = row["description"].lower()
    score = 0
    if "without salt" in text or "no salt added" in text:
        score -= 5
    if re.search(r"\bwith salt\b", text):
        score += 8
    if "all grades" in text:
        score -= 3
    if "choice" in text:
        score -= 1
    if "select" in text:
        score += 1
    return (score, len(text), text)


def usda_whole_food(row: dict) -> bool:
    if str(row.get("category_id") or "") not in USDA_WHOLE_FOOD_CATEGORIES:
        return False
    description = row["description"]
    if BRANDED.search(description) or NOT_A_WHOLE_FOOD.search(description):
        return False
    if str(row.get("category_id")) == "18" and (
        not PLAIN_BREAD.search(description) or NOT_PLAIN_BREAD.search(description)
    ):
        return False
    if str(row.get("category_id")) == "14":
        if not re.search(r"coffee|tea,|juice|water|coconut water|milk,", description, re.I):
            return False
        if re.search(r"cocktail|powder|mix|sweet|soda|cola|energy|sport", description, re.I):
            return False
    if str(row.get("category_id")) == "1" and re.search(
        r"yogurt,.+(fruit|vanilla|strawberry|blueberry|peach|raspberry|lemon|chocolate)|"
        r"cheese food|cheese spread|frozen yogurt|dessert",
        description,
        re.I,
    ):
        return False
    return row.get("kcal") is not None and row.get("protein") is not None and row.get("carbs") is not None and row.get("fat") is not None


def cofid_whole_food(name: str, row: dict) -> bool:
    if str(row.get("group") or "") not in COFID_WHOLE_FOOD_GROUPS:
        return False
    if NOT_A_WHOLE_FOOD.search(name):
        return False
    if re.search(r"\b(retail|fortified|assorted flavours|children's)\b", name, re.I):
        return False
    return row.get("kcal") is not None and row.get("protein") is not None and row.get("carbs") is not None and row.get("fat") is not None


def app_category(row: dict) -> str | None:
    description = row["description"]
    category_id = str(row.get("category_id") or "")
    group = str(row.get("group") or "")
    if re.search(r"\b(butter|ghee|lard|dripping)\b", description, re.I) or category_id == "4" or group in {"OA", "OC", "OB", "OE", "OF"}:
        return "oils-fats"
    if category_id == "15" or group in {"JC", "JA", "JR", "JK"}:
        if re.match(r"(mollusks|crustaceans)\b", description, re.I) or group == "JK":
            return "shellfish"
        return "fish"
    if category_id == "11" or group in {"DG", "DI", "DF", "DAM", "DAE"}:
        if "juice" in description.lower():
            return "beverages"
        if re.search(
            r"\b(potatoes|potato|sweet potatoes|sweet potato|yams?\b|plantains?|cassava|taro|dasheen|parsnips?|rutabagas?|jicama|yambean|breadfruit)\b",
            description,
            re.I,
        ):
            return "starches"
        if re.search(r"\bcorn, sweet\b", description, re.I):
            return "starches"
        return "vegetables"
    if "juice" in description.lower() or category_id == "14" or group == "FC":
        return "beverages"
    return {
        "5": "poultry",
        "13": "beef",
        "10": "pork",
        "17": "lamb-goat-game",
        "1": "dairy-eggs",
        "20": "grains",
        "18": "grains",
        "16": "legumes",
        "9": "fruits",
        "12": "nuts-seeds",
        "2": "seasonings",
        "FA": "fruits",
        "F": "fruits",
        "GA": "nuts-seeds",
        "G": "nuts-seeds",
        "H": "seasonings",
        "WY": "seasonings",
        "DB": "legumes",
        "AC": "grains",
        "AA": "grains",
        "AP": "grains",
        "AG": "grains",
        "AF": "grains",
        "CA": "dairy-eggs",
        "CD": "dairy-eggs",
        "BC": "dairy-eggs",
        "BAH": "dairy-eggs",
        "BAE": "dairy-eggs",
        "BAK": "dairy-eggs",
        "BA": "dairy-eggs",
        "BAB": "dairy-eggs",
        "BL": "dairy-eggs",
        "BN": "dairy-eggs",
        "BNE": "dairy-eggs",
        "BJC": "dairy-eggs",
        "WC": "fruits",
    }.get(category_id or group)


def allocate_name(description: str, used: set[str], ref) -> str:
    candidates = [display_name(description)]
    if description not in candidates:
        candidates.append(description)
    candidates.append(f"{display_name(description)} ({ref})")
    for name in candidates:
        if name and name.lower() not in used:
            return name
    raise SystemExit(f"Could not name {description}")


def row_view(food: dict) -> dict:
    macros = food["macros"]
    return {
        "description": food.get("sourceName") or food["name"],
        "kcal": food["calories"],
        "protein": macros.get("protein"),
        "carbs": macros.get("carbs"),
        "fat": macros.get("fat"),
    }


def same_core_conflict(row: dict, buckets: dict[str, list[dict]]) -> bool:
    for other in buckets.get(core_key(row["description"]), []):
        if not nutritionally_distinct(row, other):
            return True
    return False


def cofid_token_conflict(name: str, row: dict, kept_rows: list[dict]) -> bool:
    """Drop a CoFID food that is the same item as one already kept and not distinct."""
    stop = {
        "and", "with", "from", "only", "whole", "fresh", "plain", "average",
        "dried", "boiled", "water", "unsalted", "salted", "flesh", "raw",
        "cooked", "mature", "seeds", "seed", "mixed", "species", "all",
    }
    tokens = {tok for tok in re.findall(r"[a-z0-9]+", name.lower()) if len(tok) > 2 and tok not in stop}
    if len(tokens) < 2:
        return False
    for other in kept_rows:
        if nutritionally_distinct(row, other):
            continue
        other_tokens = {
            tok
            for tok in re.findall(r"[a-z0-9]+", other["description"].lower())
            if len(tok) > 2 and tok not in stop
        }
        if len(tokens & other_tokens) >= 2 and (tokens <= other_tokens or other_tokens <= tokens or len(tokens & other_tokens) >= min(len(tokens), len(other_tokens)) - 0):
            shared = tokens & other_tokens
            if len(shared) >= 2 and min(len(tokens), len(other_tokens)) <= len(shared) + 1:
                return True
    return False


def auto_whole_foods(curated: list[tuple[str, dict]], sr_rows: list[dict], fd_rows: list[dict], cofid: dict[str, dict]) -> list[tuple[str, dict]]:
    used_names = {food["name"].lower() for _, food in curated}
    used_desc = {food.get("sourceName") or food["name"] for _, food in curated}
    buckets: dict[str, list[dict]] = {}
    kept_rows: list[dict] = []
    for _, food in curated:
        view = row_view(food)
        kept_rows.append(view)
        buckets.setdefault(core_key(view["description"]), []).append(view)

    added: list[tuple[str, dict]] = []
    seen_desc = set(used_desc)
    candidates: list[tuple[dict, str]] = []
    for row in sr_rows:
        if row["description"] in seen_desc or not usda_whole_food(row):
            continue
        candidates.append((row, "sr"))
        seen_desc.add(row["description"])
    for row in fd_rows:
        if row["description"] in seen_desc or not usda_whole_food(row):
            continue
        candidates.append((row, "fd"))
        seen_desc.add(row["description"])
    candidates.sort(key=lambda item: prefer_key(item[0]))

    for row, source in candidates:
        if same_core_conflict(row, buckets):
            continue
        category = app_category(row)
        if category is None or category not in {cat_id for cat_id, _ in CATEGORIES}:
            continue
        ref = row.get("fdc_id")
        name = allocate_name(row["description"], used_names, ref)
        food = to_food(name, row, source)
        added.append((category, food))
        view = row_view(food)
        kept_rows.append(view)
        buckets.setdefault(core_key(row["description"]), []).append(view)
        used_names.add(name.lower())

    cofid_items = sorted(cofid.items(), key=lambda item: item[0].lower())
    for name_key, row in cofid_items:
        if name_key in seen_desc or not cofid_whole_food(name_key, row):
            continue
        full = {**row, "description": name_key, "fdc_id": None, "source_ref": row.get("code")}
        if same_core_conflict(full, buckets) or cofid_token_conflict(name_key, full, kept_rows):
            continue
        category = app_category(full)
        if category is None or category not in {cat_id for cat_id, _ in CATEGORIES}:
            continue
        name = allocate_name(name_key, used_names, row.get("code"))
        food = to_food(name, full, "cofid")
        added.append((category, food))
        view = row_view(food)
        kept_rows.append(view)
        buckets.setdefault(core_key(name_key), []).append(view)
        used_names.add(name.lower())
        seen_desc.add(name_key)
    return added


def main() -> None:
    print("Loading USDA…")
    sr_rows = load_usda(ROOT / "FoodData_Central_sr_legacy_food_csv_2018-04", "sr_legacy_food")
    fd_rows = load_usda(ROOT / "FoodData_Central_foundation_food_csv_2026-04-30", "foundation_food")
    sr = index_by_description(sr_rows)
    fd = index_by_description(fd_rows)
    print("Loading CoFID…")
    cofid = load_cofid(ROOT / "cofid.xlsx")
    cnf_cache: dict[int, dict] = {}

    resolved = []
    missing = []
    for cat, name, source, key in SPECS:
        if source == "sr":
            row = sr.get(key)
        elif source == "fd":
            row = fd.get(key)
        elif source == "cofid":
            row = cofid.get(key)
            if row is not None:
                row = {**row, "description": key, "fdc_id": None}
        elif source == "cnf":
            if key not in cnf_cache:
                print(f"  CNF {key} {name}")
                cnf_cache[key] = load_cnf_food(key)
            row = cnf_cache[key]
        else:
            raise SystemExit(source)
        if row is None:
            missing.append((name, source, key))
            continue
        resolved.append((cat, to_food(name, row, source)))

    if missing:
        print("\nMISSING")
        for item in missing:
            print(" ", item)
        raise SystemExit(f"{len(missing)} foods did not resolve")

    auto = auto_whole_foods(resolved, sr_rows, fd_rows, cofid)
    print(f"Auto-added {len(auto)} whole foods beyond the named list")
    resolved.extend(auto)

    # Drop a later food when an earlier one has the same macros and a near-identical name.
    kept: list[tuple[str, dict]] = []
    dropped = []
    for cat, food in resolved:
        sig = macro_signature(food)
        duplicate = None
        for prev_cat, prev in kept:
            if prev_cat != cat or macro_signature(prev) != sig:
                continue
            a = re.sub(r"[^a-z0-9]+", " ", prev["name"].lower()).strip()
            b = re.sub(r"[^a-z0-9]+", " ", food["name"].lower()).strip()
            if a == b or a in b or b in a:
                duplicate = prev["name"]
                break
        if duplicate:
            dropped.append((food["name"], duplicate))
            continue
        kept.append((cat, food))
    if dropped:
        print("\nDropped near-duplicates:")
        for name, other in dropped:
            print(f"  {name}  ≈  {other}")

    names = [food["name"].lower() for _, food in kept]
    if len(names) != len(set(names)):
        from collections import Counter

        dupes = [name for name, count in Counter(names).items() if count > 1]
        raise SystemExit(f"Duplicate names: {dupes}")

    by_cat: dict[str, list[dict]] = {cat_id: [] for cat_id, _ in CATEGORIES}
    for cat, food in kept:
        by_cat[cat].append(food)
    for cat_id, foods in by_cat.items():
        foods.sort(key=lambda food: food["name"].lower())
        print(f"  {cat_id}: {len(foods)}")
    print(f"TOTAL {sum(len(v) for v in by_cat.values())}")

    chicken = next(food for food in by_cat["poultry"] if food["name"] == "Chicken breast")
    assert chicken["calories"] == 165, chicken
    assert chicken["macros"]["protein"] == 31, chicken
    assert chicken["macros"]["fat"] == 3.6, chicken
    assert chicken["macros"]["carbs"] == 0, chicken
    required = {"chicken breast", "white rice, cooked", "rolled oats", "whole egg", "greek yogurt, 2%"}
    have = {food["name"].lower() for foods in by_cat.values() for food in foods}
    missing_legacy = required - have
    if missing_legacy:
        raise SystemExit(f"Missing legacy names: {missing_legacy}")
    if not any("sigarilyas" in name for name in have):
        raise SystemExit("Missing winged beans (sigarilyas)")
    for needed in ("mung beans, dry", "mung beans, cooked", "mung bean sprouts, cooked", "mung dal, cooked"):
        if needed not in have:
            raise SystemExit(f"Missing {needed}")
    total = sum(len(v) for v in by_cat.values())
    if total <= 750:
        raise SystemExit(f"Catalog is still sparse ({total}); expected a broader whole-food set")

    sources = Counter_sources(kept)
    print("sources", sources)
    write_builder(by_cat, sources)


def Counter_sources(kept: list[tuple[str, dict]]) -> dict[str, int]:
    counts = {"sr": 0, "fd": 0, "cofid": 0, "cnf": 0}
    for _, food in kept:
        counts[food["source"]] += 1
    return counts


def py_num(value: int | float) -> str:
    if isinstance(value, int):
        return str(value)
    return f"{value:.1f}"


def emit_food_call(food: dict) -> str:
    macros = food["macros"]
    parts = [
        f'food({json.dumps(food["name"])}, {py_num(food["calories"])}, {py_num(macros["protein"])}, {py_num(macros["carbs"])}, {py_num(macros["fat"])}'
    ]
    for key in ("fiber", "sugar", "satFat", "sodium"):
        if key in macros:
            parts.append(f"{key}={py_num(macros[key])}")
    if food.get("fdcId"):
        parts.append(f'fdcId={food["fdcId"]}')
    parts.append(f'source={json.dumps(food["source"])}')
    ref = food["sourceRef"]
    if isinstance(ref, int):
        parts.append(f"sourceRef={ref}")
    else:
        parts.append(f"sourceRef={json.dumps(str(ref))}")
    return ", ".join(parts) + ")"


def write_builder(by_cat: dict[str, list[dict]], sources: dict[str, int]) -> None:
    lines = [
        '#!/usr/bin/env python3',
        '"""Build the curated whole-foods starter catalog.',
        "",
        "Values are per 100 g edible portion. They were compiled from:",
        "  - USDA FoodData Central SR Legacy (April 2018) and Foundation Foods (April 2026)",
        "  - UK Composition of Foods Integrated Dataset (CoFID) 2021",
        "  - Health Canada Canadian Nutrient File",
        "",
        "Everyday names cover common foods. The rest keep the database description",
        "with grade, trim, and salt boilerplate removed. Branded, restaurant,",
        "fast-food, and baby-food rows were left out. A row is dropped only when",
        "it is the same food as one already kept and the macros are not distinct.",
        "Every entry records source and sourceRef from the lookup.",
        "",
        f"Counts by source at compile time: USDA SR Legacy {sources['sr']},",
        f"USDA Foundation {sources['fd']}, CoFID {sources['cofid']}, Canadian Nutrient File {sources['cnf']}.",
        "",
        "Run from repo root:",
        "  python3 scripts/build-whole-foods-catalog.py",
        '"""',
        "",
        "from __future__ import annotations",
        "",
        "import json",
        "from pathlib import Path",
        "",
        "ROOT = Path(__file__).resolve().parents[1]",
        'OUT_DIR = ROOT / "src" / "data" / "starter"',
        'CATEGORIES_DIR = OUT_DIR / "categories"',
        "",
        "",
        "def food(",
        "    name: str,",
        "    calories: float,",
        "    protein: float,",
        "    carbs: float,",
        "    fat: float,",
        "    *,",
        "    fiber: float | None = None,",
        "    sugar: float | None = None,",
        "    satFat: float | None = None,",
        "    sodium: float | None = None,",
        "    fdcId: int | None = None,",
        "    source: str | None = None,",
        "    sourceRef: int | str | None = None,",
        ") -> dict:",
        "    macros: dict[str, float] = {",
        '        "protein": protein,',
        '        "carbs": carbs,',
        '        "fat": fat,',
        "    }",
        "    if fiber is not None:",
        '        macros["fiber"] = fiber',
        "    if sugar is not None:",
        '        macros["sugar"] = sugar',
        "    if satFat is not None:",
        '        macros["satFat"] = satFat',
        "    if sodium is not None:",
        '        macros["sodium"] = sodium',
        "    item = {",
        '        "name": name,',
        '        "grams": 100,',
        '        "calories": calories,',
        '        "macros": macros,',
        "    }",
        "    if fdcId is not None:",
        '        item["fdcId"] = fdcId',
        "    if source is not None:",
        '        item["source"] = source',
        "    if sourceRef is not None:",
        '        item["sourceRef"] = sourceRef',
        "    return item",
        "",
        "",
        "CATEGORIES: list[dict] = [",
    ]
    labels = dict(CATEGORIES)
    for cat_id, _label in CATEGORIES:
        lines.append("    {")
        lines.append(f'        "id": {json.dumps(cat_id)},')
        lines.append(f'        "label": {json.dumps(labels[cat_id])},')
        lines.append('        "foods": [')
        for food in by_cat[cat_id]:
            lines.append(f"            {emit_food_call(food)},")
        lines.append("        ],")
        lines.append("    },")
    lines.append("]")
    lines.append("")
    lines.append("")
    lines.extend(TAIL.strip("\n").split("\n"))
    lines.append("")
    OUT_SCRIPT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_SCRIPT}")


TAIL = '''
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
        path.write_text(json.dumps(payload, separators=(",", ":")) + "\\n", encoding="utf-8")
        total += len(cat["foods"])
        manifest_cats.append(
            {"id": cat["id"], "label": cat["label"], "count": len(cat["foods"])}
        )
        print(f"  {cat['id']}: {len(cat['foods'])} foods")

    manifest = {
        "source": "Curated whole foods (USDA FoodData Central, UK CoFID, Canadian Nutrient File)",
        "license": "USDA public domain; UK Open Government Licence (CoFID); Health Canada Canadian Nutrient File",
        "portal": "https://fdc.nal.usda.gov/",
        "basis": (
            "Amounts per 100 g edible portion. Compiled from USDA FoodData Central "
            "(SR Legacy and Foundation Foods), the UK Composition of Foods Integrated "
            "Dataset (CoFID), and the Canadian Nutrient File. Each food keeps the "
            "source id from that lookup. Same-food rows are dropped only when "
            "their macros match; category JSON files are lazy-loaded."
        ),
        "total": total,
        "categories": manifest_cats,
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\\n", encoding="utf-8"
    )
    print(f"\\nWrote {total} foods across {len(categories)} categories → {OUT_DIR}")


if __name__ == "__main__":
    main()
'''


if __name__ == "__main__":
    main()
