export const LOGOTYPE_FONT_PROVIDER = "api.fonts.coollabs.io" as const;

export const LOGOTYPE_FONT_NAMES = [
  "Aguafina Script",
  "Alex Brush",
  "Allura",
  "Arizonia",
  "Ballet",
  "Beau Rivage",
  "Bilbo",
  "Bilbo Swash Caps",
  "Birthstone",
  "Bonheur Royale",
  "Caramel",
  "Carattere",
  "Charm",
  "Charmonman",
  "Cherish",
  "Clicker Script",
  "Cookie",
  "Corinthia",
  "Dancing Script",
  "Dynalight",
  "Eagle Lake",
  "Engagement",
  "Ephesis",
  "Estonia",
  "Euphoria Script",
  "Felipa",
  "Fleur De Leah",
  "Galada",
  "Grand Hotel",
  "Great Vibes",
  "Grey Qo",
  "Gwendolyn",
  "Herr Von Muellerhoff",
  "Hurricane",
  "Imperial Script",
  "Inspiration",
  "Island Moments",
  "Italianno",
  "Kings",
  "Lavishly Yours",
  "Licorice",
  "Lobster",
  "Love Light",
  "Lovers Quarrel",
  "Lugrasimo",
  "Luxurious Script",
  "Manufacturing Consent",
  "Marck Script",
  "Mea Culpa",
  "Meddon",
  "Meow Script",
  "Miss Fajardose",
  "Molle",
  "MonteCarlo",
  "Montez",
  "Mr Bedfort",
  "Mr Dafoe",
  "Mr De Haviland",
  "Mrs Saint Delafield",
  "Mrs Sheppards",
  "Ms Madi",
  "My Soul",
  "Niconne",
  "Norican",
  "Oleo Script Swash Caps",
  "Parisienne",
  "Passions Conflict",
  "Pattaya",
  "Petemoss",
  "Petit Formal Script",
  "Pinyon Script",
  "Puppies Play",
  "Qwigley",
  "Qwitcher Grypen",
  "Rochester",
  "Romanesco",
  "Rouge Script",
  "Ruthie",
  "Sacramento",
  "Sassy Frass",
  "Send Flowers",
  "Sofia",
  "Stalemate",
  "Style Script",
  "Tangerine",
  "The Nautigal",
  "Updock",
  "Waterfall",
  "Whisper",
  "WindSong",
  "Yesteryear",
] as const;

export type LogotypeFontName = (typeof LOGOTYPE_FONT_NAMES)[number];

export function normalizeLogotypeFontName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function resolveLogotypeFontName(value: string): LogotypeFontName | null {
  const normalized = normalizeLogotypeFontName(value);

  return (LOGOTYPE_FONT_NAMES as readonly string[]).includes(normalized)
    ? (normalized as LogotypeFontName)
    : null;
}

export function isLogotypeFontName(value: string): value is LogotypeFontName {
  return resolveLogotypeFontName(value) !== null;
}

export function buildLogotypeFontStylesheetUrl(fontName: string): string {
  const resolvedFontName = resolveLogotypeFontName(fontName) ?? normalizeLogotypeFontName(fontName);
  const encodedFontName = encodeURIComponent(resolvedFontName).replace(/%20/g, "+");

  return `https://${LOGOTYPE_FONT_PROVIDER}/css2?family=${encodedFontName}&display=swap`;
}