import calendar
import io
from django.http import HttpRequest, HttpResponse, Http404
from django.db import transaction
from django.utils.dateparse import parse_date
from datetime import date
from typing import Dict, Any, List, Optional

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
def calculate_score_from_data(
    member_data: MemberData,
    total_weeks: float,
    training_count: Optional[int] = None
) -> Dict[str, Any]:
    """Calculate traffic-light scores from MemberData."""

    # Raw values
    RGI = member_data.RGI or 0
    RGO = member_data.RGO or 0
    V = member_data.V or 0
    T = member_data.T or 0
    A = member_data.A or 0
    L_col = member_data.L or 0
    TYFCB = member_data.TYFCB or 0
    CEU = member_data.CEU or 0

    # ✅ NEW: Total meets (P + A + S + M)
    total_meets = (member_data.P or 0) + (member_data.A or 0) + (member_data.S or 0) + (member_data.M or 0)
    total_weeks = total_meets if total_meets > 0 else 1   # avoid division by zero

    # Training override (if provided)
    ceu_count = training_count if training_count is not None else CEU

    # Per-week metrics
    total_referrals = RGI + RGO
    ref_per_week = total_referrals / total_weeks
    visitors_per_week = V / total_weeks
    testimonials_per_week = T / total_weeks

    # -------------------------------
    # Referrals score
    # -------------------------------
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

    # -------------------------------
    # Visitors score
    # -------------------------------
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

    # -------------------------------
    # Absenteeism score (A only)
    # -------------------------------
    if A > 2:
        absenteeism_score = 0
    elif A == 2:
        absenteeism_score = 5
    elif A == 1:
        absenteeism_score = 10
    else:  # A == 0
        absenteeism_score = 15
    absenteeism_max = 15

    # -------------------------------
    # Training score
    # -------------------------------
    if ceu_count <= 0:
        training_score = 0
    elif ceu_count == 1:
        training_score = 5
    elif ceu_count == 2:
        training_score = 10
    else:
        training_score = 15
    training_max = 15

    # -------------------------------
    # Testimonials score
    # -------------------------------
    if testimonials_per_week <= 0:
        testimonial_score = 0
    elif testimonials_per_week < 0.075:
        testimonial_score = 5
    else:
        testimonial_score = 10
    testimonial_max = 10

    # -------------------------------
    # TYFCB score
    # -------------------------------
    if TYFCB < 500000:
        tyfcb_score = 0
    elif TYFCB < 1000000:
        tyfcb_score = 5
    elif TYFCB < 2000000:
        tyfcb_score = 10
    else:
        tyfcb_score = 15
    tyfcb_max = 15

    # -------------------------------
    # On Time score
    # -------------------------------
    arriving_on_time_score = 5 if L_col == 0 else 0
    arriving_on_time_max = 5

    # -------------------------------
    # Total score
    # -------------------------------
    total_score = (
        ref_score +
        visitor_score +
        absenteeism_score +
        training_score +
        testimonial_score +
        tyfcb_score +
        arriving_on_time_score
    )

    # Total color
    if total_score >= 70:
        color = '#6cc070'  # Green
    elif total_score >= 50:
        color = '#f5c542'  # Amber
    elif total_score >= 30:
        color = '#e84c3d'  # Red
    else:
        color = '#d3d3d3'  # Grey

    # Return score dict
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

