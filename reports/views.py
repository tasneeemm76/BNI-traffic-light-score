import re
import pandas as pd
from datetime import datetime
import datetime
from dateutil import parser as date_parser
from datetime import datetime
from django.db.models import Count
from django.shortcuts import render, redirect
from django.contrib import messages
from django.views.decorators.http import require_POST

from .forms import ExcelUploadForm
from .models import Member, ReportingPeriod, MemberMonthlyReport, UploadBatch

import re
import pandas as pd
from datetime import datetime
from django.shortcuts import render
from .forms import ExcelUploadForm
from .models import Member, ReportingPeriod, MemberMonthlyReport, UploadBatch


def upload_excel(request):
    """Handle upload and saving of Excel or CSV files (no score calculation)."""
    results, save_errors = [], []
    from_date = to_date = None
    saved_count = 0

    if request.method == "POST" and request.FILES.get("file"):
        uploaded_file = request.FILES["file"]
        try:
            # --- Read Excel or CSV ---
            file_name = uploaded_file.name.lower()
            if file_name.endswith(".csv"):
                df_raw = pd.read_csv(uploaded_file, header=None)
            elif file_name.endswith(".xls"):
                df_raw = pd.read_excel(uploaded_file, engine="xlrd", header=None)
            elif file_name.endswith(".xlsx"):
                df_raw = pd.read_excel(uploaded_file, engine="openpyxl", header=None)
            else:
                raise ValueError("Unsupported file format. Please upload .xlsx, .xls, or .csv")

            # --- Locate Header Row ---
            header_row_idx = next(
                (i for i, row in df_raw.iterrows()
                 if "first" in str(row.iloc[0]).lower() and "name" in str(row.iloc[0]).lower()),
                None
            )
            if header_row_idx is None:
                raise ValueError("Could not find 'First Name' header in the file")

            # --- Extract Reporting Dates ---
            metadata_rows = df_raw.iloc[:header_row_idx]
            start_date_obj, end_date_obj = extract_reporting_period(metadata_rows)
            from_date, to_date = start_date_obj, end_date_obj

            # --- Create Period and Batch ---
            period = get_or_create_reporting_period_and_clean_duplicates(start_date_obj, end_date_obj)
            batch = UploadBatch.objects.create(
                original_filename=uploaded_file.name,
                start_date=start_date_obj,
                end_date=end_date_obj,
            )

            # --- Prepare Data ---
            df_raw.columns = df_raw.iloc[header_row_idx]
            df = df_raw.iloc[header_row_idx + 1:].copy().reset_index(drop=True)
            df.columns = [str(c).strip().replace(" ", "_").replace("-", "_") for c in df.columns]
            df = df.fillna(0)

            # --- Convert numeric fields ---
            numeric_cols = [
                "P", "A", "L", "M", "S", "RGI", "RGO", "RRI", "RRO",
                "V", "TYFCB", "CEU", "T", "Testimonials"
            ]
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

            # --- Save Each Row ---
            for _, row in df.iterrows():
                try:
                    member, _ = Member.objects.get_or_create(
                        first_name=str(row.get("First_Name", "")).strip()[:150],
                        last_name=str(row.get("Last_Name", "")).strip()[:150],
                    )

                    MemberMonthlyReport.objects.create(
                        member=member,
                        period=period,
                        batch=batch,
                        P=row.get("P", 0),
                        A=row.get("A", 0),
                        L=row.get("L", 0),
                        M=row.get("M", 0),
                        S=row.get("S", 0),
                        RGI=row.get("RGI", 0),
                        RGO=row.get("RGO", 0),
                        RRI=row.get("RRI", 0),
                        RRO=row.get("RRO", 0),
                        V=row.get("V", 0),
                        TYFCB=row.get("TYFCB", 0),
                        CEU=row.get("CEU", 0),
                        T=row.get("T", 0),
                    )

                    saved_count += 1
                    results.append({
                        "First_Name": member.first_name,
                        "Last_Name": member.last_name,
                    })

                except Exception as save_err:
                    msg = f"Error saving row: {save_err}"
                    print(msg)
                    save_errors.append(msg)

        except Exception as e:
            error_message = f"Error processing file: {e}"
            print(error_message)
            return render(request, "upload_excel.html", {
                "form": ExcelUploadForm(),
                "results": [],
                "error": error_message,
                "save_errors": save_errors,
            })

    return render(request, "upload_excel.html", {
        "form": ExcelUploadForm(),
        "results": results,
        "from_date": from_date,
        "to_date": to_date,
        "saved_count": saved_count,
        "save_errors": save_errors,
    })


