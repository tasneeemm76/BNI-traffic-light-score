import pandas as pd
from django.shortcuts import render
from django import forms

# --- File upload form ---
class ExcelUploadForm(forms.Form):
    file = forms.FileField(label="Upload Excel File (.xlsx)")

# --- Main scoring logic ---
def calculate_score(row):
    try:
        P = row.get("P", 0)
        A = row.get("A", 0)
        L = row.get("L", 0)
        M = row.get("M", 0)
        S = row.get("S", 0)
        RGI = row.get("RGI", 0)
        RGO = row.get("RGO", 0)
        RRI = row.get("RRI", 0)
        RRO = row.get("RRO", 0)
        V = row.get("V", 0)
        one2one = row.get("1-2-1", 0)
        TYFCB = row.get("TYFCB", 0)
        CEU = row.get("CEU", 0)
        T = row.get("T", 1)  # Avoid division by zero

        score = 0

        # Derived metrics
        referrals_per_week = (RGI + RGO + RRI + RRO) / T
        absenteeism_rate = A / T
        visitors_per_week = V / T
        training_per_week = CEU / T
        on_time_rate = 1 - (L / T)

        # --- Referrals ---
        if referrals_per_week >= 20:
            score += 15
        elif referrals_per_week >= 15:
            score += 10
        elif referrals_per_week >= 10:
            score += 5

        # --- Absenteeism ---
        if absenteeism_rate < 0.1:
            score += 15
        elif absenteeism_rate < 0.25:
            score += 10
        elif absenteeism_rate < 0.5:
            score += 5

        # --- Visitors ---
        if visitors_per_week >= 3:
            score += 20
        elif visitors_per_week >= 2:
            score += 10
        elif visitors_per_week >= 1:
            score += 5

        # --- Training ---
        if training_per_week >= 0.075:
            score += 15
        elif training_per_week > 0:
            score += 10

        # --- TYFCB ---
        if TYFCB >= 1:
            score += 15

        # --- Arriving on Time ---
        if on_time_rate >= 0.7:
            score += 10
        elif on_time_rate >= 0.5:
            score += 5
        elif on_time_rate >= 0.3:
            score += 2

        # --- Final color logic ---
        if score >= 70:
            color = "GREEN"
        elif score >= 40:
            color = "AMBER"
        else:
            color = "RED"

        return round(score, 2), color

    except Exception as e:
        print("Error:", e)
        return 0, "N/A"

from django.shortcuts import render
import pandas as pd

def upload_excel(request):
    results = []

    if request.method == 'POST' and request.FILES.get('file'):
        excel_file = request.FILES['file']

        try:
            df = pd.read_excel(excel_file)

            # Normalize column names
            df.columns = [str(c).strip().replace(" ", "_").replace("-", "_") for c in df.columns]

            # Fill NaN with 0
            df = df.fillna(0)

            for _, row in df.iterrows():
                # Extract columns safely
                p = row.get('P', 0)
                a = row.get('A', 0)
                rgi = row.get('RGI', 0)
                rgo = row.get('RGO', 0)
                v = row.get('V', 0)
                tyfcb = row.get('TYFCB', 0)
                one_to_one = row.get('1_2_1', 0)
                ceu = row.get('CEU', 0)

                # 1️⃣ Referrals score
                total_referrals = rgi + rgo
                if total_referrals >= 20:
                    referrals_score = 20
                elif total_referrals >= 15:
                    referrals_score = 15
                elif total_referrals >= 10:
                    referrals_score = 10
                elif total_referrals >= 5:
                    referrals_score = 5
                else:
                    referrals_score = 0

                # 2️⃣ Absenteeism (based on attendance rate)
                total_meetings = p + a if (p + a) > 0 else 1
                absenteeism_ratio = a / total_meetings
                if absenteeism_ratio < 0.1:
                    absenteeism_score = 20
                elif absenteeism_ratio < 0.25:
                    absenteeism_score = 15
                elif absenteeism_ratio < 0.5:
                    absenteeism_score = 10
                elif absenteeism_ratio < 0.75:
                    absenteeism_score = 5
                else:
                    absenteeism_score = 0

                # 3️⃣ Visitors
                if v >= 3:
                    visitor_score = 15
                elif v == 2:
                    visitor_score = 10
                elif v == 1:
                    visitor_score = 5
                else:
                    visitor_score = 0

                # 4️⃣ 1-2-1
                if one_to_one >= 0.075:
                    one_to_one_score = 15
                elif one_to_one > 0:
                    one_to_one_score = 5
                else:
                    one_to_one_score = 0

                # 5️⃣ TYFCB (Testimonials / Thank You for Closed Business)
                if tyfcb >= 2000000:
                    tyfcb_score = 20
                elif tyfcb >= 1000000:
                    tyfcb_score = 10
                elif tyfcb >= 500000:
                    tyfcb_score = 5
                else:
                    tyfcb_score = 0

                # 6️⃣ Arriving on time (using CEU proxy)
                if ceu >= 70:
                    ontime_score = 15
                elif ceu >= 50:
                    ontime_score = 10
                elif ceu >= 30:
                    ontime_score = 5
                else:
                    ontime_score = 0

                total_score = referrals_score + absenteeism_score + visitor_score + one_to_one_score + tyfcb_score + ontime_score

                # 🚦 Color logic
                if total_score >= 70:
                    color = "GREEN"
                elif total_score >= 40:
                    color = "AMBER"
                else:
                    color = "RED"

                results.append({
                    "First_Name": row.get("First_Name", ""),
                    "Last_Name": row.get("Last_Name", ""),
                    "Total_Score": total_score,
                    "Color": color
                })

        except Exception as e:
            print("Error reading Excel:", e)

    return render(request, 'upload_excel.html', {"results": results})


