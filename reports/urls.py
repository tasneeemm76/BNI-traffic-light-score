from django.urls import path
from .views import upload_file, view_scoring, score_summary, member_analysis_view,list_score_results


urlpatterns = [
    path("", list_score_results, name="score_results_list"),
	path('upload_data', upload_file, name='upload_file'),
	path('view-scoring/', view_scoring, name='view_scoring'),
    path("score-summary/", score_summary , name="score_summary"),
	path("member-analysis/", member_analysis_view, name="member_analysis")

]