def generate_suggestions(score_data: Dict[str, Any]) -> List[str]:
    """Return specific suggestions based on low-scoring metrics."""
    suggestions = []

    # --------------------------------------
    # Referrals (goal: 1.2 per week for full score)
    # --------------------------------------
    ref_score = score_data['referrals_week_score']
    ref_pw = score_data.get("ref_per_week", None)  # Add this to score_data when you call your scorer

    if ref_pw is not None and ref_score < 20:
        needed = max(0, (1.2 - ref_pw))
        suggestions.append(
            f"Give around {needed:.1f} more referrals per week to reach the top referral band."
        )

    # --------------------------------------
    # Visitors (goal: 0.75 per week)
    # --------------------------------------
    visitor_score = score_data['visitors_week_score']
    visitor_pw = score_data.get("visitors_per_week", None)

    if visitor_pw is not None and visitor_score < 20:
        needed = max(0, (0.75 - visitor_pw))
        suggestions.append(
            f"Invite about {needed:.1f} more visitors per week to hit the highest visitor score."
        )

    # --------------------------------------
    # Absenteeism (goal: 0 absences)
    # --------------------------------------
    abs_score = score_data['absenteeism_score']
    absences = score_data.get("A", None)

    if absences is not None and abs_score < 15:
        suggestions.append(
            f"Reduce your absences — avoid missing your next {absences} meetings to improve attendance."
        )

    # --------------------------------------
    # Training / CEUs (goal: 3+)
    # --------------------------------------
    training_score = score_data['training_score']
    ceu_count = score_data.get("CEU", None)

    if ceu_count is not None and training_score < 15:
        needed = max(0, 3 - ceu_count)
        suggestions.append(
            f"Attend {needed} more CEU/training sessions to reach maximum training score."
        )

    # --------------------------------------
    # Testimonials (goal: 0.075 per week)
    # --------------------------------------
    testimonials_score = score_data['testimonials_week_score']
    testimonials_pw = score_data.get("testimonials_per_week", None)

    if testimonials_pw is not None and testimonials_score < 10:
        needed = max(0, (0.075 - testimonials_pw))
        suggestions.append(
            f"Share {needed:.2f} more testimonials per week to strengthen your testimonial score."
        )

    # --------------------------------------
    # TYFCB (goal: ₹ 20,00,000+)
    # --------------------------------------
    tyfcb_score = score_data['tyfcb_score']
    tyfcb_value = score_data.get("TYFCB", None)

    if tyfcb_value is not None and tyfcb_score < 15:
        needed = max(0, 2000000 - tyfcb_value)
        suggestions.append(
            f"Pass stronger referrals — generate about ₹{needed:,} more TYFCB to reach the top bracket."
        )

    # --------------------------------------
    # On Time (goal: 0 late arrivals)
    # --------------------------------------
    if score_data['arriving_on_time_score'] < 5:
        suggestions.append("Arrive on time for all meetings to secure the On-Time points every week.")

    return suggestions


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
	


import logging
from django.utils.dateparse import parse_date
from django.db import transaction
from collections import defaultdict
from django.shortcuts import render
from django.http import HttpRequest, HttpResponse
from .models import ReportUpload, MemberData, TrainingData
import calendar

logger = logging.getLogger(__name__)


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



from django.shortcuts import render
from django.utils.dateparse import parse_date
from django.db import transaction
from collections import defaultdict
import calendar
from datetime import date
import logging

from .models import ReportUpload, MemberData, TrainingData

logger = logging.getLogger(__name__)

