import io
from django.shortcuts import render, get_object_or_404
from django.http import HttpRequest, HttpResponse, Http404
from django.db import transaction
from django.utils.dateparse import parse_date
from datetime import date
from typing import Dict, Any, Optional

import pandas as pd

from .utils import load_and_clean, score_dataframe, parse_training_counts
from .models import ReportUpload, Member, MemberData, TrainingData


def _color_by_absolute(score: int, max_score: int) -> str:
	"""Map per-metric score to a color using percentage bands."""
	if max_score <= 0:
		return '#d3d3d3'
	percent = (score / max_score) * 100.0
	if percent >= 70:
		return '#008000'
	elif percent >= 50:
		return '#FFBF00'
	elif percent >= 30:
		return '#ff0000'
	else:
		return '#808080'


def calculate_score_from_data(member_data: MemberData, total_weeks: float, training_count: Optional[int] = None) -> Dict[str, Any]:
	"""Calculate scores from MemberData database object."""
	RGI = member_data.RGI
	RGO = member_data.RGO
	V = member_data.V
	T = member_data.T
	A = member_data.A
	L_col = member_data.L
	TYFCB = member_data.TYFCB
	CEU = member_data.CEU
	
	# Use training_count if provided, otherwise use CEU from member_data
	ceu_count = training_count if training_count is not None else (CEU or 0)
	
	total_referrals = RGI + RGO
	ref_per_week = total_referrals / total_weeks if total_weeks else 0
	visitors_per_week = V / total_weeks if total_weeks else 0
	testimonials_per_week = T / total_weeks if total_weeks else 0
	absenteeism = A
	
	# Referrals/week score
	if ref_per_week < 0.5:
		ref_score = 0
	elif ref_per_week < 0.75:
		ref_score = 5
	elif ref_per_week < 1:
		ref_score = 10
	elif ref_per_week < 1.2:
		ref_score = 15
	else:
		ref_score = 20
	ref_max = 20
	
	# Visitors/week score
	if visitors_per_week < 0.1:
		visitor_score = 0
	elif visitors_per_week < 0.25:
		visitor_score = 5
	elif visitors_per_week < 0.5:
		visitor_score = 10
	elif visitors_per_week < 0.75:
		visitor_score = 15
	else:
		visitor_score = 20
	visitor_max = 20
	
	# Absenteeism score
	if absenteeism > 2:
		absenteeism_score = 0
	elif absenteeism == 2:
		absenteeism_score = 5
	elif absenteeism == 1:
		absenteeism_score = 10
	else:
		absenteeism_score = 15
	absenteeism_max = 15
	
	# Training (CEU)
	if ceu_count <= 0:
		training_score = 0
	elif ceu_count == 1:
		training_score = 5
	elif ceu_count == 2:
		training_score = 10
	else:
		training_score = 15
	training_max = 15
	
	# Testimonials/week
	if testimonials_per_week <= 0:
		testimonial_score = 0
	elif testimonials_per_week < 0.075:
		testimonial_score = 5
	else:
		testimonial_score = 10
	testimonial_max = 10
	
	# TYFCB
	if TYFCB < 500000:
		tyfcb_score = 0
	elif TYFCB < 1000000:
		tyfcb_score = 5
	elif TYFCB < 2000000:
		tyfcb_score = 10
	else:
		tyfcb_score = 15
	tyfcb_max = 15
	
	# Arriving on time (column L rule)
	arriving_on_time_score = 5 if L_col == 0 else 0
	arriving_on_time_max = 5
	
	total_score = (
		ref_score + visitor_score + absenteeism_score +
		training_score + testimonial_score + tyfcb_score + arriving_on_time_score
	)
	
	# Color bands for total
	if total_score >= 70:
		color = '#6cc070'  # Green
	elif total_score >= 50:
		color = '#f5c542'  # Amber
	elif total_score >= 30:
		color = '#e84c3d'  # Red
	else:
		color = '#d3d3d3'  # Grey
	
	return {
		'name': member_data.member.full_name,
		'total_score': int(total_score),
		'color': color,
		'referrals_week_score': int(ref_score),
		'referrals_week_color': _color_by_absolute(int(ref_score), ref_max),
		'visitors_week_score': int(visitor_score),
		'visitors_week_color': _color_by_absolute(int(visitor_score), visitor_max),
		'absenteeism_score': int(absenteeism_score),
		'absenteeism_color': _color_by_absolute(int(absenteeism_score), absenteeism_max),
		'training_score': int(training_score),
		'training_color': _color_by_absolute(int(training_score), training_max),
		'testimonials_week_score': int(testimonial_score),
		'testimonials_week_color': _color_by_absolute(int(testimonial_score), testimonial_max),
		'tyfcb_score': int(tyfcb_score),
		'tyfcb_color': _color_by_absolute(int(tyfcb_score), tyfcb_max),
		'arriving_on_time_score': int(arriving_on_time_score),
		'arrival_color': _color_by_absolute(int(arriving_on_time_score), arriving_on_time_max),
	}

