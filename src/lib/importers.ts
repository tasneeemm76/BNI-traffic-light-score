import Papa from "papaparse";
import ExcelJS from "exceljs";
import { ignoredMemberNames, mainReportRowSchema, trainingRowSchema, type MainReportRow, type TrainingRow } from "./validators";

type RawRow = Record<string, unknown>;
type RowArray = (string | number | boolean | null | undefined)[];

const MAIN_HEADER_MAP: Record<string, keyof MainReportRow> = {
  member: "memberName",
  membername: "memberName",
  name: "memberName",
  chapter: "chapter",
  month: "period",
  period: "period",
  p: "p",
  a: "a",
  l: "l",
  m: "m",
  s: "s",
  rgi: "rgi",
  rgo: "rgo",
  rri: "rri",
  rro: "rro",
  rg: "rgo",
  visitors: "v",
  v: "v",
  testimonials: "t",
  t: "t",
  "1-2-1": "oneTwoOne",
  "121": "oneTwoOne",
  "1-2-1s": "oneTwoOne",
  tyfcb: "tyfcb",
  business: "tyfcb",
  ceu: "ceu",
};

const TRAINING_HEADER_KEYS = ["first", "first name", "first_name"];
const TRAINING_LAST_KEYS = ["last", "last name", "last_name"];

const normalizeMemberName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const shouldIgnoreMember = (name: string) => {
  const normalized = normalizeMemberName(name);
  return ignoredMemberNames.some((term) => normalized === term || normalized.includes(term));
};

const normalizeMainRow = (row: RawRow): MainReportRow | null => {
  const normalized: Record<string, unknown> = {};
  let firstName: string | undefined;
  let lastName: string | undefined;
  let memberNameFromColumn: string | undefined;
  
  for (const [key, value] of Object.entries(row)) {
    // Ensure key is a string before calling string methods
    const keyStr = String(key ?? "").trim();
    if (!keyStr) continue;
    const lookupKey = safeToLowerCase(keyStr);
    
    // Handle First Name and Last Name separately
    if (lookupKey === "first name" || lookupKey === "firstname" || lookupKey === "first") {
      firstName = value != null ? String(value).trim() : undefined;
      continue;
    }
    if (lookupKey === "last name" || lookupKey === "lastname" || lookupKey === "last") {
      lastName = value != null ? String(value).trim() : undefined;
      continue;
    }
    
    // Check if there's a direct member/name column
    if (lookupKey === "member" || lookupKey === "membername" || lookupKey === "name") {
      if (value != null) {
        memberNameFromColumn = String(value).trim();
      }
      // Don't continue - also map it to memberName
    }
    
    const mapped = MAIN_HEADER_MAP[lookupKey];
    if (mapped) {
      normalized[mapped] = value;
    }
  }
  
  // Priority: Use combined First Name + Last Name, or use member/name column, or use already mapped memberName
  if (firstName || lastName) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (fullName) {
      normalized.memberName = fullName;
    }
  } else if (memberNameFromColumn) {
    normalized.memberName = memberNameFromColumn;
  }
  
  // If no memberName found, skip this row
  if (!normalized.memberName) {
    return null;
  }
  
  const memberNameStr = String(normalized.memberName).trim();
  if (!memberNameStr || shouldIgnoreMember(memberNameStr)) {
    return null;
  }
  
  try {
    return mainReportRowSchema.parse(normalized);
  } catch (error) {
    // Log validation errors for debugging but don't crash
    console.warn("Row validation failed:", error, "Row data:", normalized);
    return null;
  }
};