def view_scoring(request):
    """
    View scoring data with monthly listing and delete option.
    Works strictly on exact start_date and end_date matches.
    """

    # --- Handle delete request ---
    if request.method == "POST" and "delete_range" in request.POST:
        start_str = request.POST.get("start_date")
        end_str = request.POST.get("end_date")

        try:
            start = parse_date(start_str)
            end = parse_date(end_str)
            if not start or not end:
                raise ValueError("Invalid date format")

            with transaction.atomic():
                deleted_count, _ = ReportUpload.objects.filter(
                    start_date=start, end_date=end
                ).delete()

            if deleted_count > 0:
                message = f"✅ Deleted report for {start} → {end}"
            else:
                message = f"⚠️ No report found for {start} → {end}"

        except Exception as e:
            logger.exception("Error deleting report")
            message = f"❌ Error deleting report: {str(e)}"

        all_reports = ReportUpload.objects.all().order_by("start_date")
        month_list = _get_month_list(all_reports)
        return render(request, "reports/view_scoring.html", {
            "month_list": month_list,
            "reports": all_reports,
            "message": message,
        })

    # --- Regular GET ---
    all_reports = ReportUpload.objects.all().order_by("start_date")
    month_list = _get_month_list(all_reports)

    start_str = request.GET.get("start_date")
    end_str = request.GET.get("end_date")

    if not start_str or not end_str:
        return render(request, "reports/view_scoring.html", {
            "month_list": month_list,
            "reports": all_reports,
        })

    start_date = parse_date(start_str)
    end_date = parse_date(end_str)

    if not start_date or not end_date:
        return render(request, "reports/view_scoring.html", {
            "error": "Invalid date format.",
            "month_list": month_list,
            "reports": all_reports,
        })

    logger.info(f"view_scoring: Exact match requested {start_date} → {end_date}")

    # --- Fetch only reports exactly matching range ---
    reports = ReportUpload.objects.filter(
        start_date=start_date,
        end_date=end_date
    )

    if not reports.exists():
        logger.info(f"view_scoring: No report found for exact match {start_date} → {end_date}")
        return render(request, "reports/view_scoring.html", {
            "error": f"No report found for exact range {start_date} → {end_date}",
            "month_list": month_list,
            "reports": all_reports,
        })

    logger.info(f"view_scoring: Found {reports.count()} reports matching exact range")

    all_member_data = MemberData.objects.filter(report__in=reports).select_related("member", "report")
    training_data_dict = defaultdict(int)

    # Collect training counts for this range
    training_records = TrainingData.objects.filter(
        report__in=reports,
        start_date=start_date,
        end_date=end_date
    ).select_related("member", "report")

    logger.info(f"view_scoring: Found {training_records.count()} training rows")

    for t in training_records:
        training_data_dict[t.member.id] += t.count

    results = []
    seen = set()

    for md in all_member_data:
        key = (md.member_id, md.report.start_date, md.report.end_date)
        if key in seen:
            continue
        seen.add(key)

        member = md.member
        member_name = member.full_name or f"{member.first_name} {member.last_name}".strip()
        total_weeks = md.report.total_weeks or 1

        training_count = training_data_dict.get(md.member_id, 0)
        total_training_value = md.CEU + training_count

        score = calculate_score_from_data(
            member_data=md,
            total_weeks=total_weeks,
            training_count=total_training_value,
        )

        score["name"] = member_name
        score["report_period"] = f"{md.report.start_date} → {md.report.end_date}"
        results.append(score)

    results.sort(key=lambda x: (-x.get("total_score", 0), x["name"]))

    logger.info(f"view_scoring: Completed {len(results)} scored results for {start_date} → {end_date}")

    return render(request, "reports/view_scoring.html", {
        "results": results,
        "month_list": month_list,
        "reports": all_reports,
        "start_date": start_str,
        "end_date": end_str,
    })


def _get_month_list(all_reports):
    """Build a list of available (year, month) for sidebar listing."""
    months = []
    seen = set()
    for r in all_reports:
        if not r.start_date:
            continue
        key = (r.start_date.year, r.start_date.month)
        if key not in seen:
            seen.add(key)
            months.append({
                "year": r.start_date.year,
                "month": r.start_date.month,
                "label": f"{calendar.month_name[r.start_date.month]} {r.start_date.year}",
                "start": date(r.start_date.year, r.start_date.month, 1).isoformat(),
                "end": date(r.start_date.year, r.start_date.month, calendar.monthrange(r.start_date.year, r.start_date.month)[1]).isoformat(),
            })
    return sorted(months, key=lambda x: (x["year"], x["month"]))

from django.shortcuts import redirect
from django.contrib import messages

def delete_report(request, start, end):
    """Deletes all records belonging to a report with matching start and end dates."""
    try:
        report = ReportUpload.objects.filter(start_date=start, end_date=end).first()
        if not report:
            messages.warning(request, f"No reports found for {start} → {end}.")
            return redirect('view_scoring')

        # Delete all linked data (MemberData + TrainingData handled by cascade)
        report.delete()
        messages.success(request, f"✅ Report from {start} to {end} deleted successfully.")
    except Exception as e:
        messages.error(request, f"⚠️ Error deleting report: {e}")
    
    return redirect('view_scoring')