# reports/views.py
from django.shortcuts import render
import pandas as pd
import math

# helper: map score -> color
def score_to_color(score):
    if score is None or (isinstance(score, float) and math.isnan(score)):
        return "GREY"
    try:
        s = float(score)
    except Exception:
        return "GREY"
    if s >= 70:
        return "GREEN"
    elif s >= 40:
        return "AMBER"
    else:
        return "RED"

def upload_dashboard(request):
    context = {
        "months": [],
        "members": [],         # list of dicts -> name, per_month list, avg, current_score, current_color
        "avg_per_month": [],   # list of floats
        "top_avg_members": [], # top ranked by average
        "current_ranked": [],  # ranked by current month
        "distribution": {},    # dict month -> {'GREEN':%, 'AMBER':%, 'RED':%, 'GREY':%}
        "region": "Region: Delhi Central",
        "chapter": "PATRONS",
        "report_month": ""
    }

    if request.method == "POST" and request.FILES.get("file"):
        file = request.FILES["file"]
        try:
            df = pd.read_excel(file)
        except Exception as e:
            context["error"] = f"Error reading Excel: {e}"
            return render(request, "reports/dashboard.html", context)

        # normalize columns
        df.columns = [str(c).strip() for c in df.columns]

        # identify name columns (trying common names)
        name_cols = []
        for opt in ["First Name", "First_Name", "Firstname", "First"]:
            if opt in df.columns:
                name_cols.append(opt)
                break
        for opt in ["Last Name", "Last_Name", "Lastname", "Last"]:
            if opt in df.columns:
                name_cols.append(opt)
                break

        # If no explicit columns, try first two columns as names
        if len(name_cols) < 2:
            # fallback: use first and second column names
            cols_list = list(df.columns)
            if len(cols_list) >= 2:
                name_cols = [cols_list[0], cols_list[1]]
            else:
                context["error"] = "Unable to find name columns in Excel."
                return render(request, "reports/dashboard.html", context)

        first_col, last_col = name_cols[0], name_cols[1]

        # month columns = all columns except first and last name columns
        month_cols = [c for c in df.columns if c not in {first_col, last_col}]
        # keep order as in sheet
        context["months"] = month_cols

        # coerce month columns to numeric (scores) and fill NaN
        for c in month_cols:
            df[c] = pd.to_numeric(df[c], errors="coerce")

        # compute per-member info
        members = []
        for _, r in df.iterrows():
            first = r.get(first_col, "")
            last = r.get(last_col, "")
            name = f"{str(first).strip()} {str(last).strip()}".strip()
            per_month = []
            scores_for_avg = []
            for m in month_cols:
                score_val = r.get(m, None)
                color = score_to_color(score_val)
                per_month.append({"month": m, "score": None if pd.isna(score_val) else score_val, "color": color})
                if not pd.isna(score_val):
                    scores_for_avg.append(score_val)

            avg = round(float(pd.Series(scores_for_avg).mean()) , 2) if len(scores_for_avg) > 0 else None
            current_score = None
            current_color = "GREY"
            if month_cols:
                last_month = month_cols[-1]
                s = r.get(last_month, None)
                current_score = None if pd.isna(s) else s
                current_color = score_to_color(s)

            members.append({
                "name": name or "Unknown",
                "first": first,
                "last": last,
                "per_month": per_month,
                "average": avg,
                "current_score": current_score,
                "current_color": current_color
            })

        # average per month across members (ignore NaN)
        avg_per_month = []
        distribution = {}
        for m in month_cols:
            col_series = df[m]
            mean_val = None
            try:
                mean_val = round(float(col_series.dropna().mean()), 2) if col_series.dropna().shape[0] > 0 else None
            except Exception:
                mean_val = None
            avg_per_month.append(mean_val)

            # distribution percentages
            total_members = len(df)
            counts = {"GREEN":0, "AMBER":0, "RED":0, "GREY":0}
            for val in col_series:
                c = score_to_color(val)
                counts[c] += 1
            # compute percentages
            distribution[m] = {k: round( (counts[k]/total_members * 100) , 1) for k in counts}

        # top average members (sort by average descending)
        sorted_by_avg = sorted(members, key=lambda x: (x["average"] if x["average"] is not None else -1), reverse=True)
        top_avg_members = sorted_by_avg[:12]  # pick top 12 to show (adjust as needed)

        # current month ranking
        if month_cols:
            current_month = month_cols[-1]
            context["report_month"] = current_month
            # rank by that month's value
            def cur_score_key(m):
                try:
                    s = df.loc[df[first_col].astype(str).str.strip() + " " + df[last_col].astype(str).str.strip() == m["name"], current_month]
                except Exception:
                    s = None
                # use the member dict instead:
                return (m["current_score"] if m["current_score"] is not None else -1)
            sorted_current = sorted(members, key=cur_score_key, reverse=True)
            current_ranked = sorted_current[:12]
        else:
            current_ranked = []

        # prepare context
        context.update({
            "members": members,
            "avg_per_month": avg_per_month,
            "top_avg_members": top_avg_members,
            "current_ranked": current_ranked,
            "distribution": distribution,
        })

    return render(request, "dashboard.html", context)
