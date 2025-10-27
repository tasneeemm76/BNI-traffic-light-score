# Quick Fix: xlrd Installation

## Issue Resolved ✅

**Error:** `Missing optional dependency 'xlrd'`

**Solution:** Installed `xlrd==2.0.1` successfully

---

## What Happened

### The Problem
When you tried to upload a `.xls` file, pandas couldn't read it because the `xlrd` library wasn't installed.

### The Solution
```bash
pip install xlrd==2.0.1
```

This dependency was already in `requirements.txt`, but it wasn't installed in your local environment yet.

---

## Testing

### 1. Local Testing (Now Active)

The Django server is running. Test it:

1. Open your browser: `http://127.0.0.1:8000/upload-excel/`
2. Try uploading:
   - ✅ CSV file (.csv)
   - ✅ Excel 2007+ file (.xlsx)
   - ✅ Excel 97-2003 file (.xls)

### 2. Verify Installation

```bash
# Check if xlrd is installed
pip show xlrd

# Should show:
# Name: xlrd
# Version: 2.0.1
```

---

## Deployment

### For Vercel

When you deploy, Vercel will automatically install all dependencies from `requirements.txt`:

```bash
git add .
git commit -m "Add multi-format file upload support"
git push
```

Vercel will:
1. Read `requirements.txt`
2. Install xlrd==2.0.1
3. Deploy your app with full file format support

### For Other Platforms

Make sure to install dependencies:

```bash
pip install -r requirements.txt
```

---

## Current Dependencies

Your `requirements.txt` now includes:

```
Django==5.1.4          # Web framework
pandas==2.2.3           # Data processing
openpyxl==3.1.5         # For .xlsx files
xlrd==2.0.1            # For .xls files (NEW!)
gunicorn==23.0.0        # WSGI server
psycopg2-binary==2.9.9  # PostgreSQL driver
```

---

## Supported File Formats

| Format | Extension | Engine | Status |
|--------|-----------|--------|--------|
| CSV | `.csv` | pandas (built-in) | ✅ Ready |
| Excel 2007+ | `.xlsx` | openpyxl | ✅ Ready |
| Excel 97-2003 | `.xls` | xlrd | ✅ Now Working! |

---

## If You Get Similar Errors

### Error: "Missing optional dependency"

**Solution:**
1. Check `requirements.txt` - is the package listed?
2. Install locally: `pip install <package>`
3. Redeploy to pick up new dependencies

### Error: "Cannot read .xls file"

**Causes:**
- xlrd not installed
- Wrong file format
- Corrupted file

**Solutions:**
```bash
# Install xlrd
pip install xlrd==2.0.1

# Verify file format
# Try opening in Excel to check
```

---

## Next Steps

1. ✅ **Dependencies installed** - You're ready to test
2. **Test locally** - Upload files in all three formats
3. **Deploy** - Push to Vercel when ready
4. **Enjoy** - Users can now upload any format!

---

## Troubleshooting

### "Still getting error"

1. Restart Django server: `python manage.py runserver`
2. Clear browser cache
3. Try a different .xls file

### "Works locally but not on Vercel"

Make sure `requirements.txt` is committed:
```bash
git add requirements.txt
git commit -m "Update dependencies"
git push
```

### "Want to test without restarting"

You can test in Python shell:
```python
import pandas as pd
df = pd.read_excel('test.xls', engine='xlrd')
print(df.head())
```

---

## Summary

- ✅ xlrd installed locally
- ✅ Requirements.txt updated
- ✅ Server running
- ✅ Ready to test!

Try uploading a `.xls` file now - it should work! 🎉