def _color_by_absolute(score: int, max_score: int) -> str:
    """Map per-metric score to a color using percentage bands."""
    if max_score <= 0:
        return "#d3d3d3"
    percent = (score / max_score) * 100.0
    if percent >= 70:
        return "#008000"  # Green
    elif percent >= 50:
        return "#FFBF00"  # Yellow
    elif percent >= 30:
        return "#ff0000"  # Red
    else:
        return "#808080"  # Gray

def is_ignored_member(member_name: str) -> bool:
    if not member_name:
        return False
    ignored_names = {"total", "bni", "visitors"}
    return member_name.strip().lower() in ignored_names

def score_summary(request):
    """Display a color-coded score heatmap: Member × Month."""
    try:
        reports = (
            ReportUpload.objects
            .prefetch_related("member_data", "training_data")
            .order_by("start_date")
        )

        if not reports.exists():
            return render(request, "reports/score_summary.html", {"error": "No reports found."})

        months = []
        member_names = set()
        raw_scores = defaultdict(dict)

        # --------------------------------------
        # HEATMAP MONTHLY SUMMARY
        # --------------------------------------
        for report in reports:
            month_label = report.end_date.strftime("%b %y")
            if month_label not in months:
                months.append(month_label)

            training_lookup = {t.member_id: (t.count or 0) for t in report.training_data.all()}

            for md in report.member_data.all():
                member_name = md.member.full_name or f"{md.member.first_name} {md.member.last_name}".strip()

                if is_ignored_member(member_name):
                    continue

                member_names.add(member_name)

                total_training = (md.CEU or 0) + training_lookup.get(md.member_id, 0)

                try:
                    score_data = calculate_score_from_data(
                        member_data=md,
                        total_weeks=report.total_weeks or 1.0,
                        training_count=total_training,
                    )
                except Exception:
                    continue

                total_score = int(score_data.get("total_score", 0))
                raw_scores[member_name][month_label] = total_score

        max_score = max((v for m in raw_scores.values() for v in m.values()), default=100)

        sorted_members = sorted(
            member_names,
            key=lambda m: sum(raw_scores.get(m, {}).values()),
            reverse=True
        )

        table_data = []
        for member in sorted_members:
            row = {"member": member, "scores": []}
            for month in months:
                score = raw_scores.get(member, {}).get(month)
                if score is None:
                    row["scores"].append({"value": "-", "color": "#f0f0f0"})
                else:
                    row["scores"].append({
                        "value": score,
                        "color": _color_by_absolute(score, max_score)
                    })
            table_data.append(row)

        # ✅ RETURN WITHOUT MEMBER ANALYSIS
        return render(request, "reports/score_summary.html", {
            "months": months,
            "table_data": table_data,
        })

    except Exception as e:
        return render(request, "reports/score_summary.html", {"error": f"Server error: {e}"})