const parseCsv = <T>(
  buffer: Buffer,
  mapper: (row: RawRow) => T | null,
  options?: Papa.ParseConfig<RawRow>
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(buffer.toString("utf-8"), {
      header: true,
      skipEmptyLines: true,
      ...options,
      complete: (results) => {
        try {
          const rows = (results.data as RawRow[])
            .map(mapper)
            .filter((row): row is T => Boolean(row));
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
};

const safeToLowerCase = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value.toLowerCase().trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase().trim();
  }
  // For objects, dates, etc., convert to string first
  try {
    const str = String(value);
    return typeof str === "string" ? str.toLowerCase().trim() : "";
  } catch {
    return "";
  }
};

const findMainHeaderRowIndex = (rows: (string | number | boolean | null | undefined)[][]): number => {
  // Metadata-only columns that should NOT be considered as the data header
  const metadataOnlyColumns = ["running user", "run at", "country", "region", "parameters", "from", "to", "show", "events", "flags"];
  
  // Data table indicators - these must be present for it to be the real header
  const dataTableIndicators = ["first name", "last name", "member", "name"];
  
  // Numeric/metric columns that indicate this is the data table
  const metricColumns = ["p", "a", "l", "m", "s", "rgi", "rgo", "rri", "rro", "v", "t", "1-2-1", "121", "tyfcb", "ceu"];
  
  for (let i = 0; i < rows.length; i++) {
    const candidate = rows[i].map((cell) => safeToLowerCase(cell));
    
    // Skip rows that are clearly metadata-only
    const hasMetadataOnly = candidate.some((cell) => 
      typeof cell === "string" && metadataOnlyColumns.some((meta) => cell.includes(meta))
    );
    
    // Check for member/name columns (required for data table)
    const hasMemberColumn = candidate.some((cell) => 
      typeof cell === "string" && dataTableIndicators.some((indicator) => cell.includes(indicator))
    );
    
    // Check for metric columns (strong indicator of data table)
    const hasMetricColumns = candidate.filter((cell) => 
      typeof cell === "string" && metricColumns.some((metric) => cell === metric || cell.includes(metric))
    );
    
    // This is the data table header if:
    // 1. It has a member/name column AND
    // 2. It has at least 2 metric columns AND
    // 3. It's not just metadata columns
    if (hasMemberColumn && hasMetricColumns.length >= 2 && !hasMetadataOnly) {
      return i;
    }
    
    // Fallback: if it has member column and at least one metric, it might be the header
    // (but prioritize rows with more metrics)
    if (hasMemberColumn && hasMetricColumns.length >= 1 && !hasMetadataOnly) {
      // Continue searching for a better match, but remember this one
      // We'll use the first good match if we don't find a better one
    }
  }
  
  // If we didn't find a clear match, try a more lenient search
  for (let i = 0; i < rows.length; i++) {
    const candidate = rows[i].map((cell) => safeToLowerCase(cell));
    const hasMemberColumn = candidate.some((cell) => 
      typeof cell === "string" && dataTableIndicators.some((indicator) => cell.includes(indicator))
    );
    const hasMetricColumns = candidate.filter((cell) => 
      typeof cell === "string" && metricColumns.some((metric) => cell === metric || cell.includes(metric))
    );
    
    if (hasMemberColumn && hasMetricColumns.length >= 1) {
      return i;
    }
  }
  
  return 0; // Fallback to first row if no header found
};

const parseWorkbook = async <T>(buffer: Buffer, mapper: (row: RawRow) => T | null): Promise<T[]> => {
  // Limit file size to 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds maximum allowed size of 10MB");
  }
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  
  // Convert worksheet to row arrays
  const rowArrays: RowArray[] = [];
  worksheet.eachRow((row, rowNumber) => {
    const rowData: RowArray = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) {
        rowData.push(null);
      } else if (typeof value === 'object' && 'text' in value) {
        rowData.push((value as { text: string }).text);
      } else {
        rowData.push(value as string | number | boolean);
      }
    });
    rowArrays.push(rowData);
  });
  
  // Find the actual header row index
  const headerRowIndex = findMainHeaderRowIndex(rowArrays);
  
  if (headerRowIndex >= rowArrays.length) {
    return [];
  }
  
  // Get the header row and normalize it
  const headerRow = rowArrays[headerRowIndex].map((cell) => {
    if (cell == null) return "";
    if (typeof cell === "string") return cell.trim();
    if (typeof cell === "number" || typeof cell === "boolean") return String(cell).trim();
    return String(cell ?? "").trim();
  });
  
  // Convert remaining rows to objects using the header row
  const dataRows = rowArrays.slice(headerRowIndex + 1);
  const json: RawRow[] = dataRows.map((row) => {
    const obj: RawRow = {};
    headerRow.forEach((header, index) => {
      const value = row[index];
      if (value != null) {
        // Convert numbers to numbers, keep strings as strings
        if (typeof value === "number") {
          obj[header] = value;
        } else if (typeof value === "boolean") {
          obj[header] = value;
        } else {
          // Try to parse as number if it looks like one
          const strValue = String(value).trim();
          if (strValue && !isNaN(Number(strValue)) && strValue !== "") {
            const numValue = Number(strValue);
            // Only convert if it's a valid number and not NaN
            if (!isNaN(numValue)) {
              obj[header] = numValue;
            } else {
              obj[header] = strValue;
            }
          } else {
            obj[header] = strValue;
          }
        }
      }
    });
    return obj;
  });
  
  return json.map(mapper).filter((row): row is T => Boolean(row));
};

