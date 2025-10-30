from django.urls import path
from . import views

urlpatterns = [
    path('', views.upload_excel, name='upload_excel'),
    path('reports/', views.list_reports, name='list_reports'),
    path('reports/months/', views.months_index, name='reports_months'),
    path('reports/<int:year>/<int:month>/', views.list_reports_month, name='list_reports_month'),
    path('delete_all/', views.delete_all_reports, name='delete_all_reports'),
   # path('reports/summary/', views.reports_summary , name='reports_summary'),
]