def list_score_results(request):

    preview_results = []
    preview_start = None
    preview_end = None
    preview_weeks = None

    if request.method == "POST" and request.FILES.get("file"):
        try:
            f = request.FILES["file"]
            file_bytes = f.read()
            filename = f.name

            df, weeks, months_preview, from_date, to_date = load_and_clean(file_bytes, filename)
            training_counts = {}

            if request.FILES.get("training_file"):
                tr_f = request.FILES['training_file']
                tr_bytes = tr_f.read()

                try:
                    tr_df_raw = pd.read_excel(io.BytesIO(tr_bytes), header=None)
                except Exception:
                    tr_df_raw = pd.read_csv(io.BytesIO(tr_bytes), header=None)

                tr_from_date, tr_to_date, header_row_index = parse_training_period_and_header(tr_df_raw)
                if header_row_index == -1:
                    raise ValueError("Training report must contain valid name headers.")

                try:
                    tr_df = pd.read_excel(io.BytesIO(tr_bytes), skiprows=header_row_index)
                except Exception:
                    tr_df = pd.read_csv(io.BytesIO(tr_bytes), skiprows=header_row_index)

                training_counts = parse_training_counts(tr_df, tr_f.name)

            preview_scored = score_dataframe(df, weeks, months_preview, training_counts)

            for r in preview_scored:
                preview_results.append({
                    "name": r["name"],
                    "total": r["total_score"],
                    "color": r["color"],
                })

            preview_start = from_date
            preview_end = to_date
            preview_weeks = weeks

        except Exception as e:
            return render(request, "reports/score_results_list.html", {"error": str(e)})

    results = ScoreResult.objects.select_related("member", "report")

    if not results.exists():
        return render(request, "reports/score_results_list.html", {"error": "No stored scores found."})

    months = list(
        results.order_by("report__end_date")
               .values_list("period_label", flat=True)
               .distinct()
    )

    raw_scores = defaultdict(dict)
    member_names = set()

    for r in results:
        if not r.member:
            continue
        name = r.member.full_name
        if is_ignored_member(name):
            continue
        member_names.add(name)
        raw_scores[name][r.period_label] = r.total_score

    sorted_members = sorted(
        member_names,
        key=lambda n: sum(raw_scores[n].values()),
        reverse=True
    )

    max_score = max([v for m in raw_scores.values() for v in m.values()], default=100)

    table_data = []
    for name in sorted_members:
        row = {"member": name, "scores": []}
        for month in months:
            score = raw_scores[name].get(month)
            if score is None:
                row["scores"].append({"value": "-", "color": "#f0f0f0"})
            else:
                row["scores"].append({
                    "value": score,
                    "color": _color_by_absolute(score, max_score)
                })
        table_data.append(row)

    drill_dict = defaultdict(list)

    for r in results.order_by("-total_score"):
        name = r.member.full_name
        if is_ignored_member(name):
            continue
        drill_dict[r.period_label].append({
            "name": name,
            "total": r.total_score,
            "total_color": _color_by_absolute(r.total_score or 0, 100),
            "absent": r.absenteeism_score,
            "ref": r.ref_score,
            "tyfcb": r.tyfcb_score,
            "visitors": r.visitor_score,
            "testimonials": r.testimonial_score,
            "on_time": r.on_time_score,
            "training": r.training_score,
        })

    drilldown_list = []
    for month in months:
        drilldown_list.append({
            "month": month,
            "slug": month.replace(" ", "-").lower(),
            "rows": sorted(drill_dict[month], key=lambda x: x["total"], reverse=True),
        })

    return render(request, "reports/score_results_list.html", {
        "preview_results": preview_results,
        "preview_start": preview_start,
        "preview_end": preview_end,
        "preview_weeks": preview_weeks,

        "months": months,
        "table_data": table_data,
        "all_months": months,
        "drilldown_list": drilldown_list,
    })


def month_detail_view(request):
    """
    Drill-down view for a selected month:
    Shows detailed scores for ALL members for ONE month.
    """

    # Read GET param
    period = request.GET.get("period")

    if not period:
        return render(request, "reports/month_detail.html", {
            "error": "No month selected."
        })

    # Fetch only results for this month
    results = ScoreResult.objects.select_related("member", "report") \
                                 .filter(period_label=period) \
                                 .order_by("member__full_name")

    if not results.exists():
        return render(request, "reports/month_detail.html", {
            "error": f"No results found for {period}."
        })

    # -------------------------
    # Build row list
    # -------------------------
    rows = []

    for r in results:
        if not r.member:
            continue

        name = r.member.full_name
        if is_ignored_member(name):
            continue

        rows.append({
            "name": name,
            "total": r.total_score,

            "absent": r.absenteeism_score,
            "referrals": r.ref_score,
            "tyfcb": r.tyfcb_score,
            "visitors": r.visitor_score,
            "testimonials": r.testimonial_score,
            "on_time": r.on_time_score,
            "training": r.training_score,

            "report_start": r.report.start_date,
            "report_end": r.report.end_date,
        })

    # -------------------------
    # Sort highest → lowest
    # -------------------------
    rows = sorted(rows, key=lambda r: r["total"], reverse=True)

    # -------------------------
    # Send to template
    # -------------------------
    return render(request, "reports/month_detail.html", {
        "period": period,
        "rows": rows,
    })