export async function parseMainReport(buffer: Buffer, fileName: string): Promise<ParseMainReportResult> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const rows = await parseCsv(buffer, normalizeMainRow);
    return { rows, metadata: {} };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return await parseWorkbookWithMetadata(buffer, normalizeMainRow);
  }
  throw new Error("Unsupported file type for main report. Upload .csv or .xlsx");
}

const findTrainingHeaderRowIndex = (rows: RowArray[]): number => {
  for (let i = 0; i < rows.length; i++) {
    const candidate = rows[i].map((cell) => safeToLowerCase(cell));
    const hasFirst = candidate.some((cell) => typeof cell === "string" && TRAINING_HEADER_KEYS.includes(cell));
    const hasLast = candidate.some((cell) => typeof cell === "string" && TRAINING_LAST_KEYS.includes(cell));
    if (hasFirst && hasLast) {
      return i;
    }
  }
  return -1;
};

const toRowArraysFromCsv = (buffer: Buffer): Promise<RowArray[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<RowArray>(buffer.toString("utf-8"), {
      header: false,
      skipEmptyLines: "greedy",
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });

const toRowArraysFromWorkbook = async (buffer: Buffer): Promise<RowArray[]> => {
  // Limit file size to 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds maximum allowed size of 10MB");
  }
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  
  const rawRows: RowArray[] = [];
  worksheet.eachRow((row) => {
    const rowData: RowArray = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) {
        rowData.push(null);
      } else if (typeof value === 'object' && 'text' in value) {
        rowData.push((value as { text: string }).text);
      } else {
        rowData.push(value as string | number | boolean);
      }
    });
    rawRows.push(rowData);
  });
  // Convert all cells to strings for consistency
  return rawRows.map((row) => 
    row.map((cell) => {
      if (cell == null) return "";
      return String(cell);
    })
  );
};

const normalizeTrainingRows = (rows: RowArray[], headerIndex: number): TrainingRow[] => {
  const headerRow = rows[headerIndex].map((cell) => safeToLowerCase(cell));
  const firstIndex = headerRow.findIndex((cell) => typeof cell === "string" && TRAINING_HEADER_KEYS.includes(cell));
  const lastIndex = headerRow.findIndex((cell) => typeof cell === "string" && TRAINING_LAST_KEYS.includes(cell));

  // Validate that First Name and Last Name columns exist
  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error("Training report missing first/last name columns. The file must contain 'First Name' and 'Last Name' columns.");
  }

  // Count trainings per member - each row represents one training event
  const trainingCounts = new Map<string, { firstName: string; lastName: string; count: number }>();

  for (const row of rows.slice(headerIndex + 1)) {
    const firstName = String(row[firstIndex] ?? "").trim();
    const lastName = String(row[lastIndex] ?? "").trim();
    
    // Skip empty rows
    if (!firstName || !lastName) {
      continue;
    }

    const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
    const existing = trainingCounts.get(key);
    
    if (existing) {
      existing.count += 1;
    } else {
      trainingCounts.set(key, { firstName, lastName, count: 1 });
    }
  }

  // Convert to TrainingRow format
  return Array.from(trainingCounts.values())
    .map(({ firstName, lastName, count }) => {
      return trainingRowSchema.parse({
        firstName,
        lastName,
        credits: count,
      });
    })
    .filter((row): row is TrainingRow => Boolean(row));
};

