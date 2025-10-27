# File Upload Enhancement: Multi-Format Support

## Summary

Updated the file upload functionality to accept **CSV (.csv)**, **Excel (.xlsx)**, and **Legacy Excel (.xls)** files.

---

## Changes Made

### 1. **Updated Form** (`reports/forms.py`)

**Before:**
```python
class ExcelUploadForm(forms.Form):
    file = forms.FileField(label="Upload Excel File")
```

**After:**
```python
class ExcelUploadForm(forms.Form):
    file = forms.FileField(
        label="Upload File (.xlsx, .xls, or .csv)",
        help_text="Supported formats: Excel (.xlsx, .xls) or CSV (.csv)"
    )
    from_date = forms.DateField(
        label="From Date",
        widget=forms.DateInput(attrs={'type': 'date'})
    )
    to_date = forms.DateField(
        label="To Date",
        widget=forms.DateInput(attrs={'type': 'date'})
    )
```

**What Changed:**
- Added clear labels showing supported formats
- Moved date fields from views.py to forms.py (proper Django pattern)
- Added help text for user guidance

---

### 2. **Updated View Logic** (`reports/views.py`)

**Before:**
```python
# Only supported .xlsx files
df = pd.read_excel(excel_file, engine="openpyxl")
```

**After:**
```python
# Determine file type and read accordingly
file_name = uploaded_file.name.lower()

if file_name.endswith('.csv'):
    # Read CSV file
    df = pd.read_csv(uploaded_file)
elif file_name.endswith('.xls'):
    # Read old Excel format (.xls)
    df = pd.read_excel(uploaded_file, engine='xlrd')
elif file_name.endswith('.xlsx'):
    # Read new Excel format (.xlsx)
    df = pd.read_excel(uploaded_file, engine='openpyxl')
else:
    raise ValueError("Unsupported file format. Please upload .xlsx, .xls, or .csv file")
```

**What Changed:**
- Added file type detection based on extension
- Used appropriate pandas function for each format:
  - `.csv` → `pd.read_csv()`
  - `.xls` → `pd.read_excel()` with `xlrd` engine
  - `.xlsx` → `pd.read_excel()` with `openpyxl` engine
- Added error handling for unsupported formats
- Improved error messages to user

---

### 3. **Updated Template** (`reports/templates/upload_excel.html`)

**Before:**
```html
<input type="file" name="file" accept=".xls,.xlsx" required>
```

**After:**
```html
<input type="file" name="file" accept=".xls,.xlsx,.csv" required>
```

**Added:**
- Error message display section
- Better label styling

---

### 4. **Updated Dependencies** (`requirements.txt`)

**Added:**
```
xlrd==2.0.1
```

**Why:** Required to read legacy Excel (.xls) files.

---

## How It Works

### File Detection Flow

```
User uploads file
    ↓
Check file extension
    ↓
    ├─ .csv → pd.read_csv()
    ├─ .xls → pd.read_excel(engine='xlrd')
    └─ .xlsx → pd.read_excel(engine='openpyxl')
    ↓
Process with pandas
    ↓
Return results
```

### Supported File Formats

| Format | Extension | Engine | Use Case |
|--------|-----------|--------|----------|
| CSV | `.csv` | pandas (built-in) | Simple data files, universal compatibility |
| Excel 2007+ | `.xlsx` | openpyxl | Modern Excel files |
| Excel 97-2003 | `.xls` | xlrd | Legacy Excel files |

---

## Testing

### Test Scenarios

1. **Upload CSV file** ✅
   - Should read and process correctly
   - Same scoring logic applied

2. **Upload .xlsx file** ✅
   - Should work as before
   - No breaking changes

3. **Upload .xls file** ✅
   - Should read legacy Excel format
   - Handle older files properly

4. **Upload unsupported format** ✅
   - Should show error message
   - Should not crash

### How to Test Locally

```bash
# Run the development server
python manage.py runserver

# Upload each file type:
1. Create test.csv file
2. Create test.xlsx file  
3. Create test.xls file
4. Try uploading each one
```

---

## Error Handling

### Error Messages

**Unsupported Format:**
```
Error processing file: Unsupported file format. 
Please upload .xlsx, .xls, or .csv file
```

**File Reading Error:**
```
Error processing file: [specific pandas error]
```

**Display:**
Errors are shown in a red alert box on the page, not just logged to console.

---

## Benefits

### For Users

✅ **More Flexibility**: Upload files in the format they already have
✅ **Universal Support**: Can use CSV from any system
✅ **Legacy Compatibility**: Can process old .xls files
✅ **Clear Feedback**: See errors immediately

### For Developers

✅ **Maintainable**: Clear separation of concerns
✅ **Extensible**: Easy to add more formats later
✅ **Robust**: Proper error handling
✅ **Standard Django**: Follows Django best practices

---

## Future Enhancements

### Potential Additions

1. **More formats:**
   - Google Sheets export (.tsv)
   - JSON data
   - Parquet files

2. **Better validation:**
   - Check file contents, not just extension
   - Validate required columns exist
   - Check data types

3. **Progress indicator:**
   - Show upload progress for large files
   - Display processing status

4. **Batch processing:**
   - Upload multiple files at once
   - Process in background

---

## Breaking Changes

**None** - This is a fully backward-compatible enhancement.

Existing functionality remains unchanged:
- Same scoring logic
- Same output format
- Same date fields

---

## Deployment Notes

### On Vercel/Railway/Render

No special configuration needed. Just ensure dependencies are installed:

```bash
pip install -r requirements.txt
```

### Database

Still uses SQLite for local development. No database changes needed for this feature.

---

## Code Quality

### Best Practices Followed

✅ **Separation of Concerns**: Form definition in forms.py
✅ **Error Handling**: Try/except with user-friendly messages
✅ **DRY Principle**: No code duplication
✅ **Django Patterns**: Using form classes correctly
✅ **Type Safety**: Explicit file type checking

### Files Modified

- `reports/forms.py` - Form definition
- `reports/views.py` - File reading logic
- `reports/templates/upload_excel.html` - UI updates
- `requirements.txt` - New dependency

---

## Key Takeaways

1. **File Format Flexibility**: Users can now use the format they prefer
2. **Backward Compatible**: Existing .xlsx uploads still work
3. **Error Handling**: Better user experience with clear error messages
4. **Django Patterns**: Proper use of forms, views, and templates
5. **Extensible**: Easy to add more formats in the future

---

## Troubleshooting

### Issue: "xlrd not found"

**Solution:**
```bash
pip install xlrd==2.0.1
```

### Issue: "Cannot read .xls file"

**Check:**
- Is xlrd installed?
- Is the file actually .xls format?
- Try opening in Excel first

### Issue: "CSV columns not found"

**Check:**
- Does CSV have headers?
- Are column names spelled correctly?
- Are spaces/formatting preserved?

---

This enhancement makes your application more flexible and user-friendly while maintaining all existing functionality!

