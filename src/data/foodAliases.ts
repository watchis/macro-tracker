/**
 * Common names, spellings, and translations for catalog foods.
 * Applied when the catalog loads so search can find a food under the name
 * people actually type, without renaming the database entry.
 */

export type AliasRule = {
  /** Matched against the lowercased food name. */
  pattern: RegExp;
  aliases: readonly string[];
  /** Skip when the name is a different food that merely shares a word. */
  unless?: RegExp;
};

export const ALIAS_RULES: readonly AliasRule[] = [
  // --- produce, US / UK / South Asian / East Asian ---
  { pattern: /\beggplant\b/, aliases: ['aubergine', 'brinjal'] },
  { pattern: /\bzucchini\b/, aliases: ['courgette'] },
  { pattern: /\barugula\b/, aliases: ['rocket', 'roquette'] },
  { pattern: /\bscallions?\b/, aliases: ['green onion', 'spring onion', 'green onions'] },
  { pattern: /\bbell pepper\b/, aliases: ['capsicum', 'sweet pepper'] },
  {
    pattern: /\bbok choy\b|\bpak-choi\b|\bpak choi\b/,
    aliases: ['pak choi', 'pak choy', 'bok choi'],
  },
  {
    pattern: /\bnapa cabbage\b|\bpe-tsai\b/,
    aliases: ['napa', 'wombok', 'chinese cabbage', 'pe-tsai'],
  },
  { pattern: /\bcilantro\b/, aliases: ['coriander leaves', 'fresh coriander', 'chinese parsley'] },
  { pattern: /\bdaikon\b/, aliases: ['mooli', 'white radish'] },
  { pattern: /\bokra\b/, aliases: ['bhindi', 'ladyfinger', "lady's finger"] },
  { pattern: /\bbeets?\b/, aliases: ['beetroot'] },
  { pattern: /\brutabaga/, aliases: ['swede'] },
  { pattern: /\bsnow peas?\b/, aliases: ['mangetout'] },
  { pattern: /\bcassava\b/, aliases: ['yuca', 'manioc'] },
  { pattern: /\bjicama\b|\byambean\b/, aliases: ['yam bean', 'mexican turnip'] },
  { pattern: /\btaro\b/, aliases: ['dasheen', 'eddo', 'kalo'] },
  { pattern: /\bplantains?\b/, aliases: ['cooking banana'] },
  { pattern: /\bsweet potato(?! leaves)\b/, aliases: ['kumara'] },
  {
    pattern: /\bcorn, sweet\b|\bsweet corn\b|\bcorn, yellow\b|\bcorn, white\b/,
    aliases: ['maize', 'sweetcorn'],
  },
  { pattern: /\bcornstarch\b/, aliases: ['cornflour', 'corn starch'] },
  { pattern: /\bchayote\b/, aliases: ['choko', 'mirliton', 'sayote', 'christophene'] },
  {
    pattern: /\bbitter melon\b|\bbitter gourd\b|\bbalsam-pear\b|\bkarela\b/,
    aliases: ['karela', 'ampalaya', 'bitter gourd', 'bitter melon'],
  },
  { pattern: /\blotus root\b/, aliases: ['renkon', 'lotus'] },
  {
    pattern: /\bwater spinach\b|\bkangkong\b|\bconvolvulus\b/,
    aliases: ['kangkong', 'kangkung', 'ong choy', 'kang kong'],
  },
  { pattern: /\blemongrass\b|\blemon grass\b/, aliases: ['lemongrass', 'lemon grass'] },
  {
    pattern: /\bwood ear\b|\bcloud ear\b/,
    aliases: ['cloud ear', 'wood ear', 'black fungus'],
  },
  { pattern: /\benoki\b/, aliases: ['enokitake'] },
  { pattern: /\bmaitake\b/, aliases: ['hen of the woods'] },
  { pattern: /\bshiitake\b/, aliases: ['shiitake'] },
  {
    pattern: /\bwinged bean/,
    aliases: [
      'sigarilyas',
      'sigarillas',
      'sigadillas',
      'sigarillias',
      'goa bean',
      'asparagus pea',
      'princess bean',
    ],
  },
  {
    pattern: /\byardlong\b|\blong beans?\b/,
    aliases: ['sitaw', 'long bean', 'asparagus bean', 'snake bean'],
  },
  { pattern: /\bmung\b/, aliases: ['moong', 'green gram'] },
  {
    pattern: /\bcellophane\b|\bglass noodle\b|\bbean thread\b/,
    aliases: ['glass noodles', 'bean threads', 'cellophane noodles'],
  },
  { pattern: /\burad\b|\bblack gram\b/, aliases: ['urad', 'black gram', 'black lentil'] },
  { pattern: /\bpigeon pea\b|\bred gram\b/, aliases: ['toor', 'toor dal', 'arhar', 'red gram'] },
  { pattern: /\bchickpeas?\b|\bgarbanzo\b/, aliases: ['garbanzo', 'chana', 'ceci', 'bengal gram'] },
  { pattern: /\bkidney bean/, aliases: ['rajma'] },
  { pattern: /\bblack-eyed\b|\bblack eyed\b/, aliases: ['cowpea', 'black-eyed bean'] },
  { pattern: /\badzuki\b|\bazuki\b|\baduki\b/, aliases: ['azuki', 'aduki', 'adzuki'] },
  { pattern: /\bfava\b|\bbroadbeans?\b|\bbroad beans?\b/, aliases: ['broad bean', 'fava bean'] },
  { pattern: /\blima bean/, aliases: ['butter bean'] },
  { pattern: /\bpeanut/, aliases: ['groundnut'] },
  { pattern: /\btofu\b/, aliases: ['bean curd', 'beancurd'] },
  { pattern: /\bedamame\b/, aliases: ['mukimame', 'vegetable soybean'] },
  { pattern: /\bhummus\b/, aliases: ['houmous', 'hummous', 'humous'] },
  { pattern: /\bnatto\b/, aliases: ['fermented soybeans'] },
  { pattern: /\btempeh\b/, aliases: ['tempe'] },
  { pattern: /\bmiso\b/, aliases: ['soybean paste'] },
  {
    pattern: /\bsoy\b|\bsoya\b/,
    aliases: ['soya', 'soy'],
    unless: /\b(sauce|milk)\b/,
  },
  { pattern: /\bsoy sauce\b|\bshoyu\b/, aliases: ['shoyu', 'soya sauce'] },
  { pattern: /\bsoy milk\b|\bsoya milk\b/, aliases: ['soya milk', 'soy milk'] },
  { pattern: /\bamaranth leaves\b/, aliases: ['callaloo', 'chinese spinach'] },
  { pattern: /\bfenugreek leaves\b/, aliases: ['methi'] },
  { pattern: /\bfenugreek seed\b/, aliases: ['methi seed'] },
  { pattern: /\bcurry leaves\b/, aliases: ['curry leaf', 'kari patta'] },
  { pattern: /\bmustard greens\b/, aliases: ['gai choy'] },
  { pattern: /\bgarland chrysanthemum\b/, aliases: ['tong ho', 'shungiku'] },
  { pattern: /\bmalabar spinach\b/, aliases: ['basella', 'vine spinach'] },
  { pattern: /\bswiss chard\b|\bchard, swiss\b/, aliases: ['silverbeet', 'chard'] },
  { pattern: /\bcollard/, aliases: ['collard greens'] },
  { pattern: /\bkombu\b/, aliases: ['kelp'] },
  { pattern: /\bkelp\b/, aliases: ['kombu'] },
  { pattern: /\bnori\b/, aliases: ['laver'] },
  { pattern: /\bbamboo shoots?\b/, aliases: ['bamboo shoot'] },
  { pattern: /\bkimchi\b/, aliases: ['kimchee'] },
  { pattern: /\bsauerkraut\b/, aliases: ['sour cabbage'] },
  { pattern: /\bartichoke/, aliases: ['globe artichoke'] },

  // --- fruit ---
  { pattern: /\bpapaya\b/, aliases: ['pawpaw', 'paw paw'] },
  { pattern: /\bcantaloupe\b/, aliases: ['rockmelon'] },
  { pattern: /\bkiwi\b/, aliases: ['kiwifruit'] },
  { pattern: /\blychee/, aliases: ['litchi', 'lichee'] },
  { pattern: /\bstarfruit\b|\bcarambola\b/, aliases: ['carambola', 'star fruit'] },
  { pattern: /\bpomelo\b|\bpummelo\b/, aliases: ['pummelo', 'shaddock', 'pomelo'] },
  { pattern: /\bjujube\b/, aliases: ['chinese date', 'red date'] },
  { pattern: /\btamarind/, aliases: ['imli'] },
  { pattern: /\blongans?\b/, aliases: ['longan', 'dragon eye'] },
  { pattern: /\bpassion fruit\b|\bpassionfruit\b/, aliases: ['passionfruit', 'granadilla'] },
  { pattern: /\bpersimmon/, aliases: ['kaki', 'sharon fruit'] },
  { pattern: /\bjackfruit\b/, aliases: ['nangka'] },
  { pattern: /\brambutan\b/, aliases: ['rambutan'] },
  { pattern: /\bmangosteen\b/, aliases: ['mangosteen'] },
  { pattern: /\bdurian\b/, aliases: ['durian'] },
  { pattern: /\btangerine\b|\bmandarin\b/, aliases: ['mandarin', 'tangerine'] },
  { pattern: /\bclementine\b/, aliases: ['mandarin'] },
  { pattern: /\bprunes?\b|\bdried plum/, aliases: ['dried plum', 'prune'] },
  { pattern: /\bcranberr/, aliases: ['cranberry'] },

  // --- nuts, seeds, fats ---
  { pattern: /\bhazelnut/, aliases: ['filbert'] },
  { pattern: /\btahini\b/, aliases: ['sesame paste', 'sesame butter'] },
  { pattern: /\bflax/, aliases: ['linseed'] },
  { pattern: /\bpumpkin seeds?\b/, aliases: ['pepita', 'pepitas'] },
  { pattern: /\bpine nuts?\b/, aliases: ['pignoli'] },
  { pattern: /\bcanola\b/, aliases: ['rapeseed'] },
  { pattern: /\bghee\b/, aliases: ['clarified butter'] },
  { pattern: /\bchestnut/, aliases: ['chestnut'] },

  // --- grains ---
  {
    pattern: /\bsticky rice\b|\bglutinous\b/,
    aliases: ['glutinous rice', 'sweet rice', 'sticky rice'],
  },
  { pattern: /\bshort-grain rice\b/, aliases: ['sushi rice', 'short grain rice'] },
  { pattern: /\bsoba\b/, aliases: ['buckwheat noodles'] },
  { pattern: /\bpita\b/, aliases: ['pitta'] },
  { pattern: /\bchapati\b|\broti\b/, aliases: ['roti', 'chapatti', 'chapati'] },
  { pattern: /\bbulgur\b/, aliases: ['burghul', 'cracked wheat'] },
  { pattern: /\bfarro\b/, aliases: ['emmer'] },
  { pattern: /\brolled oats\b|\boatmeal\b/, aliases: ['porridge', 'porridge oats'] },
  { pattern: /\bwonton\b/, aliases: ['dumpling wrapper', 'egg roll wrapper'] },
  { pattern: /\bsorghum\b/, aliases: ['milo'], unless: /\bbran\b/ },
  { pattern: /\brice noodles?\b/, aliases: ['rice noodle'] },
  {
    pattern: /\bhamburger bun\b|\bhotdog\b|\bhot dog\b/,
    aliases: ['hot dog bun', 'hamburger bun'],
  },

  // --- fish and shellfish ---
  { pattern: /\bmahi/, aliases: ['dorado', 'dolphinfish'] },
  { pattern: /\byellowtail\b/, aliases: ['hamachi', 'buri'] },
  { pattern: /\bmilkfish\b/, aliases: ['bangus'] },
  { pattern: /\beel\b/, aliases: ['unagi'] },
  { pattern: /\bsquid\b/, aliases: ['calamari', 'calamary'] },
  { pattern: /\bshrimp/, aliases: ['prawn', 'prawns'] },
  { pattern: /\bprawn/, aliases: ['shrimp'] },
  { pattern: /\bcrayfish\b|\bcrawfish\b/, aliases: ['crawfish', 'crawdad'] },
  { pattern: /\boctopus\b/, aliases: ['tako'] },
  { pattern: /\bscallops?\b/, aliases: ['scallop'] },
  { pattern: /\bmussels?\b/, aliases: ['mussel'] },
  { pattern: /\bsardine/, aliases: ['sardines'] },
  { pattern: /\banchov/, aliases: ['anchovy', 'anchovies'] },
  { pattern: /\bsea bass\b/, aliases: ['seabass'] },
  { pattern: /\bswordfish\b/, aliases: ['swordfish'] },
  { pattern: /\barctic char\b/, aliases: ['char'] },
  {
    pattern: /\broe\b/,
    aliases: ['fish eggs'],
    unless: /\b(roe deer|buck)\b/,
  },
  { pattern: /\boysters?\b/, aliases: ['oyster'], unless: /\bmushroom/ },

  // --- meat, dairy, eggs ---
  {
    pattern: /\bground beef\b|\bbeef, mince\b|\bminced beef\b/,
    aliases: ['mince', 'beef mince', 'hamburger meat'],
  },
  { pattern: /\bribeye\b|\brib eye\b/, aliases: ['rib eye', 'scotch fillet'] },
  { pattern: /\bbeef tenderloin\b/, aliases: ['filet mignon', 'fillet steak'] },
  { pattern: /\bpork tenderloin\b/, aliases: ['pork fillet'] },
  { pattern: /\bcorned beef\b/, aliases: ['salt beef'] },
  { pattern: /\bcanadian bacon\b/, aliases: ['back bacon'] },
  { pattern: /\bpork belly\b/, aliases: ['pork belly'] },
  { pattern: /\bvenison\b|\bdeer\b/, aliases: ['deer', 'venison'] },
  { pattern: /\bbison\b/, aliases: ['buffalo'] },
  { pattern: /\bgoat\b/, aliases: ['chevon'], unless: /\b(cheese|milk)\b/ },
  { pattern: /\bcornish\b/, aliases: ['poussin', 'cornish hen'] },
  { pattern: /\bchicken\b/, aliases: ['hen'] },
  { pattern: /\byogurt\b/, aliases: ['yoghurt'] },
  { pattern: /\bparmesan\b/, aliases: ['parmigiano'] },
  { pattern: /\bhalloumi\b/, aliases: ['haloumi'] },
  { pattern: /\bpaneer\b/, aliases: ['panir'] },
  { pattern: /\bcr[eè]me fra[iî]che\b/, aliases: ['creme fraiche'] },
  { pattern: /\bquail egg\b/, aliases: ['quail eggs'] },
  { pattern: /\bkefir\b/, aliases: ['keefir'] },

  // --- seasonings and drinks ---
  { pattern: /\bfish sauce\b/, aliases: ['nam pla', 'nuoc mam', 'patis'] },
  { pattern: /\btamari\b/, aliases: ['tamari'] },
  { pattern: /\bsriracha\b/, aliases: ['sriracha'] },
  { pattern: /\bketchup\b|\bcatsup\b/, aliases: ['catsup', 'ketchup'] },
  { pattern: /\bmayonnaise\b/, aliases: ['mayo'] },
  { pattern: /\bmolasses\b/, aliases: ['treacle'] },
  { pattern: /\bcumin\b/, aliases: ['jeera'] },
  { pattern: /\bturmeric\b/, aliases: ['haldi'] },
  { pattern: /\bfennel seed\b/, aliases: ['saunf'] },
  { pattern: /\bchili\b|\bchile\b|\bchilli\b/, aliases: ['chile', 'chilli', 'chili'] },
  { pattern: /\bcocoa\b/, aliases: ['cacao'], unless: /\b(butter|bean)\b/ },
  { pattern: /\byeast extract\b/, aliases: ['marmite', 'vegemite'] },
  { pattern: /\bwasabi\b/, aliases: ['wasabi'] },
  { pattern: /\bbroth\b|\bstock\b/, aliases: ['stock', 'broth'] },
  { pattern: /\bespresso\b/, aliases: ['espresso'] },
  { pattern: /\bgreen tea\b/, aliases: ['green tea'] },
  { pattern: /\bcoconut water\b/, aliases: ['coconut water'] },
  { pattern: /\bcoconut milk\b/, aliases: ['coconut milk'] },
  { pattern: /\boat milk\b/, aliases: ['oatmilk'] },
  { pattern: /\balmond milk\b/, aliases: ['almondmilk'] },
];

/** Strip accents so "creme" matches "crème". */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function aliasesForName(name: string): string[] {
  const lower = name.toLowerCase();
  const folded = normalizeSearchText(name);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const rule of ALIAS_RULES) {
    rule.pattern.lastIndex = 0;
    if (!rule.pattern.test(lower)) continue;
    if (rule.unless) {
      rule.unless.lastIndex = 0;
      if (rule.unless.test(lower)) continue;
    }
    for (const alias of rule.aliases) {
      const key = normalizeSearchText(alias);
      if (key.length < 3 || folded.includes(key) || seen.has(key)) continue;
      seen.add(key);
      found.push(alias);
    }
  }
  return found;
}

/** Alias that explains a search hit when the official name does not contain the query. */
export function matchingAlias(
  name: string,
  aliases: readonly string[] | undefined,
  query: string,
): string | null {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return null;
  if (normalizeSearchText(name).includes(needle)) return null;
  return aliases?.find((alias) => normalizeSearchText(alias).includes(needle)) ?? null;
}