export type ParseTrainingReportResult = {
  rows: TrainingRow[];
  metadata: ReportMetadata;
};

export async function parseTrainingReport(buffer: Buffer, fileName: string): Promise<ParseTrainingReportResult> {
  const lower = fileName.toLowerCase();
  let rowArrays: RowArray[];

  // Try Excel first, then fall back to CSV
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    try {
      rowArrays = await toRowArraysFromWorkbook(buffer);
    } catch (error) {
      // If Excel fails, try as CSV
      console.warn("Failed to parse as Excel, trying CSV:", error);
      rowArrays = await toRowArraysFromCsv(buffer);
    }
  } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    rowArrays = await toRowArraysFromCsv(buffer);
  } else {
    // Try Excel first, then CSV
    try {
      rowArrays = await toRowArraysFromWorkbook(buffer);
    } catch (error) {
      console.warn("Failed to parse as Excel, trying CSV:", error);
      rowArrays = await toRowArraysFromCsv(buffer);
    }
  }

  // Find the header row index
  const headerIndex = findTrainingHeaderRowIndex(rowArrays);
  if (headerIndex === -1) {
    throw new Error("Unable to detect header row in training report. The file must contain 'First Name' and 'Last Name' columns.");
  }

  // Extract metadata from rows before the header
  const metadata = extractMetadata(rowArrays, headerIndex);

  // Normalize and count training rows
  const rows = normalizeTrainingRows(rowArrays, headerIndex);

  return { rows, metadata };
}

export function normalizePersonKey(firstName: string, lastName: string) {
  return normalizeMemberName(`${firstName} ${lastName}`);
}

export type ReportMetadata = {
  chapter?: string;
  fromDate?: Date;
  toDate?: Date;
};

// Convert Excel serial number to JavaScript Date
// Excel serial numbers start from January 1, 1900 (serial number 1)
const excelSerialToDate = (serial: number): Date => {
  // Excel's epoch is January 1, 1900 (but Excel incorrectly treats 1900 as leap year)
  // For dates after 1900, we can use: Date(1900, 0, 1) + (serial - 1) days
  // But to be more accurate, we use: Date(1900, 0, 1) + (serial - 2) days
  // because Excel has a bug where it treats 1900 as a leap year
  const excelEpoch = new Date(1900, 0, 1);
  const days = serial - 2; // Subtract 2 because Excel incorrectly treats 1900 as leap year
  const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  return date;
};

