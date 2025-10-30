import re
import pandas as pd
from datetime import datetime
from dateutil import parser as date_parser

from django.db.models import Count
from django.shortcuts import render, redirect
from django.contrib import messages
from django.views.decorators.http import require_POST

from .forms import ExcelUploadForm
from .models import Member, ReportingPeriod, MemberMonthlyReport, UploadBatch


# ----------------------------------------------------------------------
# SCORE CALCULATION LOGIC
# ----------------------------------------------------------------------

def calculate_scores(P, A, L, M, S, RGI, RGO, RRI, RRO, V, CEU, TYFCB, T, testimonials, weeks):
    """Calculates total score and color based on business rules."""
    total_meetings = P + A + L + S + M
    total_referrals = RGI + RGO + RRI + RRO
    referrals_per_week = total_referrals / weeks if weeks > 0 else 0
    visitors_per_week = V / weeks if weeks > 0 else 0
    testimonials_per_week = testimonials / weeks if weeks > 0 else 0

    # Referrals / Week
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

    # Avg. Visitors / Week
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
    abs_score = 15 if A == 0 else 10 if A == 1 else 5 if A == 2 else 0

    # Training
    train_score = 0 if CEU == 0 else 5 if CEU == 1 else 10 if CEU == 2 else 15

    # Testimonials / Week
    testi_score = 0 if testimonials_per_week <= 0 else 5 if testimonials_per_week < 0.075 else 10

    # TYFCB
    if TYFCB < 500000:
        tyfcb_score = 0
    elif TYFCB < 1000000:
        tyfcb_score = 5
    elif TYFCB < 2000000:
        tyfcb_score = 10
    else:
        tyfcb_score = 15

    # Arriving on time
    time_score = 0 if L >= 1 else 5

    total_score = ref_score + vis_score + abs_score + train_score + testi_score + tyfcb_score + time_score

    if total_score >= 70:
        color = "GREEN"
    elif total_score >= 50:
        color = "AMBER"
    elif total_score >= 30:
        color = "RED"
    else:
        color = "GREY"

    return {
        "total_score": total_score,
        "color": color,
        "details": {
            "ref_score": ref_score,
            "vis_score": vis_score,
            "abs_score": abs_score,
            "train_score": train_score,
            "testi_score": testi_score,
            "tyfcb_score": tyfcb_score,
            "time_score": time_score,
        },
    }


# ----------------------------------------------------------------------
# FILE UPLOAD AND PARSING LOGIC
# ----------------------------------------------------------------------

def upload_excel(request):
    """Handle upload and processing of Excel or CSV files."""
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
            weeks = max(((end_date_obj - start_date_obj).days / 7), 1)

            # --- Create Period and Batch ---
            period = get_or_create_reporting_period_and_clean_duplicates(start_date_obj, end_date_obj)
            batch = UploadBatch.objects.create(
                original_filename=uploaded_file.name,
                start_date=start_date_obj,
                end_date=end_date_obj,
            )

            # --- Clean Data ---
            df_raw.columns = df_raw.iloc[header_row_idx]
            df = df_raw.iloc[header_row_idx + 1:].copy().reset_index(drop=True)
            df.columns = [str(c).strip().replace(" ", "_").replace("-", "_") for c in df.columns]
            df = df.fillna(0)

            numeric_cols = [
                "P", "A", "L", "M", "S", "RGI", "RGO", "RRI", "RRO", "V",
                "TYFCB", "CEU", "T", "Testimonials"
            ]
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

            # --- Process Each Row ---
            for _, row in df.iterrows():
                try:
                    P, A, L, M, S = [int(row.get(x, 0)) for x in ["P", "A", "L", "M", "S"]]
                    RGI, RGO, RRI, RRO = [int(row.get(x, 0)) for x in ["RGI", "RGO", "RRI", "RRO"]]
                    V, CEU, T, TYFCB, testimonials = [
                        int(row.get(x, 0)) for x in ["V", "CEU", "T", "TYFCB", "Testimonials"]
                    ]

                    scores = calculate_scores(P, A, L, M, S, RGI, RGO, RRI, RRO, V, CEU, TYFCB, T, testimonials, weeks)

                    member, _ = Member.objects.get_or_create(
                        first_name=str(row.get("First_Name", "")).strip()[:150],
                        last_name=str(row.get("Last_Name", "")).strip()[:150],
                    )

                    MemberMonthlyReport.objects.create(
                        member=member,
                        period=period,
                        batch=batch,
                        P=P, A=A, L=L, M=M, S=S,
                        RGI=RGI, RGO=RGO, RRI=RRI, RRO=RRO,
                        V=V, TYFCB=TYFCB, CEU=CEU, T=T,
                        total_score=scores["total_score"],
                        color=scores["color"],
                    )

                    saved_count += 1
                    results.append({
                        "First_Name": member.first_name,
                        "Last_Name": member.last_name,
                        "Total_Score": scores["total_score"],
                        "Color": scores["color"],
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
                "from_date": None,
                "to_date": None,
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

    start = parse_flexible_date(from_date_raw)
    end = parse_flexible_date(to_date_raw)
    today = datetime.today().date()

    return start or today, end or today


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