import io
import pandas as pd
from .utils import parse_training_period_and_header


def upload_file(request: HttpRequest) -> HttpResponse:
	if request.method == 'POST' and request.FILES.get('file'):
		f = request.FILES['file']
		filename = f.name
		file_bytes = f.read()

		try:
			# --- Step 1: Parse main report file ---
			df, weeks, months, from_date, to_date = load_and_clean(file_bytes, filename)

			training_counts = None
			tr_from_date = None
			tr_to_date = None

			# --- Step 2: Handle training file if provided ---
			if request.FILES.get('training_file'):
				tr_f = request.FILES['training_file']
				tr_bytes = tr_f.read()

				# Read raw to detect header and dates
				tr_df_raw = pd.read_excel(io.BytesIO(tr_bytes), header=None)
				tr_from_date, tr_to_date, header_row_index = parse_training_period_and_header(tr_df_raw)

				if header_row_index == -1:
					raise ValueError("Training report must contain 'First Name' and 'Last Name' columns.")

				# Re-read clean data skipping metadata
				tr_df = pd.read_excel(io.BytesIO(tr_bytes), skiprows=header_row_index)

				# Parse name-based training counts
				training_counts = parse_training_counts(tr_df, tr_f.name)


			# --- Step 3: Score main data ---
			results = score_dataframe(df, weeks, months, training_counts)

			# --- Step 4: Save to database ---
			with transaction.atomic():
				report_upload = ReportUpload.objects.create(
					start_date=from_date.date() if from_date else date.today(),
					end_date=to_date.date() if to_date else date.today(),
					total_weeks=weeks,
					total_months=months
				)

				print("\n===== DEBUG: Saving MemberData & TrainingData =====")
				print(f"Training file entries: {len(training_counts or {})}\n")

				for _, row in df.iterrows():
					first_name = str(row.get('First Name', '')).strip()
					last_name = str(row.get('Last Name', '')).strip()
					if not first_name and not last_name:
						continue

					member, _ = Member.objects.get_or_create(
						first_name=first_name,
						last_name=last_name,
						defaults={'full_name': f"{first_name} {last_name}".strip()}
					)

					# --- Save MemberData ---
					MemberData.objects.update_or_create(
						report=report_upload,
						member=member,
						defaults={
							'P': int(row.get('P', 0) or 0),
							'A': int(row.get('A', 0) or 0),
							'L': int(row.get('L', 0) or 0),
							'M': int(row.get('M', 0) or 0),
							'S': int(row.get('S', 0) or 0),
							'RGI': int(row.get('RGI', 0) or 0),
							'RGO': int(row.get('RGO', 0) or 0),
							'RRI': int(row.get('RRI', 0) or 0),
							'RRO': int(row.get('RRO', 0) or 0),
							'V': int(row.get('V', 0) or 0),
							'one_to_one': int(row.get('1-2-1', 0) or 0),
							'TYFCB': int(row.get('TYFCB', 0) or 0),
							'CEU': int(row.get('CEU', 0) or 0),
							'T': int(row.get('T', 0) or 0),
						}
					)

					# --- Save TrainingData ---
					if training_counts:
						name_key = f"{first_name} {last_name}".strip()
						training_count = 0

						if name_key in training_counts:
							training_count = training_counts[name_key]
						else:
							for key in training_counts.keys():
								if key.lower().strip() == name_key.lower().strip():
									training_count = training_counts[key]
									break

						TrainingData.objects.update_or_create(
							report=report_upload,
							member=member,
							start_date=tr_from_date.date() if tr_from_date else None,
							end_date=tr_to_date.date() if tr_to_date else None,
							defaults={'count': int(training_count or 0)}
						)

						print(f"Saved TrainingData → {member.full_name}: {training_count} "
						      f"({tr_from_date} → {tr_to_date})")

				print("===== DEBUG: Data Save Complete =====\n")

			context = {
				'results': results,
				'weeks': weeks,
				'start_date': from_date,
				'end_date': to_date,
			}
			return render(request, 'reports/results.html', context)

		except Exception as e:
			return render(request, 'reports/upload.html', {'error': str(e)})

	return render(request, 'reports/upload.html')


