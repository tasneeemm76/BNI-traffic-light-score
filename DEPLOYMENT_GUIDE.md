# Django Deployment Guide for Vercel

## Overview

This guide explains how to deploy your Django application to Vercel and resolve the `DEPLOYMENT_NOT_FOUND` error.

## What Was Fixed

### Files Created:
1. **`vercel.json`** - Vercel configuration file that routes all requests to the Django serverless function
2. **`requirements.txt`** - Python dependencies needed for the project
3. **`runtime.txt`** - Specifies Python version (3.12)
4. **`api/index.py`** - Serverless function handler that bridges Vercel and Django
5. **`.gitignore`** - Excludes unnecessary files from version control

### Files Modified:
1. **`bni_delhi/settings.py`** - Updated for production deployment:
   - Added environment variable support for SECRET_KEY
   - Set DEBUG from environment variable
   - Set ALLOWED_HOSTS to accept all hosts
   - Added STATIC_ROOT for static file collection

## Understanding the Error

### What Does `DEPLOYMENT_NOT_FOUND` Mean?

The `DEPLOYMENT_NOT_FOUND` error occurs when Vercel cannot find a deployment to serve your application. This happens because:

1. **Missing Configuration**: Vercel didn't know how to build/serve your Django app
2. **No Entry Point**: Vercel's Python runtime didn't have a handler function to execute
3. **Incorrect Routing**: Requests weren't being routed to your Django application

### Root Cause Analysis

**What was happening:**
- Your Django project had no `vercel.json` configuration
- Vercel didn't know Django existed or how to serve it
- No serverless function handler was defined in `api/index.py`
- The build process likely failed silently

**What needed to happen:**
- Create a `vercel.json` that tells Vercel to use Python and route all requests
- Create `api/index.py` with a handler function that initializes Django
- Provide `requirements.txt` so Vercel knows what packages to install
- Configure Django settings for serverless deployment

## How to Deploy

### Step 1: Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy Your Project
```bash
vercel
```

Follow the prompts to connect your project to Vercel.

### Step 4: Set Environment Variables
In your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add these variables:
   - `SECRET_KEY`: Generate a new secret key (see below)
   - `DEBUG`: Set to `False` for production

**Generate a new SECRET_KEY:**
```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

### Step 5: Run Database Migrations
After deployment, you may need to run migrations. You can do this via Vercel CLI:
```bash
vercel env pull .env.local
python manage.py migrate
```

## Important Considerations

### Vercel's Limitations for Django

⚠️ **Important**: Vercel is **not ideal** for Django applications. Consider these limitations:

1. **Serverless Cold Starts**: Each request may experience a cold start delay
2. **Ephemeral Filesystem**: File uploads are not persistent between requests
3. **Database Limitations**: SQLite won't work well in serverless environment
4. **No Persistent Storage**: Your `db.sqlite3` file won't persist

### Recommended Alternatives

**For Django applications, consider:**

1. **Railway** (Recommended)
   - Free tier available
   - Native Django support
   - PostgreSQL included
   - Persistent storage

2. **Render**
   - Free tier available
   - Built-in Django support
   - Easy database setup

3. **PythonAnywhere**
   - Free tier available
   - Traditional hosting
   - Full Django support

4. **Heroku**
   - Requires credit card for free tier
   - Excellent Django support
   - Comprehensive add-ons

5. **AWS/DigitalOcean**
   - More control
   - Better for production
   - Requires more setup

## Code Explanation

### `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.py"
    }
  ]
}
```

**What it does:**
- Tells Vercel to use the Python runtime
- Routes ALL requests (`/*`) to `api/index.py`
- Builds the serverless function from that file

### `api/index.py`
```python
def handler(request):
    return application(request)
```

**What it does:**
- Initializes Django when the serverless function loads
- Passes incoming requests to Django's WSGI application
- Returns Django's responses back to Vercel

### `requirements.txt`
Lists all Python packages Vercel needs to install:
- Django (web framework)
- pandas (Excel processing)
- openpyxl (Excel file support)
- gunicorn (WSGI server)

## Security Notes

1. **SECRET_KEY**: Always use environment variables in production
2. **DEBUG**: Never run with DEBUG=True in production
3. **ALLOWED_HOSTS**: Currently set to `['*']` for Vercel compatibility
4. **CSRF**: Django's CSRF protection should work normally

## Monitoring and Debugging

### Check Deployment Logs
```bash
vercel logs
```

### View Specific Deployment
```bash
vercel inspect [deployment-url]
```

### Test Locally
```bash
vercel dev
```

## Next Steps

1. Deploy using the commands above
2. Monitor logs for any errors
3. Consider migrating to a Django-friendly platform for production
4. Set up a proper database (PostgreSQL recommended)
5. Configure static file serving
6. Set up environment-specific settings

## Additional Resources

- [Vercel Python Documentation](https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/python)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/)
- [Django on Railway](https://railway.app/)
- [Django on Render](https://render.com/docs/deploy-django)

## Troubleshooting

### Error: "Module not found"
- Check that all dependencies are in `requirements.txt`
- Verify Python version in `runtime.txt`

### Error: "Database locked"
- Switch from SQLite to PostgreSQL or another database
- SQLite doesn't work well in serverless environments

### Error: "Static files not found"
- Run `python manage.py collectstatic` before deployment
- Configure static file serving in Vercel

### Deployment fails silently
- Check Vercel dashboard logs
- Ensure `vercel.json` is in the root directory
- Verify `api/index.py` exists and has no syntax errors

