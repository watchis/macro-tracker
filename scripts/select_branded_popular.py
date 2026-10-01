#!/usr/bin/env python3
"""Choose one USDA Branded Foods row per household-name product."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

BASE = Path("/tmp/food-sources/FoodData_Central_branded_food_csv_2026-04-30")
OUT = Path(__file__).resolve().parent / "branded_popular.json"

# name, category, description include, description exclude, brand include, kcal lo, hi
SPECS = [
    ("Coca-Cola", "beverages", r"^coca-cola, cola$", r"diet|zero|cherry|vanilla", r"coca-cola", 35, 45),
    ("Diet Coke", "beverages", r"diet coke", r"cherry|vanilla|caffeine|lime|lemon|ginger|feisty|twisted|mango", r"coca-cola", 0, 2),
    ("Coca-Cola Zero Sugar", "beverages", r"coca-cola zero sugar", r"cherry|vanilla|caffeine|orange|lemon|lime|starlight", r"coca-cola", 0, 2),
    ("Pepsi", "beverages", r"^pepsi( soda| cola)?,", r"diet|zero|cherry|vanilla|wild|mango|nitro|real sugar|marshmallow", r"pepsi", 38, 48),
    ("Diet Pepsi", "beverages", r"^diet pepsi cola 12 fluid ounce aluminum can$", r"caffeine|mix|pack", r"pepsi", 0, 2),
    ("Mountain Dew", "beverages", r"^(mtn dew|mountain dew), soda$", r"diet|zero|code red|baja|voltage|live wire|throwback", r"pepsi", 47, 52),
    ("Diet Mountain Dew", "beverages", r"^diet mtn dew", r"code red|baja|voltage|caffeine|zero sugar|major melon", r"pepsi", 0, 2),
    ("Sprite", "beverages", r"^sprite, lemon-lime soda, lemon-lime$", r"zero|diet|cherry|tropical|lemon-line", r"coca-cola", 36, 46),
    ("Dr Pepper", "beverages", r"^dr pepper, soda$", r"diet|zero|cherry|vanilla|cream|berries", r"pepper", 38, 48),
    ("Fanta Orange", "beverages", r"^fanta, soda, orange", r"zero|diet", r"coca-cola", 40, 52),
    ("7UP", "beverages", r"^7up, caffeine free soda$", r"diet|zero|cherry", r"pepper|7up|keurig|dr", 38, 48),
    ("Gatorade", "beverages", r"gatorade lemon[- ]lime thirst quencher", r"zero|g2|powder|frost|fierce", r"pepsi", 18, 28),
    ("Red Bull", "beverages", r"^red bull, energy drink$", r"sugarfree|sugar free|zero|edition|coconut|tropical", r"red bull", 40, 50),
    ("Monster Energy", "beverages", r"^monster, energy drink$", r"zero|ultra|java|lo-carb|rehab|juice|pipeline|mango", r"monster energy", 40, 52),
    ("Arizona Green Tea", "beverages", r"arizona, green tea with ginseng and honey$", r"diet|zero|peach|lemonade", r"ferolito|arizona", 20, 35),
    ("Starbucks Frappuccino Mocha", "beverages", r"starbucks, frappuccino, chilled coffee drink, mocha$", r"coconut|light|vanilla|caramel", r"starbucks|pepsi", 55, 75),
    ("Heinz Tomato Ketchup", "seasonings", r"^heinz, tomato ketchup$", r"no sugar|simply|organic|jalapeno|sriracha|spicy", r"heinz", 100, 130),
    ("French's Yellow Mustard", "seasonings", r"^classic yellow mustard$", r"spicy|honey|dijon|brown", r"french", 50, 100),
    ("Hellmann's Mayonnaise", "seasonings", r"^real mayonnaise$", r"light|olive|avocado|vegan|spicy|dressing", r"unilever|hellmann", 640, 750),
    ("Hidden Valley Ranch", "seasonings", r"^the original ranch$", r"light|fat free|dip|seasoning|packet|bacon", r"hvr|hidden valley", 420, 520),
    ("Tabasco Pepper Sauce", "seasonings", r"^pepper sauce$", r"chipotle|habanero|garlic|green|sweet|sriracha", r"mcilhenny|tabasco", 0, 40),
    ("Huy Fong Sriracha", "seasonings", r"sriracha hot chili sauce", r"ketchup|salsa|mayo|diced|tomato", r"huy fong", 50, 140),
    ("Kikkoman Soy Sauce", "seasonings", r"^soy sauce, soy$", r"less sodium|lite|tamari|teriyaki|gluten|organic", r"kikkoman", 50, 90),
    ("Grey Poupon Dijon", "seasonings", r"grey poupon dijon", r"honey|country|whole grain", r"heinz|grey poupon", 70, 160),
    ("A.1. Steak Sauce", "seasonings", r"^a\.1\., steak sauce$", r"sweet|bold|smoky|cracked", r"heinz|kraft", 70, 140),
    ("Lea & Perrins Worcestershire", "seasonings", r"^the original worcestershire sauce$", r"reduced|low sodium|thick", r"lea", 70, 140),
    ("Ferrero Rocher", "popular-brands", r"ferrero rocher, whole hazelnut", r"collection|raffaello", r"ferrero|diversion", 560, 640),
    ("Nutella", "popular-brands", r"^hazelnut spread with cocoa, hazelnut spread$", r"wafer|biscuit|breadstick|go!", r"ferrero", 520, 560),
    ("Snickers", "popular-brands", r"^snickers,", r"minis|mixed nuts|almond|pumpkin|ice cream|brownie|crisper|egg|protein|fun size|peanut butter", r"mars", 460, 520),
    ("Kit Kat", "popular-brands", r"^kitkat, crisp wafers in milk chocolate$", r"mini|matcha|duo", r"the hershey company", 470, 530),
    ("M&M's Milk Chocolate", "popular-brands", r"^m&m's, milk chocolate candies$", r"peanut|pretzel|minis|ice cream|dark|white", r"mars", 450, 520),
    ("Reese's Peanut Butter Cups", "popular-brands", r"^reese's, peanut butter cups$", r"white|miniature|egg|thins|stuffed|zero|pieces", r"hershey", 490, 520),
    ("Hershey's Milk Chocolate", "popular-brands", r"^hershey's, milk chocolate$", r"kisses|almond|nugget|chips|syrup|cookie|special dark", r"hershey", 510, 545),
    ("Twix", "popular-brands", r"^twix, cookie bars$", r"ice cream|white|peanut|minis|salted caramel", r"mars", 470, 540),
    ("Oreo", "popular-brands", r"oreo cookies oreo", r"double|mega|thins|golden|mint|peanut|fudge|covered|sherbet|nascar", r"mondelez|nabisco", 450, 510),
    ("Lay's Classic Potato Chips", "popular-brands", r"^lay's, classic potato chips$", r"kettle|baked|wavy|bbq|sour|baked", r"frito-lay|pepsi", 520, 590),
    ("Doritos Nacho Cheese", "popular-brands", r"^doritos, tortilla chips, nacho cheese, nacho cheese$", r"spicy|reduced|baked|cool ranch", r"frito-lay", 470, 540),
    ("Cheetos Crunchy", "popular-brands", r"cheetos, chester cheetah, crunchy snacks, cheese, cheese$", r"flamin|hot|puff|jalapeno|limon", r"frito-lay", 500, 580),
    ("Pringles Original", "popular-brands", r"^pringles crisps original", r"sour|bbq|cheddar|pizza|ranch|scorch", r"kellogg", 510, 570),
    ("Cheerios", "popular-brands", r"^cheerios cereal$", r"honey|frosted|multi|apple|cinnamon|chocolate|peach|protein", r"general mills", 340, 400),
    ("Frosted Flakes", "popular-brands", r"kellogg's, frosted flakes, frosted corn flake cereal$", r"chocolate|cup|cereal bar|with ", r"kellogg", 340, 400),
    ("Pop-Tarts Frosted Strawberry", "popular-brands", r"pop-tarts frosted strawberry", r"unfrosted|mini|bites|crisps|wild", r"kellogg", 370, 420),
    ("Ritz Crackers", "popular-brands", r"^ritz crackers ", r"bits|sandwich|peanut|cheese|whole wheat|big", r"mondelez|nabisco", 450, 530),
    ("Skippy Creamy Peanut Butter", "popular-brands", r"^skippy, creamy peanut butter, creamy$", r"natural|honey|chocolate|singles", r"skippy", 560, 640),
    ("Philadelphia Cream Cheese", "dairy-eggs", r"^philadelphia, original cream cheese$", r"light|whipped|strawberry|chive|spread", r"heinz|kraft|philadelphia", 280, 380),
    ("Kraft Singles", "dairy-eggs", r"^singles american cheese$", r"2%|sharp|swiss|white|fat free", r"heinz|kraft", 250, 340),
    ("Campbell's Condensed Tomato Soup", "popular-brands", r"^campbell's condensed tomato soup,", r"unsalted|healthy|organic|roasted|spicy|goldfish", r"campbell", 70, 80),
    ("Häagen-Dazs Vanilla", "popular-brands", r"^vanilla ice cream, vanilla$", r"bean|chocolate|chip|bar|sandwich|light|non", r"haagen", 220, 290),
    ("Ben & Jerry's Chocolate Chip Cookie Dough", "popular-brands", r"ben & jerry's.*cookie dough", r"non-dairy|light|core|vegan", r"ben & jerry", 230, 340),
    ("Wonder Classic White Bread", "popular-brands", r"^wonder, enriched bread$", r"texas|roll|bun|wheat|honey", r"flowers", 240, 290),
    ("Kraft Macaroni & Cheese", "popular-brands", r"^kraft, macaroni & cheese dinner$", r"spiral|thick|deluxe|cup|whole grain|shapes", r"heinz|kraft", 340, 420),
]


def main() -> None:
    compiled = []
    for spec in SPECS:
        compiled.append((*spec[:2], re.compile(spec[2], re.I), re.compile(spec[3], re.I), re.compile(spec[4], re.I), spec[5], spec[6]))

    hits: dict[str, list[tuple[int, str]]] = {spec[0]: [] for spec in SPECS}
    with (BASE / "food.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            desc = row["description"] or ""
            fdc = int(row["fdc_id"])
            for name, _cat, include, exclude, _brand, _lo, _hi in compiled:
                if include.search(desc) and not exclude.search(desc):
                    hits[name].append((fdc, desc))
    print("description hits")
    for name, _cat, *_rest in SPECS:
        print(f"  {name}: {len(hits[name])}")

    wanted = {fdc for rows in hits.values() for fdc, _desc in rows}
    brands: dict[int, dict] = {}
    with (BASE / "branded_food.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            fdc = int(row["fdc_id"])
            if fdc in wanted:
                brands[fdc] = row

    nutrients: dict[int, dict[str, float]] = {fdc: {} for fdc in wanted}
    id_to_name = {}
    with (BASE / "nutrient.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            id_to_name[row["id"]] = row["name"]
    keep_ids = {
        "1008": "kcal",
        "1003": "protein",
        "1004": "fat",
        "1005": "carbs",
        "1079": "fiber",
        "2000": "sugar",
        "1258": "sat",
        "1093": "sodium",
    }
    with (BASE / "food_nutrient.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            fdc = int(row["fdc_id"])
            bucket = nutrients.get(fdc)
            if bucket is None:
                continue
            key = keep_ids.get(row["nutrient_id"])
            if key and row["amount"]:
                bucket[key] = float(row["amount"])

    chosen = []
    for name, category, _inc, _exc, brand_re, lo, hi in compiled:
        ranked = []
        for fdc, desc in hits[name]:
            brand = brands.get(fdc) or {}
            owner = f"{brand.get('brand_owner','')} {brand.get('brand_name','')}"
            nuts = nutrients.get(fdc) or {}
            kcal = nuts.get("kcal")
            points = 0
            if kcal is None or "protein" not in nuts or "carbs" not in nuts or "fat" not in nuts:
                points -= 500
            elif not (lo <= kcal <= hi):
                points -= 300
            if nuts.get("sodium") is not None and nuts["sodium"] > 8000:
                points -= 400
            if nuts.get("fiber") is not None and nuts["fiber"] > 80:
                points -= 400
            if not brand_re.search(owner):
                points -= 200
            points -= len(desc) / 80
            ranked.append((points, fdc, desc, owner, nuts, brand))
        ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
        print(f"\n## {name}")
        for points, fdc, desc, owner, nuts, _brand in ranked[:3]:
            print(f"  {points:7.1f} {fdc} {nuts.get('kcal')} | {owner[:40]} | {desc[:90]}")
        if not ranked or ranked[0][0] < -50:
            print("  NO PICK")
            continue
        points, fdc, desc, owner, nuts, brand = ranked[0]
        chosen.append(
            {
                "name": name,
                "category": category,
                "fdcId": fdc,
                "description": desc,
                "brandOwner": brand.get("brand_owner"),
                "brandName": brand.get("brand_name"),
                "gtinUpc": brand.get("gtin_upc"),
                "servingSize": float(brand["serving_size"]) if brand.get("serving_size") else None,
                "servingSizeUnit": brand.get("serving_size_unit"),
                "kcal": nuts.get("kcal"),
                "protein": nuts.get("protein"),
                "fat": nuts.get("fat"),
                "carbs": nuts.get("carbs"),
                "fiber": nuts.get("fiber"),
                "sugar": nuts.get("sugar"),
                "sat": nuts.get("sat"),
                "sodium": nuts.get("sodium"),
            }
        )
    OUT.write_text(json.dumps({"source": "USDA FoodData Central Branded Foods", "release": "2026-04-30", "foods": chosen}, indent=2) + "\n")
    print(f"\nkept {len(chosen)} -> {OUT}")


if __name__ == "__main__":
    main()
