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

# Get the WSGI application - this is what Vercel expects
application = get_wsgi_application()

# Export handler for Vercel
def handler(request):
    """
    Vercel serverless function handler
    Delegates to Django WSGI application
    """
    try:
        return application(request)
    except Exception as e:
        # Log the error
        import traceback
        print(f"Error in Django handler: {str(e)}")
        traceback.print_exc()
        
        # Return a simple error response
        from django.http import HttpResponse
        return HttpResponse(
            f"Error: {str(e)}",
            status=500,
            content_type='text/plain'
        )

