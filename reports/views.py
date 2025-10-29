import pandas as pd
from django.shortcuts import render
from datetime import datetime
from .forms import ExcelUploadForm
from .models import Member, ReportingPeriod, MemberMonthlyReport, UploadBatch
from django.db.models import Count
from dateutil import parser as date_parser


from datetime import datetime
import pandas as pd
from dateutil import parser as date_parser
from django.shortcuts import render
from .forms import ExcelUploadForm
from .models import Member, ReportingPeriod, UploadBatch, MemberMonthlyReport

def upload_excel(request):
    results = []
    from_date = None
    to_date = None
    saved_count = 0
    save_errors = []

    if request.method == 'POST' and request.FILES.get('file'):
        uploaded_file = request.FILES['file']

        try:
            # --- Read Excel/CSV File ---
            file_name = uploaded_file.name.lower()
            if file_name.endswith('.csv'):
                df_raw = pd.read_csv(uploaded_file, header=None)
            elif file_name.endswith('.xls'):
                df_raw = pd.read_excel(uploaded_file, engine='xlrd', header=None)
            elif file_name.endswith('.xlsx'):
                df_raw = pd.read_excel(uploaded_file, engine='openpyxl', header=None)
            else:
                raise ValueError("Unsupported file format. Please upload .xlsx, .xls, or .csv")

            # --- Locate Header Row ---
            header_row_idx = None
            for idx, row in df_raw.iterrows():
                first_cell = str(row.iloc[0]).strip().lower()
                if "first" in first_cell and "name" in first_cell:
                    header_row_idx = idx
                    break
            if header_row_idx is None:
                raise ValueError("Could not find 'First Name' header in the file")

            # --- Extract Dates ---
            metadata_rows = df_raw.iloc[:header_row_idx]
            start_date_obj, end_date_obj = extract_reporting_period(metadata_rows)
            from_date, to_date = start_date_obj, end_date_obj
            weeks = max(((end_date_obj - start_date_obj).days / 7), 1)

            # --- Get or Clean Reporting Period ---
            period = get_or_create_reporting_period_and_clean_duplicates(start_date_obj, end_date_obj)

            # --- Create Upload Batch ---
            batch = UploadBatch.objects.create(
                original_filename=uploaded_file.name,
                start_date=start_date_obj,
                end_date=end_date_obj,
            )

            # --- Prepare DataFrame ---
            df_raw.columns = df_raw.iloc[header_row_idx]
            df = df_raw.iloc[header_row_idx + 1:].copy().reset_index(drop=True)
            df.columns = [str(c).strip().replace(" ", "_").replace("-", "_") for c in df.columns]
            df = df.fillna(0)

            numeric_cols = [
                "P", "A", "L", "M", "S", "RGI", "RGO", "RRI", "RRO",
                "V", "1_2_1", "1-2-1", "TYFCB", "CEU", "T", "Testimonials"
            ]
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

            # --- Process Each Row ---
            for _, row in df.iterrows():
                try:
                    P = int(row.get("P", 0))
                    A = int(row.get("A", 0))
                    L = int(row.get("L", 0))
                    M = int(row.get("M", 0))
                    S = int(row.get("S", 0))
                    RGI = int(row.get("RGI", 0))
                    RGO = int(row.get("RGO", 0))
                    RRI = int(row.get("RRI", 0))
                    RRO = int(row.get("RRO", 0))
                    V = int(row.get("V", 0))
                    one_to_one = int(row.get("1_2_1", row.get("1-2-1", 0)))
                    TYFCB = int(row.get("TYFCB", 0))
                    CEU = int(row.get("CEU", 0))
                    T = int(row.get("T", 0))
                    testimonials = int(row.get("Testimonials", 0))

                    total_meetings = P + A + L + S + M
                    attendance = (P + S + M) / total_meetings if total_meetings > 0 else 0
                    total_referrals = RGI + RGO + RRI + RRO
                    referrals_per_week = total_referrals / weeks
                    visitors_per_week = V / weeks
                    testimonials_per_week = testimonials / weeks

                    abs_score = 15 if A == 0 else (10 if A == 1 else (5 if A == 2 else 0))
                    ref_score = 0 if referrals_per_week < 0.5 else (
                        5 if referrals_per_week < 0.75 else (
                            10 if referrals_per_week < 1 else (
                                15 if referrals_per_week < 1.2 else 20)))
                    vis_score = 0 if visitors_per_week < 0.1 else (
                        5 if visitors_per_week < 0.25 else (
                            10 if visitors_per_week < 0.5 else (
                                15 if visitors_per_week < 0.75 else 20)))
                    train_score = 0 if CEU == 0 else (5 if CEU == 1 else (10 if CEU == 2 else 15))
                    tyfcb_score = 0 if TYFCB < 500000 else (
                        5 if TYFCB < 1000000 else (10 if TYFCB < 2000000 else 15))
                    time_score = 0 if L >= 1 else 5
                    testi_score = 0 if testimonials_per_week <= 0 else (5 if testimonials_per_week < 0.075 else 10)

                    total_score = abs_score + ref_score + vis_score + train_score + tyfcb_score + time_score + testi_score
                    color = "GREEN" if total_score >= 70 else ("AMBER" if total_score >= 50 else ("RED" if total_score >= 30 else "GREY"))

                    first_name = str(row.get("First_Name", "")).strip()[:150]
                    last_name = str(row.get("Last_Name", "")).strip()[:150]
                    member, _ = Member.objects.get_or_create(first_name=first_name, last_name=last_name)

                    MemberMonthlyReport.objects.create(
                        member=member,
                        period=period,
                        batch=batch,
                        P=P, A=A, L=L, M=M, S=S,
                        RGI=RGI, RGO=RGO, RRI=RRI, RRO=RRO,
                        V=V, one_to_one=one_to_one,
                        TYFCB=TYFCB, CEU=CEU, T=T,
                        total_score=total_score, color=color,
                    )
                    saved_count += 1
                    results.append({"First_Name": first_name, "Last_Name": last_name, "Total_Score": total_score, "Color": color})
                except Exception as save_err:
                    msg = f"Error saving row: {save_err}"
                    print(msg)
                    save_errors.append(msg)

        except Exception as e:
            error_message = f"Error processing file: {str(e)}"
            print(error_message)
            return render(request, 'upload_excel.html', {
                "form": ExcelUploadForm(),
                "results": [],
                "error": error_message,
                "from_date": None,
                "to_date": None,
                "save_errors": save_errors,
            })

    form = ExcelUploadForm()
    return render(request, 'upload_excel.html', {
        "form": form,
        "results": results,
        "from_date": from_date,
        "to_date": to_date,
        "saved_count": saved_count,
        "save_errors": save_errors,
    })