def view_scoring(request: HttpRequest) -> HttpResponse:
	"""
	View scoring data from date range stored in database,
	combining CEU (Continuing Education Units) + TrainingData counts
	into the final training score.
	"""
	from django.utils.dateparse import parse_date
	from collections import defaultdict

	start_date_str = request.GET.get("start_date")
	end_date_str = request.GET.get("end_date")

	if start_date_str and end_date_str:
		start_date = parse_date(start_date_str)
		end_date = parse_date(end_date_str)

		if not start_date or not end_date:
			return render(request, "reports/view_scoring.html", {
				"error": "Invalid date format. Please use YYYY-MM-DD format.",
				"reports": ReportUpload.objects.all()[:20],
			})

		# --- Filter reports overlapping selected range ---
		reports = ReportUpload.objects.filter(
			start_date__lte=end_date,
			end_date__gte=start_date
		).distinct()

		if not reports.exists():
			return render(request, "reports/view_scoring.html", {
				"error": f"No reports found for the date range {start_date_str} to {end_date_str}",
				"start_date": start_date_str,
				"end_date": end_date_str,
				"reports": ReportUpload.objects.all()[:20],
			})

		# --- Load MemberData (core metrics) ---
		all_member_data = MemberData.objects.filter(
			report__in=reports
		).select_related("member", "report")

		# --- Load and aggregate TrainingData ---
		training_data_dict = defaultdict(int)
		training_records = TrainingData.objects.filter(
			report__in=reports
		).select_related("member", "report")

		for training in training_records:
			training_data_dict[training.member.id] += training.count

		results = []

		for member_data in all_member_data:
			member = member_data.member
			member_name = member.full_name or f"{member.first_name} {member.last_name}".strip() or "Unknown"

			total_weeks = member_data.report.total_weeks or 1

			# --- Combine CEU + TrainingData for total training score input ---
			training_count = training_data_dict.get(member.id, 0)
			total_training_value = member_data.CEU + training_count

			# ✅ FIXED: pass correct argument name
			score_result = calculate_score_from_data(
				member_data=member_data,
				total_weeks=total_weeks,
				training_count=total_training_value,
			)

			score_result["name"] = member_name
			score_result["report_period"] = f"{member_data.report.start_date} → {member_data.report.end_date}"
			results.append(score_result)

		results.sort(key=lambda x: (-x.get("total_score", 0), x["name"]))

		return render(request, "reports/view_scoring.html", {
			"results": results,
			"start_date": start_date_str,
			"end_date": end_date_str,
			"reports": ReportUpload.objects.all()[:20],
		})

	# --- Default view ---
	return render(request, "reports/view_scoring.html", {
		"reports": ReportUpload.objects.all()[:20]
	})