def extract_reporting_period(metadata_rows):
    """Extract 'From' and 'To' dates from metadata rows."""
    def parse_flexible_date(date_str):
        if not date_str:
            return None
        date_str = re.sub(r"[^0-9A-Za-z:/\- ]", "", str(date_str).strip()).split()[0]
        for fmt in [
            "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y",
            "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%b-%d-%Y",
        ]:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    from_date_raw = to_date_raw = None
    for _, row in metadata_rows.iterrows():
        row_str = " ".join([str(cell) for cell in row if pd.notna(cell)])
        if "from" in row_str.lower():
            from_date_raw = row_str.split(":")[1].strip()
        if "to" in row_str.lower():
            to_date_raw = row_str.split(":")[1].strip()

    today = datetime.today().date()
    start = parse_flexible_date(from_date_raw) or today
    end = parse_flexible_date(to_date_raw) or today
    return start, end


def get_or_create_reporting_period_and_clean_duplicates(start_date_obj, end_date_obj):
    """Get or create ReportingPeriod and delete old reports for same month."""
    period, _ = ReportingPeriod.objects.get_or_create(
        year=start_date_obj.year,
        month=start_date_obj.month,
        defaults={"start_date": start_date_obj, "end_date": end_date_obj},
    )

    existing = MemberMonthlyReport.objects.filter(period=period)
    if existing.exists():
        existing.delete()

    return period


# ----------------------------------------------------------------------
# REPORT VIEWS
# ----------------------------------------------------------------------

def list_reports(request):
    """Display stored monthly reports."""
    qs = MemberMonthlyReport.objects.select_related("member", "period").order_by(
        "-period__year", "-period__month", "member__last_name", "member__first_name"
    )

    year = request.GET.get("year")
    month = request.GET.get("month")
    if year:
        qs = qs.filter(period__year=year)
    if month:
        qs = qs.filter(period__month=month)

    return render(request, "reports_list.html", {
        "reports": qs,
        "records_count": qs.count(),
        "filter_year": year or "",
        "filter_month": month or "",
    })


def months_index(request):
    """Show list of available reporting periods."""
    periods = ReportingPeriod.objects.annotate(report_count=Count("member_reports")).order_by("-year", "-month")
    return render(request, "reports_months.html", {"periods": periods})


def list_reports_month(request, year, month):
    """Drill-down for a specific month."""
    qs = MemberMonthlyReport.objects.select_related("member", "period").filter(
        period__year=year, period__month=month
    ).order_by("member__last_name", "member__first_name")
    return render(request, "reports_list.html", {"reports": qs, "filter_year": year, "filter_month": month})


@require_POST
def delete_all_reports(request):
    """Delete all report-related records."""
    try:
        count = MemberMonthlyReport.objects.count()
        MemberMonthlyReport.objects.all().delete()
        ReportingPeriod.objects.all().delete()
        Member.objects.all().delete()
        messages.success(request, f"✅ Deleted {count} reports and related data.")
    except Exception as e:
        messages.error(request, f"⚠️ Error deleting records: {e}")
    return redirect("list_reports")

from datetime import date
from django.db.models import Sum, Max
from django.shortcuts import render
from .models import MemberMonthlyReport, ReportingPeriod