import re
from datetime import datetime
import pandas as pd
from .models import Member, ReportingPeriod, MemberMonthlyReport, UploadBatch

def extract_reporting_period(metadata_rows):
    """
    Extract 'From' and 'To' dates from metadata rows in the uploaded Excel/CSV.
    Returns (start_date_obj, end_date_obj)
    """

    def parse_flexible_date(date_str):
        """Try multiple date formats and clean extra characters."""
        if not date_str:
            return None
        date_str = str(date_str).strip()
        date_str = re.sub(r'[^0-9A-Za-z:/\- ]', '', date_str)  # remove junk
        date_str = date_str.split()[0]  # remove time part if present
        for fmt in [
            "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y",
            "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y", "%b-%d-%Y"
        ]:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    from_date_raw, to_date_raw = None, None
    for _, row in metadata_rows.iterrows():
        row_str = ' '.join([str(cell) for cell in row if pd.notna(cell)])
        if 'from' in row_str.lower():
            parts = row_str.split(':')
            if len(parts) > 1:
                from_date_raw = parts[1].strip()
        if 'to' in row_str.lower():
            parts = row_str.split(':')
            if len(parts) > 1:
                to_date_raw = parts[1].strip()

    # Parse both dates
    start_date_obj = parse_flexible_date(from_date_raw)
    end_date_obj = parse_flexible_date(to_date_raw)

    # Fallback to today if parsing fails
    if not start_date_obj or not end_date_obj:
        today = datetime.today().date()
        start_date_obj = start_date_obj or today
        end_date_obj = end_date_obj or today

    print(f"🧾 Raw extracted dates: '{from_date_raw}' → '{to_date_raw}'")
    print(f"📅 Detected period: {start_date_obj} → {end_date_obj}")
    print(f"🗓 Year: {start_date_obj.year}, Month: {start_date_obj.month}")

    return start_date_obj, end_date_obj

