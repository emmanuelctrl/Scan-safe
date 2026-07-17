// Spreadsheet import service.
//
// Parses an uploaded Excel (.xlsx) or CSV file into clean inventory rows.
// Column headers are matched flexibly (case-insensitive, punctuation-ignored)
// so real-world spreadsheets "just work" without forcing an exact template.
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { itemSchema } from '../validators/schemas.js';
import ApiError from '../utils/ApiError.js';

// Maps a normalised header -> our internal field name.
// Add more aliases here if your spreadsheets use different column names.
const HEADER_ALIASES = {
  barcode: 'barcode', code: 'barcode', upc: 'barcode', ean: 'barcode',
  qr: 'barcode', qrcode: 'barcode',

  name: 'name', item: 'name', itemname: 'name', product: 'name',
  productname: 'name', description: 'name', title: 'name',

  price: 'price', unitprice: 'price', cost: 'price', sellingprice: 'price',
  amount: 'price', retail: 'price',

  quantity: 'quantity', qty: 'quantity', stock: 'quantity', count: 'quantity',
  instock: 'quantity', onhand: 'quantity',

  lowstockat: 'low_stock_at', lowstock: 'low_stock_at', reorder: 'low_stock_at',
  reorderlevel: 'low_stock_at', reorderpoint: 'low_stock_at',
  threshold: 'low_stock_at', minstock: 'low_stock_at', min: 'low_stock_at',

  sku: 'sku', skucode: 'sku', ref: 'sku', reference: 'sku',

  category: 'category', categoryname: 'category', type: 'category',
  producttype: 'category', itemtype: 'category', group: 'category',
};

/** Normalise a header into lowercase alphanumerics only. */
function normaliseHeader(h) {
  return String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Turn an ExcelJS cell value into a plain string/number. */
function cellToPrimitive(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    if ('text' in value) return value.text; // hyperlink
    if ('result' in value) return value.result; // formula result
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    return String(value);
  }
  return value;
}

/** Strip currency symbols / thousands separators from a price-like string. */
function cleanNumber(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return cleaned === '' ? undefined : cleaned;
}

/**
 * Load the first worksheet from an uploaded file buffer.
 * @returns {Promise<ExcelJS.Worksheet>}
 */
async function loadWorksheet(buffer, filename) {
  const workbook = new ExcelJS.Workbook();
  const isCsv = /\.csv$/i.test(filename);

  if (isCsv) {
    // IMPORTANT: pass an identity `map` so ExcelJS does NOT auto-convert
    // numeric-looking cells. Barcodes/UPCs/EANs frequently have leading zeros
    // (e.g. "0001112223334") that would be lost if coerced to a Number.
    await workbook.csv.read(Readable.from(buffer), { map: (value) => value });
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw ApiError.badRequest(
      'The spreadsheet appears to be empty. Include a header row plus at least one item.'
    );
  }
  return worksheet;
}

/**
 * Parse an uploaded spreadsheet into validated inventory rows.
 *
 * @param {Buffer} buffer    Raw file contents.
 * @param {string} filename  Original filename (used to detect csv vs xlsx).
 * @returns {Promise<{ rows: object[], errors: {row:number,message:string}[] }>}
 */
export async function parseInventoryFile(buffer, filename) {
  const worksheet = await loadWorksheet(buffer, filename);

  // Build a map of column index -> field name from the header row.
  const headerRow = worksheet.getRow(1);
  const columnMap = {};
  headerRow.eachCell((cell, colNumber) => {
    const field = HEADER_ALIASES[normaliseHeader(cellToPrimitive(cell.value))];
    if (field) columnMap[colNumber] = field;
  });

  const mappedFields = new Set(Object.values(columnMap));
  if (!mappedFields.has('barcode') || !mappedFields.has('name')) {
    throw ApiError.badRequest(
      'Could not find required columns. Your spreadsheet needs at least "barcode" and "name" columns.'
    );
  }

  const rows = [];
  const errors = [];

  for (let r = 2; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    if (!row || row.actualCellCount === 0) continue; // skip blank rows

    // Assemble a raw record from the mapped columns.
    const raw = {};
    for (const [colNumber, field] of Object.entries(columnMap)) {
      raw[field] = cellToPrimitive(row.getCell(Number(colNumber)).value);
    }

    // Skip fully empty rows (no barcode and no name).
    if (!String(raw.barcode ?? '').trim() && !String(raw.name ?? '').trim()) continue;

    // Normalise numeric-ish fields before validation.
    const candidate = {
      barcode: String(raw.barcode ?? '').trim(),
      name: String(raw.name ?? '').trim(),
      price: cleanNumber(raw.price ?? 0) ?? 0,
      quantity: cleanNumber(raw.quantity ?? 0) ?? 0,
      low_stock_at: cleanNumber(raw.low_stock_at ?? 5) ?? 5,
      sku: raw.sku ? String(raw.sku).trim() : undefined,
      category: raw.category ? String(raw.category).trim() : undefined,
    };

    const result = itemSchema.safeParse(candidate);
    if (result.success) {
      rows.push(result.data);
    } else {
      errors.push({
        row: r,
        message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }
  }

  if (rows.length === 0) {
    throw ApiError.badRequest(
      'No valid items found in the spreadsheet. Check that each row has a barcode and name.',
      errors.slice(0, 20)
    );
  }

  return { rows, errors };
}
