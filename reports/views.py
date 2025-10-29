import pandas as pd
from django.shortcuts import render
from datetime import datetime
from .forms import ExcelUploadForm
from .models import Member, ReportingPeriod, MemberMonthlyReport, UploadBatch
from django.db.models import Count
from dateutil import parser as date_parser
from django.shortcuts import render
from .forms import ExcelUploadForm
from .models import Member, ReportingPeriod, UploadBatch, MemberMonthlyReport

import re
from datetime import datetime
import pandas as pd

import pandas as pd
from django.shortcuts import render
from .models import Member, MemberMonthlyReport, UploadBatch
from .forms import ExcelUploadForm


def calculate_scores(P, A, L, M, S, RGI, RGO, RRI, RRO, V, CEU, TYFCB, T, testimonials, weeks):
    """Calculates all scores and color as per business rules."""

    # Derived metrics
    total_meetings = P + A + L + S + M
    total_referrals = RGI + RGO + RRI + RRO
    referrals_per_week = total_referrals / weeks if weeks > 0 else 0
    visitors_per_week = V / weeks if weeks > 0 else 0
    testimonials_per_week = testimonials / weeks if weeks > 0 else 0

    # ---- Score Logic ----

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
    if A > 2:
        abs_score = 0
    elif A == 2:
        abs_score = 5
    elif A == 1:
        abs_score = 10
    else:
        abs_score = 15

    # Training
    if CEU == 0:
        train_score = 0
    elif CEU == 1:
        train_score = 5
    elif CEU == 2:
        train_score = 10
    else:
        train_score = 15

    # Testimonials / Week
    if testimonials_per_week <= 0:
        testi_score = 0
    elif testimonials_per_week < 0.075:
        testi_score = 5
    else:
        testi_score = 10

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

    # Total Score
    total_score = ref_score + vis_score + abs_score + train_score + testi_score + tyfcb_score + time_score

    # Color
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
        }
    }



def upload_excel(request):
    results = []
    from_date = None
    to_date = None
    saved_count = 0
    save_errors = []

    if request.method == 'POST' and request.FILES.get('file'):
        uploaded_file = request.FILES['file']

        try:
            # --- Read Excel or CSV ---
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

            numeric_cols = ["P", "A", "L", "M", "S", "RGI", "RGO", "RRI", "RRO", "V", "TYFCB", "CEU", "T", "Testimonials"]
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
                    CEU = int(row.get("CEU", 0))
                    T = int(row.get("T", 0))
                    TYFCB = int(row.get("TYFCB", 0))
                    testimonials = int(row.get("Testimonials", 0))

                    # ---- Calculate all scores ----
                    scores = calculate_scores(P, A, L, M, S, RGI, RGO, RRI, RRO, V, CEU, TYFCB, T, testimonials, weeks)

                    # ---- Save Member and Report ----
                    first_name = str(row.get("First_Name", "")).strip()[:150]
                    last_name = str(row.get("Last_Name", "")).strip()[:150]
                    member, _ = Member.objects.get_or_create(first_name=first_name, last_name=last_name)

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
                        "First_Name": first_name,
                        "Last_Name": last_name,
                        "Total_Score": scores["total_score"],
                        "Color": scores["color"]
                    })

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

    # --- Return Template ---
    return render(request, 'upload_excel.html', {
        "form": ExcelUploadForm(),
        "results": results,
        "from_date": from_date,
        "to_date": to_date,
        "saved_count": saved_count,
        "save_errors": save_errors,
    })



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


from django.shortcuts import render
from .models import MemberMonthlyReport

def reports_summary(request):
    reports = MemberMonthlyReport.objects.select_related("member", "period")

    # --- Collect all unique months in ascending order ---
    months = sorted(
        {f"{r.period.year}-{r.period.month:02d}" for r in reports},
        key=lambda x: (int(x.split("-")[0]), int(x.split("-")[1])),
    )

    members = {r.member for r in reports}

    # --- Build table data (member × months) ---
    table_data = []
    avg_data = []

    for member in members:
        member_row = {"member": str(member), "scores": []}
        monthly_scores = []

        for m in months:
            year, month = map(int, m.split("-"))
            report = next(
                (r for r in reports if r.member == member and r.period.year == year and r.period.month == month),
                None,
            )
            if report:
                score = report.total_score
            else:
                score = None

            # color rule
            if score is None:
                color = "GREY"
            elif score >= 70:
                color = "GREEN"
            elif score >= 50:
                color = "AMBER"
            elif score >= 30:
                color = "RED"
            else:
                color = "GREY"

            member_row["scores"].append({"score": score, "color": color})
            if score is not None:
                monthly_scores.append(score)

        # Average score
        avg_score = round(sum(monthly_scores) / len(monthly_scores), 2) if monthly_scores else 0
        if avg_score >= 70:
            avg_color = "GREEN"
        elif avg_score >= 50:
            avg_color = "AMBER"
        elif avg_score >= 30:
            avg_color = "RED"
        else:
            avg_color = "GREY"

        avg_data.append({
            "member": str(member),
            "avg_score": avg_score,
            "color": avg_color,
        })

        table_data.append(member_row)

    # --- Generate HTML tables dynamically ---

    # Pivot Table (Right side)
    pivot_html = "<table class='summary-table'><thead><tr><th>Member</th>"
    for m in months:
        pivot_html += f"<th>{m}</th>"
    pivot_html += "</tr></thead><tbody>"
    for row in table_data:
        pivot_html += f"<tr><td>{row['member']}</td>"
        for s in row["scores"]:
            if s is None or s["score"] is None:
                pivot_html += "<td class='color-grey'></td>"
            else:
                color = s["color"].lower()
                pivot_html += f"<td class='color-{color}'>{s['score']}</td>"
        pivot_html += "</tr>"
    pivot_html += "</tbody></table>"

    # Average Table (Left side)
    avg_html = "<table class='summary-table'><thead><tr><th>Member</th><th>Average</th></tr></thead><tbody>"
    for a in sorted(avg_data, key=lambda x: x["avg_score"], reverse=True):
        color = a["color"].lower()
        avg_html += f"<tr><td>{a['member']}</td><td class='color-{color}'>{a['avg_score']}</td></tr>"
    avg_html += "</tbody></table>"

    # --- Dummy legend table (bottom) ---
    legend_html = """
    <table class='legend-table'>
        <tr><th>Reporting Period</th><th>Apr 2025</th><th>May 2025</th><th>Jun 2025</th><th>Jul 2025</th><th>Aug 2025</th><th>Sep 2025</th></tr>
        <tr class='legend-green'><td>Green</td><td>52%</td><td>58%</td><td>54%</td><td>60%</td><td>62%</td><td>58%</td></tr>
        <tr class='legend-amber'><td>Amber</td><td>22%</td><td>13%</td><td>28%</td><td>16%</td><td>12%</td><td>19%</td></tr>
        <tr class='legend-red'><td>Red</td><td>13%</td><td>13%</td><td>16%</td><td>12%</td><td>19%</td><td>11%</td></tr>
        <tr class='legend-grey'><td>Grey</td><td>13%</td><td>17%</td><td>12%</td><td>8%</td><td>8%</td><td>12%</td></tr>
    </table>
    """

    context = {
        "region_name": "Delhi Central",
        "chapter_name": "PATRONS",
        "current_month": "September 2025",
        "pivot_html": pivot_html,
        "avg_html": avg_html,
        "legend_html": legend_html,
    }

    return render(request, "report_summary.html", context)