from collections import defaultdict
from django.shortcuts import render
from .models import ScoreResult, MemberData

def member_analysis_view(request):

    selected_member = request.GET.get("member")

    results = (
        ScoreResult.objects
        .select_related("member", "report")
        .order_by("report__start_date")
    )

    if not results.exists():
        return render(request, "reports/member_analysis.html", {
            "error": "No stored score results found.",
            "member_names": [],
            "selected_member": None,
            "members": [],
            "suggestions": [],
        })

    # ----------------------------
    # Group by valid members
    # ----------------------------
    members = defaultdict(list)

    for r in results:
        name = r.member.full_name

        if is_ignored_member(name):
            continue

        total = r.total_score
        color = _color_by_absolute(total, 100)

        members[name].append({
            "period": r.period_label,
            "date": r.report.end_date,
            "total": r.total_score,
            "color": color,
            "absent": {"value": r.absenteeism_score},
            "referrals": {"value": r.ref_score},
            "tyfcb": {"value": r.tyfcb_score},
            "visitors": {"value": r.visitor_score},
            "testimonials": {"value": r.testimonial_score},
            "on_time": {"value": r.on_time_score},
            "training": {"value": r.training_score},
            "report_obj": r.report,
            "member_obj": r.member,
        })

    member_names = sorted(members.keys())
    final_members = []
    suggestions = []

    # ------------------------------------------------------------
    # If a member is selected → show details + generate suggestions
    # ------------------------------------------------------------
    if selected_member and selected_member in members:
        records = sorted(members[selected_member], key=lambda r: r["date"])
        final_members = [(selected_member, records)]

        latest = records[-1]  # most recent snapshot

        # -----------------------------------------
        # Pull raw MemberData for per-week metrics
        # -----------------------------------------
        try:
            md = MemberData.objects.get(
                member=latest["member_obj"],
                report=latest["report_obj"]
            )
        except MemberData.DoesNotExist:
            md = None

        if md:
            # Total meets logic (P + A + S + M)
            total_meets = (md.P or 0) + (md.A or 0) + (md.S or 0) + (md.M or 0)
            total_meets = total_meets if total_meets > 0 else 1

            # Per-week metrics for detailed suggestions
            ref_per_week = ((md.RGI or 0) + (md.RGO or 0)) / total_meets
            visitors_per_week = (md.V or 0) / total_meets
            testimonials_per_week = (md.T or 0) / total_meets

            # Feed ALL needed data into suggestion function
            suggestions = generate_suggestions({
                'referrals_week_score': latest["referrals"]["value"],
                'visitors_week_score': latest["visitors"]["value"],
                'absenteeism_score': latest["absent"]["value"],
                'training_score': latest["training"]["value"],
                'testimonials_week_score': latest["testimonials"]["value"],
                'tyfcb_score': latest["tyfcb"]["value"],
                'arriving_on_time_score': latest["on_time"]["value"],

                # ✅ Extra raw data for numeric suggestions
                'A': md.A or 0,
                'CEU': md.CEU or 0,
                'TYFCB': md.TYFCB or 0,
                'ref_per_week': ref_per_week,
                'visitors_per_week': visitors_per_week,
                'testimonials_per_week': testimonials_per_week,
            })

    return render(request, "reports/member_analysis.html", {
        "members": final_members,
        "member_names": member_names,
        "selected_member": selected_member,
        "suggestions": suggestions,
    })