const parseDateFromFormat = (dateStr: string | number): Date | undefined => {
  // Handle Excel serial numbers (if passed as number)
  if (typeof dateStr === "number") {
    // Excel serial numbers are typically between 1 and ~50000 (covers 1900-2137)
    if (dateStr >= 1 && dateStr <= 100000) {
      try {
        const date = excelSerialToDate(dateStr);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
          console.log(`Converted Excel serial ${dateStr} to date: ${date.toISOString()}`);
          return date;
        }
      } catch (e) {
        console.log(`Failed to convert Excel serial ${dateStr}:`, e);
      }
    }
    return undefined;
  }
  
  if (!dateStr || typeof dateStr !== "string") return undefined;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;
  
  // Check if it's a numeric string that could be an Excel serial number
  const numericMatch = trimmed.match(/^\d+$/);
  if (numericMatch) {
    const num = parseInt(trimmed, 10);
    // Excel serial numbers are typically between 1 and ~50000
    if (num >= 1 && num <= 100000) {
      try {
        const date = excelSerialToDate(num);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
          console.log(`Converted numeric string "${trimmed}" (Excel serial) to date: ${date.toISOString()}`);
          return date;
        }
      } catch (e) {
        console.log(`Failed to convert numeric string "${trimmed}" as Excel serial:`, e);
      }
    }
    // If it's a large number that doesn't look like an Excel serial, don't try to parse it
    if (num > 100000) {
      console.log(`Large number "${trimmed}" doesn't look like an Excel serial, skipping`);
      return undefined;
    }
  }
  
  // Try DD-MM-YY format (e.g., "01-12-24", "31-05-25")
  const ddmmyyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (ddmmyyMatch) {
    const [, day, month, year] = ddmmyyMatch;
    let fullYear: number;
    
    if (year.length === 2) {
      // Two-digit year: assume 2000-2099 range
      const yearNum = parseInt(year, 10);
      fullYear = 2000 + yearNum;
      // Handle years 00-30 as 2000-2030, 31-99 as 1931-1999
      if (yearNum > 30) {
        fullYear = 1900 + yearNum;
      }
    } else {
      // Four-digit year
      fullYear = parseInt(year, 10);
    }
    
    const monthIndex = parseInt(month, 10) - 1;
    const dayNum = parseInt(day, 10);
    
    console.log(`Parsing date "${trimmed}": day=${day}, month=${month}, year=${year} -> fullYear=${fullYear}, monthIndex=${monthIndex}, dayNum=${dayNum}`);
    
    // Validate year is in reasonable range
    if (fullYear < 1900 || fullYear > 2100) {
      console.log(`Year ${fullYear} is out of reasonable range (1900-2100) for "${trimmed}"`);
      return undefined;
    }
    
    // Validate month and day
    if (monthIndex < 0 || monthIndex >= 12) {
      console.log(`Invalid month index ${monthIndex} from "${trimmed}"`);
      return undefined;
    }
    
    if (dayNum < 1 || dayNum > 31) {
      console.log(`Invalid day ${dayNum} from "${trimmed}"`);
      return undefined;
    }
    
    // Create date and validate it
    const date = new Date(Date.UTC(fullYear, monthIndex, dayNum));
    
    // Double-check the date is valid and matches what we expect
    if (isNaN(date.getTime())) {
      console.log(`Invalid date created from "${trimmed}"`);
      return undefined;
    }
    
    // Verify the date components match (handles invalid dates like Feb 30)
    if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== dayNum) {
      console.log(`Date "${trimmed}" parsed but components don't match (invalid date like Feb 30)`);
      return undefined;
    }
    
    // Final check: year should still be in reasonable range
    if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) {
      console.log(`Parsed date has invalid year ${date.getUTCFullYear()} from "${trimmed}"`);
      return undefined;
    }
    
    console.log(`Successfully parsed date "${trimmed}" -> ${date.toISOString()}`);
    return date;
  } else {
    console.log(`Date string "${trimmed}" did not match DD-MM-YY pattern`);
  }
  
  // Try parsing as standard date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    console.log(`Parsed "${trimmed}" as standard date -> ${parsed.toISOString()}`);
    return parsed;
  }
  
  console.log(`Could not parse date string: "${trimmed}"`);
  return undefined;
};

