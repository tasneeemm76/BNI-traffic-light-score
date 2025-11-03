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
from datetime import date
from django.db import transaction
from django.shortcuts import render
from django.http import HttpRequest, HttpResponse
from .models import Member, MemberData, TrainingData, ReportUpload
from .utils import load_and_clean, score_dataframe, parse_training_period_and_header, parse_training_counts


def upload_file(request: HttpRequest) -> HttpResponse:
    """
    Uploads main report + optional training report, processes, scores, and saves all data safely.
    Handles metadata, missing headers, and malformed training reports gracefully.
    """
    if request.method != 'POST' or not request.FILES.get('file'):
        return render(request, 'reports/upload.html')

    try:
        # === STEP 1: Read main report ===
        f = request.FILES['file']
        file_bytes = f.read()
        filename = f.name

        df, weeks, months, from_date, to_date = load_and_clean(file_bytes, filename)

        # === STEP 2: If training file provided, parse safely ===
        training_counts = {}
        tr_from_date = None
        tr_to_date = None

        if request.FILES.get('training_file'):
            tr_f = request.FILES['training_file']
            tr_bytes = tr_f.read()

            # Try Excel first, fallback to CSV
            try:
                tr_df_raw = pd.read_excel(io.BytesIO(tr_bytes), header=None)
            except Exception:
                tr_df_raw = pd.read_csv(io.BytesIO(tr_bytes), header=None)

            # Detect From/To dates + header
            tr_from_date, tr_to_date, header_row_index = parse_training_period_and_header(tr_df_raw)
            if header_row_index == -1:
                raise ValueError("Training report must contain 'First Name' and 'Last Name' columns.")

            # Re-read skipping metadata rows before header
            try:
                tr_df = pd.read_excel(io.BytesIO(tr_bytes), skiprows=header_row_index)
            except Exception:
                tr_df = pd.read_csv(io.BytesIO(tr_bytes), skiprows=header_row_index)

            # Parse name-based counts (handles DataFrame or bytes)
            training_counts = parse_training_counts(tr_df, tr_f.name)

        # === STEP 3: Score main data ===
        results = score_dataframe(df, weeks, months, training_counts)

        # === STEP 4: Save all data ===
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

                # Create or get member
                member, _ = Member.objects.get_or_create(
                    first_name=first_name,
                    last_name=last_name,
                    defaults={'full_name': f"{first_name} {last_name}".strip()}
                )

                # Save MemberData
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

                # Save TrainingData
                if training_counts:
                    name_key = f"{first_name} {last_name}".strip().lower()
                    training_count = 0

                    for key, val in training_counts.items():
                        if key.strip().lower() == name_key:
                            training_count = val
                            break

                    TrainingData.objects.update_or_create(
                        report=report_upload,
                        member=member,
                        start_date=tr_from_date.date() if hasattr(tr_from_date, 'date') else tr_from_date,
                        end_date=tr_to_date.date() if hasattr(tr_to_date, 'date') else tr_to_date,
                        defaults={'count': int(training_count or 0)},
                    )

                    print(f"Saved TrainingData → {member.full_name}: {training_count} ({tr_from_date} → {tr_to_date})")

            print("===== DEBUG: Data Save Complete =====\n")

        # === STEP 5: Render results ===
        context = {
            'results': results,
            'weeks': weeks,
            'start_date': from_date,
            'end_date': to_date,
        }
        return render(request, 'reports/results.html', context)

    except Exception as e:
        import traceback
        print("\n⚠️ ERROR in upload_file:\n", traceback.format_exc())
        return render(request, 'reports/upload.html', {'error': str(e)})
	


from django.utils.dateparse import parse_date
from django.db.models import Q
from django.db import transaction
from collections import defaultdict
import calendar
from datetime import date, datetime

def view_scoring(request: HttpRequest) -> HttpResponse:
    """
    View scoring data with monthly listing and delete option.
    """

    # --- Handle delete request first ---
    if request.method == "POST" and "delete_month" in request.POST:
        year = int(request.POST.get("year"))
        month = int(request.POST.get("month"))
        first_day = date(year, month, 1)
        last_day = date(year, month, calendar.monthrange(year, month)[1])

        try:
            with transaction.atomic():
                # Identify reports within that month
                reports_to_delete = ReportUpload.objects.filter(
                    start_date__gte=first_day,
                    end_date__lte=last_day
                )

                if reports_to_delete.exists():
                    # Delete related data
                    MemberData.objects.filter(report__in=reports_to_delete).delete()
                    TrainingData.objects.filter(report__in=reports_to_delete).delete()
                    reports_to_delete.delete()

                    message = f"✅ All data for {calendar.month_name[month]} {year} deleted successfully."
                else:
                    message = f"⚠️ No reports found for {calendar.month_name[month]} {year}."

        except Exception as e:
            message = f"❌ Error deleting {calendar.month_name[month]} {year}: {str(e)}"

        # After delete, reload the page
        all_reports = ReportUpload.objects.all().order_by("start_date")
        month_list = _get_month_list(all_reports)
        return render(request, "reports/view_scoring.html", {
            "month_list": month_list,
            "message": message,
            "reports": all_reports,
        })

    # --- Regular GET logic below ---

    all_reports = ReportUpload.objects.all().order_by("start_date")
    month_list = _get_month_list(all_reports)

    start_date_str = request.GET.get("start_date")
    end_date_str = request.GET.get("end_date")

    if start_date_str and end_date_str:
        start_date = parse_date(start_date_str)
        end_date = parse_date(end_date_str)

        if not start_date or not end_date:
            return render(request, "reports/view_scoring.html", {
                "error": "Invalid date format.",
                "month_list": month_list,
                "reports": all_reports,
            })

        reports = ReportUpload.objects.filter(
            start_date__lte=end_date,
            end_date__gte=start_date
        ).distinct()

        if not reports.exists():
            return render(request, "reports/view_scoring.html", {
                "error": f"No reports found for {start_date_str} → {end_date_str}",
                "month_list": month_list,
                "reports": all_reports,
            })

        all_member_data = MemberData.objects.filter(report__in=reports).select_related("member", "report")
        training_data_dict = defaultdict(int)

        for t in TrainingData.objects.filter(report__in=reports).select_related("member", "report"):
            training_data_dict[t.member.id] += t.count

        results = []
        for member_data in all_member_data:
            member = member_data.member
            member_name = member.full_name or f"{member.first_name} {member.last_name}".strip()
            total_weeks = member_data.report.total_weeks or 1

            training_count = training_data_dict.get(member.id, 0)
            total_training_value = member_data.CEU + training_count

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
            "month_list": month_list,
            "start_date": start_date_str,
            "end_date": end_date_str,
            "reports": all_reports,
        })

    return render(request, "reports/view_scoring.html", {
        "month_list": month_list,
        "reports": all_reports,
    })


# --- helper function ---
def _get_month_list(all_reports):
    """Generate a sorted list of available months."""
    month_list = []
    for r in all_reports:
        if r.start_date:
            key = (r.start_date.year, r.start_date.month)
            if key not in month_list:
                month_list.append(key)
    return [
        {
            "year": y,
            "month": m,
            "label": f"{calendar.month_name[m]} {y}",
            "start": date(y, m, 1).isoformat(),
            "end": date(y, m, calendar.monthrange(y, m)[1]).isoformat(),
        }
        for (y, m) in sorted(month_list)
    ]
