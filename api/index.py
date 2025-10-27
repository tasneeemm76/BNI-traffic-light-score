"""
Vercel serverless function handler for Django application
"""
import os
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bni_delhi.settings')

# Initialize Django
import django
django.setup()

# Import Django WSGI application
from django.core.wsgi import get_wsgi_application

# Export the WSGI application with the correct variable name
app = get_wsgi_application()