const extractMetadata = (
  rows: (string | number | boolean | null | undefined)[][],
  headerRowIndex: number
): ReportMetadata => {
  const metadata: ReportMetadata = {};
  
  // Only look in rows before the header row
  const metadataRows = rows.slice(0, headerRowIndex);
  
  console.log(`Extracting metadata from ${metadataRows.length} rows before header row ${headerRowIndex}`);
  
  for (let rowIdx = 0; rowIdx < metadataRows.length; rowIdx++) {
    const row = metadataRows[rowIdx];
    // Convert row to string array for searching
    const rowStrings = row.map((cell) => {
      if (cell == null) return "";
      return String(cell).trim();
    });
    
    // Join all cells to search for patterns - use safe conversion
    const rowText = rowStrings.join(" ");
    const rowTextLower = safeToLowerCase(rowText);
    
    // Log row content for debugging
    if (rowTextLower.includes("from:") || rowTextLower.includes("to:")) {
      console.log(`Metadata row ${rowIdx}:`, rowStrings);
    }
    
    // Look for Chapter: pattern
    if (rowTextLower.includes("chapter:")) {
      for (let i = 0; i < rowStrings.length; i++) {
        const cell = safeToLowerCase(rowStrings[i]);
        if (cell.includes("chapter:")) {
          // Get the value after "Chapter:"
          const afterColon = rowStrings[i].split(/:/i)[1]?.trim();
          if (afterColon) {
            metadata.chapter = afterColon;
          } else if (i + 1 < rowStrings.length && rowStrings[i + 1]) {
            // Value might be in next cell
            metadata.chapter = rowStrings[i + 1].trim();
          }
          break;
        }
      }
    }
    
    // Look for From: pattern
    if (rowTextLower.includes("from:")) {
      // Search all cells in this row for a date (in case "From:" and date are far apart)
      let foundFromLabel = false;
      for (let i = 0; i < rowStrings.length; i++) {
        const cell = safeToLowerCase(rowStrings[i]);
        if (cell.includes("from:")) {
          foundFromLabel = true;
          // Try to get date from same cell (after colon)
          const afterColon = rowStrings[i].split(/:/i)[1]?.trim();
          if (afterColon) {
            const parsed = parseDateFromFormat(afterColon);
            if (parsed) {
              metadata.fromDate = parsed;
              console.log(`Extracted fromDate from same cell: "${afterColon}" -> ${parsed.toISOString()}`);
              break;
            }
          }
        }
      }
      
      // If we found "From:" label but didn't extract date yet, search all cells in this row for a date
      // Check both string values and raw numeric values (Excel serial numbers)
      if (foundFromLabel && !metadata.fromDate) {
        for (let i = 0; i < rowStrings.length; i++) {
          const cell = rowStrings[i]?.trim();
          if (cell && !safeToLowerCase(cell).includes("from:")) {
            // Try parsing as string first
            let parsed = parseDateFromFormat(cell);
            // If that fails and cell is numeric, try parsing the raw numeric value
            if (!parsed && !isNaN(Number(cell))) {
              parsed = parseDateFromFormat(Number(cell));
            }
            if (parsed) {
              metadata.fromDate = parsed;
              console.log(`Extracted fromDate from row cell[${i}]: "${cell}" -> ${parsed.toISOString()}`);
              break;
            }
          }
        }
        // Also check raw row values for Excel serial numbers
        if (!metadata.fromDate) {
          for (let i = 0; i < row.length; i++) {
            const rawCell = row[i];
            if (typeof rawCell === "number" && rawCell >= 1 && rawCell <= 100000) {
              const parsed = parseDateFromFormat(rawCell);
              if (parsed) {
                metadata.fromDate = parsed;
                console.log(`Extracted fromDate from raw numeric cell[${i}]: ${rawCell} -> ${parsed.toISOString()}`);
                break;
              }
            }
          }
        }
      }
    }
    
    // Look for To: pattern
    if (rowTextLower.includes("to:")) {
      // Search all cells in this row for a date (in case "To:" and date are far apart)
      let foundToLabel = false;
      for (let i = 0; i < rowStrings.length; i++) {
        const cell = safeToLowerCase(rowStrings[i]);
        if (cell.includes("to:")) {
          foundToLabel = true;
          // Try to get date from same cell (after colon)
          const afterColon = rowStrings[i].split(/:/i)[1]?.trim();
          if (afterColon) {
            const parsed = parseDateFromFormat(afterColon);
            if (parsed) {
              metadata.toDate = parsed;
              console.log(`Extracted toDate from same cell: "${afterColon}" -> ${parsed.toISOString()}`);
              break;
            }
          }
        }
      }
      
      // If we found "To:" label but didn't extract date yet, search all cells in this row for a date
      // Check both string values and raw numeric values (Excel serial numbers)
      if (foundToLabel && !metadata.toDate) {
        for (let i = 0; i < rowStrings.length; i++) {
          const cell = rowStrings[i]?.trim();
          if (cell && !safeToLowerCase(cell).includes("to:")) {
            // Try parsing as string first
            let parsed = parseDateFromFormat(cell);
            // If that fails and cell is numeric, try parsing the raw numeric value
            if (!parsed && !isNaN(Number(cell))) {
              parsed = parseDateFromFormat(Number(cell));
            }
            if (parsed) {
              metadata.toDate = parsed;
              console.log(`Extracted toDate from row cell[${i}]: "${cell}" -> ${parsed.toISOString()}`);
              break;
            }
          }
        }
        // Also check raw row values for Excel serial numbers
        if (!metadata.toDate) {
          for (let i = 0; i < row.length; i++) {
            const rawCell = row[i];
            if (typeof rawCell === "number" && rawCell >= 1 && rawCell <= 100000) {
              const parsed = parseDateFromFormat(rawCell);
              if (parsed) {
                metadata.toDate = parsed;
                console.log(`Extracted toDate from raw numeric cell[${i}]: ${rawCell} -> ${parsed.toISOString()}`);
                break;
              }
            }
          }
        }
      }
    }
  }
  
  return metadata;
};

