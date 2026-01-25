export type ParsedSku = {
  original: string;
  skuNormalized: string;

  familyCode: string;
  familyName: string;
  productType: string;

  // Gloves / kits fields (when applicable)
  classCode?: string;      // "00" | "0" | "1" | "2" | "3" | "4"
  inches?: number;         // 11, 14, 16, 18, ...
  colorCode?: string;      // B, BR, RY, ...
  colorName?: string;      // Black, Black/Red, ...
  size?: string;           // 10, 10.5, etc.

  // General
  title: string;
  valid: boolean;
  error?: string;
};

const FAMILY_MAP: Record<string, { familyName: string; productType: string }> = {
  AA:  { familyName: "", productType: "Rubber " },
  AF:  { familyName: "ArmaFlex",        productType: "Rubber " },
  AAK: { familyName: "", productType: "Kit" },
  AFK: { familyName: "ArmaFlex",        productType: "Kit" },

  AALP:  { familyName: "Armadillo", productType: "Leather Protectors" },
  AACGB: { familyName: "Armadillo", productType: "Canvas Glove Bag" },
  AAGSB: { familyName: "Armadillo", productType: "Glove/Sleeve Combo Bag" },
  LS:    { familyName: "Armadillo", productType: "Logo Sticker" },
  AST:   { familyName: "Armadillo", productType: "Shotgun Stick" },
  ATHE:  { familyName: "Armadillo", productType: "Telescoping Hot Stick" },
  NGSAF: { familyName: "Armadillo", productType: "Air Freshener" },
};

const COLOR_MAP: Record<string, string> = {
  B:  "Black",
  R:  "Red",
  Y:  "Yellow",
  BR: "Black/Red",
  RY: "Red/Yellow",
  BY: "Black/Yellow",
  RB: "Red/Black",
  RR: "Red/Red",
  YY: "Yellow/Yellow",
  YR: "Yellow/Red",
  BB: "Black/Black",
};

/**
 * Exact "weird SKU" titles from the CSV for precision.
 * (These SKUs don't carry enough structure to reliably generate the full name.)
 */
const EXACT_SKU_TITLE_MAP: Record<string, string> = {
  // Leather Protectors
  AALP10: `Leather Protectors | 10"`,
  AALP14: `Leather Protectors | 14"`,

  // Glove bags
  AACGB12: `Canvas Glove Bag | 12"`,
  AACGB20: `Canvas Glove Bag | 20"`,
  AAGSB30: `Glove/Sleeve Combo Bag | 30`,

  // Stickers
  LS3:   `Logo Sticker | 3" x 3"`,
  LS4:   `Logo Sticker | 4" x 4"`,
  "LS5.5": `Logo Sticker | 5.5" x 5.5"`,
  LS15:  `Logo Sticker | 15" x 3.75"`,

  // Hot sticks (include hyphen)
  "AST-8":   `Shotgun Stick | 8'`,
  "ATHE-40": `Telescoping Hot Stick | 40'`,

  // Air freshener
  NGSAF: `New Glove Smell' Air Freshener`,
};

function normalizeSkuForLookup(input: string): string {
  return (input ?? "")
    .trim()
    .replace(/[–—]/g, "-")  // normalize dash types
    .replace(/\s+/g, "")    // remove all spaces
    .toUpperCase();
}

/**
 * Supports BOTH:
 *  - Compact: AA0011B10.5, AF216BR10, AAK0111B10, ...
 *  - Segmented: AA-00-11-B-10, AA - 00 - 11 - b - 10, ...
 */
function normalizeSkuForParsing(input: string): string {
  const s = normalizeSkuForLookup(input);

  // If segmented (contains "-"), try to rebuild to compact for glove patterns
  if (s.includes("-")) {
    const parts = s.split("-").filter(Boolean);
    // Expected: [family, class, inches, color, size]
    if (parts.length === 5) {
      const [fam, cls, inch, col, size] = parts;
      // Keep as compact (no separators)
      return `${fam}${cls}${inch}${col}${size}`;
    }
    return s; // e.g., AST-8, ATHE-40 should stay
  }

  return s;
}

export function parseSkuToProduct(input: string): ParsedSku {
  const original = input ?? "";
  const skuNormalized = normalizeSkuForLookup(original);

  // 1) Exact "weird SKU" match first
  if (EXACT_SKU_TITLE_MAP[skuNormalized]) {
    const familyCode =
      skuNormalized.startsWith("AST-") ? "AST" :
      skuNormalized.startsWith("ATHE-") ? "ATHE" :
      skuNormalized.match(/^[A-Z]+/)?.[0] ?? "";

    const fam = FAMILY_MAP[familyCode] ?? { familyName: "", productType: "" };

    return {
      original,
      skuNormalized,
      familyCode,
      familyName: fam.familyName,
      productType: fam.productType,
      title: EXACT_SKU_TITLE_MAP[skuNormalized],
      valid: true,
    };
  }

  // 2) Structured glove / kit parsing (AA/AF/AAK/AFK)
  const compact = normalizeSkuForParsing(original);

  // Family is leading letters
  const familyMatch = compact.match(/^([A-Z]+)(.*)$/);
  if (!familyMatch) {
    return {
      original,
      skuNormalized,
      familyCode: "",
      familyName: "",
      productType: "",
      title: `Unknown Product – SKU ${original}`,
      valid: false,
      error: "Could not read family code",
    };
  }

  const familyCode = familyMatch[1];
  const fam = FAMILY_MAP[familyCode];

  // Glove-like families
  if (familyCode === "AA" || familyCode === "AF" || familyCode === "AAK" || familyCode === "AFK") {
    // class = "00" or single digit 0-4
    // inches = 2 digits
    // color = 1-2 letters
    // size = number (can contain decimal)
    const gloveRe = /^(AAK|AFK|AA|AF)(00|[0-4])([0-9]{2})([A-Z]{1,2})([0-9]+(?:\.[0-9]+)?)$/;
    const m = compact.match(gloveRe);

    if (!m || !fam) {
      return {
        original,
        skuNormalized,
        familyCode,
        familyName: fam?.familyName ?? "",
        productType: fam?.productType ?? "",
        title: `Unknown Product | SKU ${original}`,
        valid: false,
        error: "Glove/KIT SKU did not match expected pattern",
      };
    }

    const classCode = m[2];          // "00" or "0-4"
    const inches = Number(m[3]);     // "11" -> 11
    const colorCode = m[4];          // B, BR, RY...
    const size = m[5];               // 10, 10.5

    const colorName = COLOR_MAP[colorCode] ?? colorCode;

    // Build product name, handling empty familyName
    const productName = `${fam.familyName} ${fam.productType}`.trim();
    const title = `${productName} · ${classCode} · ${inches}" · ${colorName} · Size ${size}`;

    return {
      original,
      skuNormalized,
      familyCode,
      familyName: fam.familyName,
      productType: fam.productType,
      classCode,
      inches,
      colorCode,
      colorName,
      size,
      title,
      valid: true,
    };
  }

  // 3) If it wasn't in EXACT map and isn't glove-like, return generic
  return {
    original,
    skuNormalized,
    familyCode,
    familyName: fam?.familyName ?? "",
    productType: fam?.productType ?? "",
    title: `Unknown Product | SKU ${original}`,
    valid: false,
    error: "Unrecognized SKU family or missing exact mapping",
  };
}
