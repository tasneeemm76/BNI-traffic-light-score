from django.urls import path
from . import views

urlpatterns = [
    path('upload-excel/', views.upload_excel, name='upload_excel'),
    path('dashboard/', views.upload_dashboard, name='upload_dashboard'),
]