def reports_summary(request):
    """
    Generates a 6-month summary report applying the given scoring rules.
    """

    # --- Get latest available reporting period ---
    latest_period = ReportingPeriod.objects.aggregate(Max("end_date"))["end_date__max"]
    if not latest_period:
        return render(request, "report_summary.html", {"message": "No reporting data available."})

    latest_month = latest_period.month
    latest_year = latest_period.year
    start_month = latest_month - 5
    start_year = latest_year
    if start_month <= 0:
        start_month += 12
        start_year -= 1

    six_month_qs = ReportingPeriod.objects.filter(
        start_date__year__gte=start_year,
        start_date__lte=date(latest_year, latest_month, 28)
    ).order_by("-start_date")[:6]
    six_month_periods = list(six_month_qs)[::-1]

    if not six_month_periods:
        return render(request, "report_summary.html", {"message": "Insufficient data for 6-month report."})

    reports = MemberMonthlyReport.objects.select_related("member", "period").filter(
        period__in=six_month_periods
    )

    total_weeks = len(six_month_periods) * 4.33 if six_month_periods else 0.0

    summary = (
        reports.values("member__id", "member__first_name", "member__last_name")
        .annotate(
            total_A=Sum("A"),
            total_RGI=Sum("RGI"), total_RGO=Sum("RGO"),
            total_RRI=Sum("RRI"), total_RRO=Sum("RRO"),
            total_V=Sum("V"),
            total_TYFCB=Sum("TYFCB"),
            total_CEU=Sum("CEU"),
            total_T=Sum("T"),
        )
        .order_by("member__first_name")
    )

    # --- Helper scoring function for reuse (same logic as before) ---
    def compute_score(row, total_weeks):
        total_referrals = sum([
            row.get("total_RGI") or 0,
            row.get("total_RGO") or 0,
            row.get("total_RRI") or 0,
            row.get("total_RRO") or 0,
        ])
        total_visitors = row.get("total_V") or 0
        total_tyfcb = row.get("total_TYFCB") or 0
        total_training = row.get("total_CEU") or 0
        total_testimonials = row.get("total_T") or 0
        total_absents = row.get("total_A") or 0

        referrals_per_week = (total_referrals / total_weeks) if total_weeks else 0.0
        visitors_per_week = (total_visitors / total_weeks) if total_weeks else 0.0
        testimonials_per_week = (total_testimonials / total_weeks) if total_weeks else 0.0

        # Referrals/week
        if referrals_per_week < 0.5:
            ref_score = 0
        elif referrals_per_week < 0.75:
            ref_score = 5
        elif referrals_per_week < 1:
            ref_score = 10
        elif referrals_per_week < 1.2:
            ref_score = 15
        else:
            ref_score = 20

        # Visitors/week
        if visitors_per_week < 0.1:
            vis_score = 0
        elif visitors_per_week < 0.25:
            vis_score = 5
        elif visitors_per_week < 0.5:
            vis_score = 10
        elif visitors_per_week < 0.75:
            vis_score = 15
        else:
            vis_score = 20

        # Absenteeism
        if total_absents > 2:
            abs_score = 0
        elif total_absents == 2:
            abs_score = 5
        elif total_absents == 1:
            abs_score = 10
        else:
            abs_score = 15

        # Training
        if total_training == 0:
            train_score = 0
        elif total_training == 1:
            train_score = 5
        elif total_training == 2:
            train_score = 10
        else:
            train_score = 15

        # Testimonials/week
        if testimonials_per_week <= 0:
            testi_score = 0
        elif testimonials_per_week < 0.075:
            testi_score = 5
        else:
            testi_score = 10

        # TYFCB
        if total_tyfcb < 500000:
            tyfcb_score = 0
        elif total_tyfcb < 1000000:
            tyfcb_score = 5
        elif total_tyfcb < 2000000:
            tyfcb_score = 10
        else:
            tyfcb_score = 15

        arriving_score = 0 if total_absents >= 1 else 5

        total_score = (
            ref_score + vis_score + abs_score +
            train_score + testi_score + tyfcb_score + arriving_score
        )

        if total_score >= 70:
            color = "GREEN"
        elif total_score >= 50:
            color = "AMBER"
        elif total_score >= 30:
            color = "RED"
        else:
            color = "GREY"

        return total_score, color

    # --- Overall member totals ---
    table_rows = []
    for s in summary:
        total_score, color = compute_score(s, total_weeks)
        table_rows.append({
            "member": f"{s['member__first_name']} {s['member__last_name']}",
            "total_score": total_score,
            "color": color,
        })

    # --- Per-month average and member scores (for graphs) ---
    monthly_scores = []
    average_scores = []

    for period in six_month_periods:
        month_reports = reports.filter(period=period)
        if not month_reports.exists():
            continue

        month_rows = []
        for mr in month_reports.values(
            "member__first_name", "member__last_name",
            "A", "RGI", "RGO", "RRI", "RRO", "V", "TYFCB", "CEU", "T"
        ):
            score, _ = compute_score({
                "total_A": mr["A"],
                "total_RGI": mr["RGI"], "total_RGO": mr["RGO"],
                "total_RRI": mr["RRI"], "total_RRO": mr["RRO"],
                "total_V": mr["V"], "total_TYFCB": mr["TYFCB"],
                "total_CEU": mr["CEU"], "total_T": mr["T"]
            }, 4.33)  # one month ~4.33 weeks
            month_rows.append({
                "member": f"{mr['member__first_name']} {mr['member__last_name']}",
                "score": score,
            })

        monthly_scores.append({
            "month": period.start_date.strftime("%b %Y"),
            "scores": month_rows,
        })
        # average for that month
        avg = round(sum(mr["score"] for mr in month_rows) / len(month_rows), 1) if month_rows else 0
        average_scores.append({
            "month": period.start_date.strftime("%b %Y"),
            "average_score": avg,
        })

    # --- Legend ---
    total_members = len(table_rows)
    color_count = {"GREEN": 0, "AMBER": 0, "RED": 0, "GREY": 0}
    for r in table_rows:
        color_count[r["color"]] += 1
    legend_data = [
        {
            "color": c,
            "count": color_count[c],
            "percentage": round((color_count[c] / total_members) * 100, 1) if total_members else 0
        }
        for c in color_count
    ]

    # --- Context ---
    period_label = f"{six_month_periods[0].start_date.strftime('%b %Y')} – {six_month_periods[-1].end_date.strftime('%b %Y')}"

    context = {
        "period_label": period_label,
        "chapter_name": "PATRONS",
        "region_name": "Delhi Central",
        "table_rows": sorted(table_rows, key=lambda x: x["total_score"], reverse=True),
        "legend_data": legend_data,
        "average_scores": average_scores,
        "monthly_scores": monthly_scores,
    }

    return render(request, "report_summary.html", context)

