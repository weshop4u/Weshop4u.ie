/**
 * CSV Parser for bulk price updates
 * Parses CSV format: Store,Product (with size),Price
 * Example: Spar,Tunnock's Teacakes 6pk,3.49
 */

export interface ParsedPriceUpdate {
  store: string;
  productName: string;
  price: number;
  rawLine: string;
}

export interface ParseError {
  line: number;
  rawLine: string;
  error: string;
}

export interface ParseResult {
  updates: ParsedPriceUpdate[];
  errors: ParseError[];
}

/**
 * Parse CSV text into price updates
 * Handles quoted fields and various delimiters
 */
export function parseCSVPrices(csvText: string): ParseResult {
  const lines = csvText.trim().split("\n");
  const updates: ParsedPriceUpdate[] = [];
  const errors: ParseError[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) return;

    // Skip header row if it exists
    if (trimmed.toLowerCase().includes("store") && trimmed.toLowerCase().includes("product")) {
      return;
    }

    try {
      const parsed = parseCSVLine(trimmed);

      if (!parsed.store || !parsed.productName || parsed.price === null) {
        errors.push({
          line: lineNumber,
          rawLine: trimmed,
          error: "Missing required fields (Store, Product, Price)",
        });
        return;
      }

      if (isNaN(parsed.price) || parsed.price < 0) {
        errors.push({
          line: lineNumber,
          rawLine: trimmed,
          error: `Invalid price: ${parsed.price}`,
        });
        return;
      }

      updates.push({
        store: parsed.store.trim(),
        productName: parsed.productName.trim(),
        price: parseFloat(parsed.price.toFixed(2)),
        rawLine: trimmed,
      });
    } catch (error: any) {
      errors.push({
        line: lineNumber,
        rawLine: trimmed,
        error: error.message || "Failed to parse line",
      });
    }
  });

  return { updates, errors };
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): { store: string | null; productName: string | null; price: number | null } {
  const fields = parseCSVFields(line);

  if (fields.length < 3) {
    throw new Error(`Expected 3 fields, got ${fields.length}`);
  }

  const store = fields[0];
  const productName = fields[1];
  const priceStr = fields[2];

  // Parse price - handle both "3.49" and "€3.49" formats
  const priceMatch = priceStr.match(/[\d.]+/);
  const price = priceMatch ? parseFloat(priceMatch[0]) : null;

  return { store, productName, price };
}

/**
 * Split CSV line by commas, respecting quoted fields
 */
function parseCSVFields(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  fields.push(current);

  return fields.map(f => f.replace(/^"|"$/g, "").trim()); // Remove surrounding quotes
}

/**
 * Fuzzy match product name to database products
 * Returns confidence score (0-1)
 */
export function fuzzyMatchProduct(
  searchName: string,
  dbProductName: string
): number {
  const search = searchName.toLowerCase().trim();
  const db = dbProductName.toLowerCase().trim();

  // Exact match
  if (search === db) return 1.0;

  // Substring match (one contains the other)
  if (search.includes(db) || db.includes(search)) return 0.9;

  // Levenshtein distance based matching
  const distance = levenshteinDistance(search, db);
  const maxLen = Math.max(search.length, db.length);
  const similarity = 1 - distance / maxLen;

  // Only return if similarity is high enough
  return similarity > 0.7 ? similarity : 0;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
