import pandas as pd
from django.shortcuts import render
from django import forms


# --- File Upload Form ---
class ExcelUploadForm(forms.Form):
    file = forms.FileField(label="Upload Excel File (.xlsx)")


# --- Scoring Logic ---
def calculate_score(row):
    try:
        # Extract safely with defaults
        P = row.get("P", 0)
        A = row.get("A", 0)
        L = row.get("L", 0)
        S = row.get("S", 0)
        M = row.get("M", 0)
        RGI = row.get("RGI", 0)
        RGO = row.get("RGO", 0)
        RRI = row.get("RRI", 0)
        RRO = row.get("RRO", 0)
        VIS = row.get("Visitors", 0)
        TRAIN = row.get("Training", 0)
        TYFCB = row.get("TYFCB", 0)
        T = row.get("T", 0)  # Testimonials
        ONTIME = row.get("On_Time", 0)

        # --- Derived Metrics ---
        total_meetings = P + A + L + S + M
        if total_meetings == 0:
            total_meetings = 1  # avoid division by zero

        absenteeism = (A + L) / total_meetings
        referrals_per_week = (RGI + RGO + RRI + RRO) / total_meetings
        visitors_per_week = VIS / total_meetings
        testimonials_per_week = T / total_meetings

        # --- Scoring Rules ---

        # Absenteeism
        if absenteeism > 2:
            absenteeism_score = 0
        elif absenteeism == 2:
            absenteeism_score = 5
        elif absenteeism == 1:
            absenteeism_score = 10
        else:  # < 1
            absenteeism_score = 15

        # Referrals per week
        if referrals_per_week < 0.5:
            referrals_score = 0
        elif referrals_per_week < 0.75:
            referrals_score = 5
        elif referrals_per_week < 1:
            referrals_score = 10
        elif referrals_per_week < 1.2:
            referrals_score = 15
        else:
            referrals_score = 20

        # Visitors per week
        if visitors_per_week < 0.1:
            visitors_score = 0
        elif visitors_per_week < 0.25:
            visitors_score = 5
        elif visitors_per_week < 0.5:
            visitors_score = 10
        elif visitors_per_week < 0.75:
            visitors_score = 15
        else:
            visitors_score = 20

        # Training
        if TRAIN == 0:
            training_score = 0
        elif TRAIN == 1:
            training_score = 5
        elif TRAIN == 2:
            training_score = 10
        else:  # >=3
            training_score = 15

        # TYFCB
        if TYFCB < 500000:
            tyfcb_score = 0
        elif TYFCB < 1000000:
            tyfcb_score = 5
        elif TYFCB < 2000000:
            tyfcb_score = 10
        else:
            tyfcb_score = 15

        # On-time arrival
        if ONTIME >= 1:
            ontime_score = 0
        else:  # 0 = on time
            ontime_score = 5

        # Testimonials / Week
        if testimonials_per_week <= 0:
            testimonial_score = 0
        elif testimonials_per_week < 0.075:
            testimonial_score = 5
        else:
            testimonial_score = 10

        # --- Total Score ---
        total_score = (
            absenteeism_score
            + referrals_score
            + visitors_score
            + training_score
            + tyfcb_score
            + ontime_score
            + testimonial_score
        )

        # --- Final Color Logic (Updated) ---
        if total_score >= 70:
            color = "GREEN"
        elif total_score >= 50:
            color = "AMBER"
        elif total_score >= 30:
            color = "RED"
        else:
            color = "GREY"

        return round(total_score, 2), color

    except Exception as e:
        print("Error:", e)
        return 0, "GREY"


# --- Django View ---
def upload_excel(request):
    results = []

    if request.method == 'POST' and request.FILES.get('file'):
        excel_file = request.FILES['file']
        try:
            df = pd.read_excel(excel_file, engine='openpyxl')
            df.columns = [str(c).strip().replace(" ", "_").replace("-", "_") for c in df.columns]
            df = df.fillna(0)

            for _, row in df.iterrows():
                total_score, color = calculate_score(row)
                results.append({
                    "First_Name": row.get("First_Name", ""),
                    "Last_Name": row.get("Last_Name", ""),
                    "Total_Score": total_score,
                    "Color": color
                })

        except Exception as e:
            print("Error reading Excel:", e)

    return render(request, 'upload_excel.html', {"results": results})

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
