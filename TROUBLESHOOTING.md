# Troubleshooting Guide: Django on Vercel

## Current Error: 500 INTERNAL_SERVER_ERROR

### What This Error Means

You're now getting past the `DEPLOYMENT_NOT_FOUND` error! This means:
✅ Vercel found your deployment
✅ Your serverless function is being invoked
❌ But Django is crashing during execution

This is **progress** - we're closer to a working deployment.

---

## Common Causes & Solutions

### 1. Database Initialization Error

**Problem**: Django tries to access SQLite database on serverless file system (which doesn't persist)

**Error Pattern**: Look for errors like:
- "unable to open database file"
- "database is locked"
- "no such table"

**Solution**: Your app doesn't actually use the database for core functionality (Excel upload/processing). We need to disable database checks.

### 2. Template Not Found

**Problem**: Django can't find HTML templates

**Error Pattern**: 
- "TemplateDoesNotExist: upload_excel.html"
- "TemplateDoesNotExist: dashboard.html"

**Solution**: Templates need to be in the correct location

### 3. Missing Static Files

**Problem**: Django can't find CSS/JS files

**Error Pattern**: Static files return 404

**Solution**: Run `collectstatic` before deployment

### 4. Import Errors

**Problem**: Missing or incorrect imports

**Error Pattern**: "ModuleNotFoundError"

**Solution**: Check all dependencies in `requirements.txt`

---

## Step-by-Step Debugging

### Step 1: Check Vercel Logs

1. Go to your Vercel dashboard
2. Click on your project
3. Click on the latest deployment
4. Click "Functions" tab
5. Click on the function that failed
6. Look at the logs

**What to look for:**
- The exact Python exception
- Stack trace showing where Django crashed
- Any import errors

### Step 2: Add Better Error Logging

The updated `api/index.py` now includes error handling that will log detailed errors. Deploy and check the logs again.

### Step 3: Fix Database Issues

Since your app doesn't use database tables (no models are defined), we can disable database access:

```python
# In settings.py, add this after INSTALLED_APPS:
DATABASE_ROUTERS = []
```

### Step 4: Fix Template Paths

Ensure templates are correctly configured. Templates should be in:
- `reports/templates/upload_excel.html`
- `reports/templates/dashboard.html`

### Step 5: Run Collectstatic Locally

```bash
python manage.py collectstatic --noinput
```

This creates the `staticfiles` directory that Vercel will serve.

---

## Quick Fixes Applied

I've updated your code with:

1. **Better error handling** in `api/index.py`
   - Catches exceptions and logs them
   - Returns proper error responses

2. **Added psycopg2** to `requirements.txt`
   - For future PostgreSQL database support

3. **Updated database settings** with comments
   - Explains how to configure PostgreSQL

---

## Next Steps

### Immediate (Deploy and Test)

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Fix serverless handler and add error handling"
   git push
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Check the logs** in Vercel dashboard for the actual error

### If Database Error Occurs

If you see database-related errors, add this to `settings.py`:

```python
# Disable database migrations for views that don't need DB
class DisableMigrations:
    def __contains__(self, item):
        return True
    def __getitem__(self, item):
        return None

if os.environ.get('VERCEL'):
    MIGRATION_MODULES = DisableMigrations()
```

### If Template Error Occurs

Ensure your templates are in the right place:
```
reports/
  templates/
    upload_excel.html
    dashboard.html
```

And in `settings.py`, make sure:
```python
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,  # This must be True
        ...
    }
]
```

---

## Understanding the Error Flow

```
Browser Request
    ↓
Vercel Edge Network
    ↓
Python Runtime (@vercel/python)
    ↓
api/index.py handler()
    ↓
Django WSGI Application
    ↓
Django URL Routing (urls.py)
    ↓
Django View (views.py)
    ↓
Django Template Rendering
    ↓
Response back to Browser
```

**The crash is happening somewhere in this chain.**

---

## Most Likely Issue

Based on your code structure, the most likely issue is:

**Template Rendering**: Your views use `render()` which needs templates. The templates must be:
1. In the correct directory structure
2. Accessible to Django's template loader
3. Properly configured in `settings.py`

---

## Alternative: Use a Django-Friendly Platform

Given the complexity of Django on Vercel, consider:

1. **Railway** (Recommended)
   - Free tier with PostgreSQL
   - Native Django support
   - One-click deploy

2. **Render**
   - Free tier
   - Built-in Django support
   - Easy database setup

3. **PythonAnywhere**
   - Free tier
   - Full Django support
   - No configuration needed

---

## Expected Behavior After Fix

Once everything works, you should be able to:

1. Visit your Vercel URL
2. See the upload form
3. Upload an Excel file
4. Process and display results

If you see errors about templates or static files, that's the next issue to fix.

---

## Get More Help

1. **Vercel Logs**: Check for the exact Python exception
2. **Django Debug**: Set `DEBUG=True` temporarily to see detailed errors
3. **Community**: Ask on Vercel/Django forums with the error from logs

The key is to **check the Vercel logs** to see the actual Python exception that's causing the crash.