export type ParseMainReportResult = {
  rows: MainReportRow[];
  metadata: ReportMetadata;
};

const parseWorkbookWithMetadata = async (
  buffer: Buffer,
  mapper: (row: RawRow) => MainReportRow | null
): Promise<ParseMainReportResult> => {
  // Limit file size to 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds maximum allowed size of 10MB");
  }
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  
  // Convert worksheet to row arrays
  const rowArrays: RowArray[] = [];
  worksheet.eachRow((row) => {
    const rowData: RowArray = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) {
        rowData.push(null);
      } else if (typeof value === 'object' && 'text' in value) {
        rowData.push((value as { text: string }).text);
      } else {
        rowData.push(value as string | number | boolean);
      }
    });
    rowArrays.push(rowData);
  });
  
  if (rowArrays.length === 0) {
    return { rows: [], metadata: {} };
  }
  
  // Find the actual header row index
  const headerRowIndex = findMainHeaderRowIndex(rowArrays);
  
  // Extract metadata from rows before the header
  const metadata = extractMetadata(rowArrays, headerRowIndex);
  
  if (headerRowIndex >= rowArrays.length) {
    return { rows: [], metadata };
  }
  
  // Get the header row and normalize it
  const headerRow = rowArrays[headerRowIndex].map((cell) => {
    if (cell == null) return "";
    if (typeof cell === "string") return cell.trim();
    if (typeof cell === "number" || typeof cell === "boolean") return String(cell).trim();
    return String(cell ?? "").trim();
  });
  
  // Debug: Log header row to help diagnose issues
  console.log("Detected header row:", headerRow);
  
  // Convert remaining rows to objects using the header row
  const dataRows = rowArrays.slice(headerRowIndex + 1);
  const json: RawRow[] = dataRows
    .filter((row) => {
      // Filter out completely empty rows
      return row.some((cell) => cell != null && String(cell).trim() !== "");
    })
    .map((row) => {
      const obj: RawRow = {};
      headerRow.forEach((header, index) => {
        const value = row[index];
        if (value != null) {
          // Convert numbers to numbers, keep strings as strings
          if (typeof value === "number") {
            obj[header] = value;
          } else if (typeof value === "boolean") {
            obj[header] = value;
          } else {
            // Try to parse as number if it looks like one
            const strValue = String(value).trim();
            if (strValue && !isNaN(Number(strValue)) && strValue !== "") {
              const numValue = Number(strValue);
              // Only convert if it's a valid number and not NaN
              if (!isNaN(numValue)) {
                obj[header] = numValue;
              } else {
                obj[header] = strValue;
              }
            } else {
              obj[header] = strValue;
            }
          }
        }
      });
      return obj;
    });
  
  // Debug: Log sample of parsed rows
  if (json.length > 0) {
    console.log("Sample parsed row (first):", json[0]);
    console.log(`Total rows parsed: ${json.length}`);
  } else {
    console.warn("No data rows found after header row. Header row index:", headerRowIndex, "Total rows:", rowArrays.length);
  }
  
  const rows = json.map(mapper).filter((row): row is MainReportRow => Boolean(row));
  
  // Debug: Log how many rows passed validation
  console.log(`Valid member rows after filtering: ${rows.length}`);
  if (rows.length === 0 && json.length > 0) {
    console.warn("Rows were parsed but none passed validation. Sample row that failed:", json[0]);
    // Try to understand why - check if memberName was extracted
    const sampleNormalized = mapper(json[0]);
    console.warn("Sample normalized row:", sampleNormalized);
  }
  
  return { rows, metadata };
};

