from django.urls import path
from .views import upload_file, view_scoring


urlpatterns = [
	path('', upload_file, name='upload_file'),
	path('view-scoring/', view_scoring, name='view_scoring'),
]