def get_or_create_reporting_period_and_clean_duplicates(start_date_obj, end_date_obj):
    """
    Get or create a ReportingPeriod for the given start/end dates.
    Also deletes any existing MemberMonthlyReport for that period to prevent duplicates.
    """
    period_year = start_date_obj.year
    period_month = start_date_obj.month

    period, _ = ReportingPeriod.objects.get_or_create(
        year=period_year,
        month=period_month,
        defaults={"start_date": start_date_obj, "end_date": end_date_obj}
    )

    # Clean up any previous data for the same month
    existing_records = MemberMonthlyReport.objects.filter(period=period)
    if existing_records.exists():
        print(f"🧹 Removing {existing_records.count()} old records for {period_year}-{period_month}")
        existing_records.delete()

    return period



from django.shortcuts import render
from .models import MemberMonthlyReport
import pandas as pd

def reports_summary(request):
    """Show a simple pivot table of members vs. months with total_score."""
    qs = (
        MemberMonthlyReport.objects
        .select_related("member", "period")
        .order_by("member__first_name", "member__last_name")
    )

    if not qs.exists():
        return render(request, "simple_summary.html", {"pivot_html": None})

    data = []
    for r in qs:
        data.append({
            "member": f"{r.member.first_name} {r.member.last_name}",
            "year": r.period.year,
            "month": r.period.month,
            "score": r.total_score,
        })

    df = pd.DataFrame(data)

    # Create a pivot table
    pivot = pd.pivot_table(
        df,
        values="score",
        index="member",
        columns=["year", "month"],
        aggfunc="first",
        fill_value=""
    )

    # Rename columns like “Apr 2025”
    pivot.columns = [
        pd.Timestamp(year=y, month=m, day=1).strftime("%b %Y")
        for y, m in pivot.columns
    ]

    # Sort members alphabetically
    pivot = pivot.sort_index()

    # Convert to HTML
    html = pivot.to_html(classes="summary-table", border=0)

    return render(request, "report_summary.html", {"pivot_html": html})





def list_reports(request):
    """Display stored monthly reports in a simple table with optional filters."""
    qs = MemberMonthlyReport.objects.select_related('member', 'period').order_by('-period__year', '-period__month', 'member__last_name', 'member__first_name')

    year = request.GET.get('year')
    month = request.GET.get('month')
    if year:
        qs = qs.filter(period__year=year)
    if month:
        qs = qs.filter(period__month=month)

    return render(request, 'reports_list.html', {
        "reports": qs,
        "records_count": qs.count(),
        "filter_year": year or "",
        "filter_month": month or "",
    })


def months_index(request):
    """Show list of available months (reporting periods) for drill-down."""
    periods = ReportingPeriod.objects.annotate(report_count=Count('member_reports')).order_by('-year', '-month')
    return render(request, 'reports_months.html', {
        "periods": periods,
    })


def list_reports_month(request, year: int, month: int):
    """Drill-down table for a specific month."""
    qs = MemberMonthlyReport.objects.select_related('member', 'period').filter(
        period__year=year, period__month=month
    ).order_by('member__last_name', 'member__first_name')
    return render(request, 'reports_list.html', {
        "reports": qs,
        "filter_year": year,
        "filter_month": month,
    })

from django.shortcuts import redirect
from django.contrib import messages
from django.views.decorators.http import require_POST

@require_POST
def delete_all_reports(request):
    """Delete all MemberMonthlyReport records (with confirmation)."""
    try:
        count = MemberMonthlyReport.objects.count()
        MemberMonthlyReport.objects.all().delete()
        ReportingPeriod.objects.all().delete()
        Member.objects.all().delete()
        messages.success(request, f"✅ Deleted {count} reports and all related data successfully.")
    except Exception as e:
        messages.error(request, f"⚠️ Error deleting records: {e}")
    return redirect('list_reports')
