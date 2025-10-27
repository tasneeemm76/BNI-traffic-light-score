# Dynamic Header Extraction & Metadata Parsing

## Summary

Updated the file upload system to:
1. ✅ **Read Excel files without assuming headers**
2. ✅ **Find the row where first cell equals "First Name"**
3. ✅ **Extract metadata (From/To dates) from rows before the header**
4. ✅ **Automatically use extracted dates or form dates**

---

## How It Works

### Excel File Structure Expected

```
Row 1: Report Title
Row 2: From: 2024-01-01
Row 3: To: 2024-03-31
Row 4: (empty row)
Row 5: First Name | Last Name | P | A | L | ...
Row 6: John      | Doe       | 5 | 2 | 1 | ...
Row 7: Jane      | Smith     | 8 | 1 | 0 | ...
...
```

### Processing Flow

```
1. Read entire file WITHOUT headers
   ↓
2. Search for row where first cell = "First Name"
   ↓
3. Extract metadata from rows ABOVE header
   ↓
4. Use "First Name" row as column headers
   ↓
5. Process data rows BELOW header
   ↓
6. Use extracted dates OR form dates for week calculation
```

---

## Key Features

### 1. Dynamic Header Detection

**Before:**
```python
# Assumed header was always row 0
df = pd.read_excel(file)
```

**After:**
```python
# Finds where header actually starts
df_raw = pd.read_excel(file, header=None)
header_row_idx = find_header_row(df_raw)  # Finds "First Name"
df.columns = df_raw.iloc[header_row_idx]
df = df_raw.iloc[header_row_idx + 1:]
```

### 2. Metadata Extraction

**Extracts from rows before header:**
- `From: 2024-01-01` → Extracts date
- `To: 2024-03-31` → Extracts date
- `Period: January - March` → Can be extended

**Pattern Matching:**
```python
# Looks for rows containing "from" or "to"
# Extracts text after colon ":"
# Supports multiple date formats
```

### 3. Flexible Date Input

**Priority Order:**
1. Form dates (if provided by user)
2. Extracted dates (from file metadata)
3. Default (1 week if neither available)

**Supported Date Formats:**
- `2024-01-01` (ISO format)
- `01/01/2024` (US format)
- `01/01/2024` (EU format)
- `2024-01-01 00:00:00` (with time)

---

## Code Changes

### `reports/views.py`

**Added Functions:**
- Read file without headers (`header=None`)
- Search for "First Name" header row
- Extract metadata from rows before header
- Parse multiple date formats
- Handle missing dates gracefully

**Key Code:**
```python
# Find header row
for idx, row in df_raw.iterrows():
    first_cell = str(row.iloc[0]).strip()
    if first_cell.lower() == "first name":
        header_row_idx = idx
        break

# Extract metadata
metadata_rows = df_raw.iloc[:header_row_idx]
for idx, row in metadata_rows.iterrows():
    row_str = ' '.join([str(cell) for cell in row if pd.notna(cell)])
    if 'from' in row_str.lower():
        from_date_extracted = extract_date(row_str)
    if 'to' in row_str.lower():
        to_date_extracted = extract_date(row_str)
```

### `reports/forms.py`

**Changes:**
- Made date fields optional (`required=False`)
- Added help text explaining extraction

### `reports/templates/upload_excel.html`

**Changes:**
- Removed `required` attribute from date inputs
- Added "(optional)" to labels

---

## Benefits

### For Users

✅ **Easier Upload**: Just upload the file - no need to manually enter dates
✅ **Flexible**: Can still override dates if needed
✅ **Smart**: Automatically finds where data starts
✅ **Forgiving**: Works with messy Excel files

### For Developers

✅ **Robust**: Handles various file structures
✅ **Flexible**: Multiple date format support
✅ **Maintainable**: Clear separation of concerns
✅ **Extensible**: Easy to add more metadata fields

---

## Testing

### Test Case 1: File with Metadata

**Input:**
```
Row 1: BNI Report
Row 2: From: 2024-01-01
Row 3: To: 2024-03-31
Row 4: 
Row 5: First Name | Last Name | P | A
Row 6: John       | Doe       | 5 | 2
```

**Expected:**
- ✅ Finds "First Name" at row 5
- ✅ Extracts From: 2024-01-01
- ✅ Extracts To: 2024-03-31
- ✅ Processes rows 6+ as data
- ✅ Calculates weeks correctly

### Test Case 2: Form Dates Override

**Input:**
- File has: From: 2024-01-01, To: 2024-03-31
- Form has: From: 2024-02-01, To: 2024-04-30

**Expected:**
- ✅ Uses form dates (2024-02-01 to 2024-04-30)
- ✅ Ignores file dates

### Test Case 3: No Dates in File

**Input:**
- File has no metadata rows
- Form dates empty

**Expected:**
- ✅ Uses default (1 week)
- ✅ Still processes data correctly

---

## Error Handling

### Missing Header

**Error:** `Could not find 'First Name' header in the file`

**Solution:** Ensure file has "First Name" in first column of header row

### No Dates Found

**Behavior:** Uses default of 1 week

**Result:** Scoring still works, but weekly metrics use 1 week

### Invalid Date Format

**Behavior:** Tries multiple formats, defaults to 1 week if all fail

**Result:** Application continues without crashing

---

## Supported Excel Structures

### Standard (with metadata)
```
Row 1-N: Metadata (dates, titles, etc.)
Row N+1: "First Name" header
Row N+2+: Data rows
```

### Minimal (no metadata)
```
Row 1: "First Name" header
Row 2+: Data rows
```

### Messy (with empty rows)
```
Row 1: Title
Row 2: From: date
Row 3: 
Row 4: To: date
Row 5: "First Name" header
Row 6+: Data rows
```

---

## Future Enhancements

### Potential Improvements

1. **More Metadata Fields:**
   - Chapter name
   - Report period
   - Generated date

2. **Header Detection Variants:**
   - "First Name" (current)
   - "firstName"
   - "FIRST NAME"
   - Variations with spaces/dashes

3. **Better Date Parsing:**
   - Recognize natural language dates
   - Handle different separators
   - Support relative dates

4. **Metadata Display:**
   - Show extracted dates to user
   - Allow edit before processing
   - Show metadata in results

---

## Troubleshooting

### "Could not find 'First Name' header"

**Cause:** Header row doesn't have "First Name" in first cell

**Fix:** Ensure first column of header row contains "First Name"

### Dates not extracted

**Cause:** Metadata format doesn't match expected pattern

**Fix:** Ensure metadata has "From:" and "To:" with colons

### Wrong date format

**Cause:** Date format not supported

**Fix:** Supported formats:
- `YYYY-MM-DD`
- `MM/DD/YYYY`
- `DD/MM/YYYY`

---

## Key Takeaways

1. **Dynamic Detection**: Finds where data actually starts
2. **Metadata Extraction**: Pulls dates from file automatically
3. **Flexible Input**: Form dates or file dates both work
4. **Robust Handling**: Gracefully handles missing data
5. **User Friendly**: Less manual entry required

---

## Example Excel File

```excel
A               | B
----------------|----------------
BNI Report      |
Period Start    | 2024-01-01
Period End      | 2024-03-31
                |
First Name      | Last Name | P | A | L | ...
John            | Doe       | 5 | 2 | 1 | ...
Jane            | Smith     | 8 | 1 | 0 | ...
```

**This will:**
- Find "First Name" at row 5
- Extract "2024-01-01" and "2024-03-31"
- Use rows 6+ for data
- Calculate 12.57 weeks automatically

---

This enhancement makes your application much more flexible and user-friendly! 🎉

