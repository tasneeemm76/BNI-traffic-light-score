from django.shortcuts import render
from django.http import HttpRequest, HttpResponse

from .utils import load_and_clean, score_dataframe, parse_training_counts


def upload_file(request: HttpRequest) -> HttpResponse:
	if request.method == 'POST' and request.FILES.get('file'):
		f = request.FILES['file']
		filename = f.name
		file_bytes = f.read()
		try:
			df, weeks, months, from_date, to_date = load_and_clean(file_bytes, filename)
			training_counts = None
			if request.FILES.get('training_file'):
				tr_f = request.FILES['training_file']
				training_counts = parse_training_counts(tr_f.read(), tr_f.name)
			results = score_dataframe(df, weeks, months, training_counts)
			context = {
				'results': results,
				'weeks': weeks,
				'start_date': from_date,
				'end_date': to_date,
			}
			return render(request, 'reports/results.html', context)
		except Exception as e:
			return render(request, 'reports/upload.html', {
				'error': str(e)
			})

	return render(request, 'reports/upload.html')


