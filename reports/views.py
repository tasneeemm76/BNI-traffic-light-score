import pandas as pd
from django.shortcuts import render
from datetime import datetime
from .forms import ExcelUploadForm

def upload_excel(request):
    results = []
    from_date = None
    to_date = None

    if request.method == 'POST' and request.FILES.get('file'):
        uploaded_file = request.FILES['file']

        try:
            # Determine file type and read accordingly
            file_name = uploaded_file.name.lower()
            
            # Read without headers to find where data starts
            if file_name.endswith('.csv'):
                # Read CSV file without headers
                df_raw = pd.read_csv(uploaded_file, header=None)
            elif file_name.endswith('.xls'):
                # Read old Excel format (.xls) without headers
                df_raw = pd.read_excel(uploaded_file, engine='xlrd', header=None)
            elif file_name.endswith('.xlsx'):
                # Read new Excel format (.xlsx) without headers
                df_raw = pd.read_excel(uploaded_file, engine='openpyxl', header=None)
            else:
                raise ValueError("Unsupported file format. Please upload .xlsx, .xls, or .csv file")
            
            # Find the row index where first cell equals "First Name"
            header_row_idx = None
            for idx, row in df_raw.iterrows():
                first_cell = str(row.iloc[0]).strip() if len(row) > 0 else ""
                if first_cell.lower() == "first name":
                    header_row_idx = idx
                    break
            
            if header_row_idx is None:
                raise ValueError("Could not find 'First Name' header in the file")
            
            # Extract metadata (From/To dates) from rows before header
            metadata_rows = df_raw.iloc[:header_row_idx]
            from_date_extracted = None
            to_date_extracted = None
            
            # Look for "From" and "To" in metadata rows
            for idx, row in metadata_rows.iterrows():
                row_str = ' '.join([str(cell) for cell in row if pd.notna(cell)])
                if 'from' in row_str.lower():
                    # Try to extract date after "From:"
                    parts = row_str.split(':')
                    if len(parts) > 1:
                        from_date_extracted = parts[1].strip()
                if 'to' in row_str.lower():
                    # Try to extract date after "To:"
                    parts = row_str.split(':')
                    if len(parts) > 1:
                        to_date_extracted = parts[1].strip()
            
            # Use the found header row
            df_raw.columns = df_raw.iloc[header_row_idx]
            
            # Skip metadata rows and keep only data rows
            df = df_raw.iloc[header_row_idx + 1:].copy()
            
            # Reset index
            df = df.reset_index(drop=True)
            
            # Normalize column names
            df.columns = [str(c).strip().replace(" ", "_").replace("-", "_") for c in df.columns]
            df = df.fillna(0)
            
            # Use extracted dates
            if from_date_extracted and to_date_extracted:
                from_date = from_date_extracted
                to_date = to_date_extracted
            
            # Calculate number of weeks between dates
            weeks = 1  # Default to 1 week
            if from_date and to_date:
                try:
                    # Try common date formats
                    for date_format in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"]:
                        try:
                            start = datetime.strptime(str(from_date).strip(), date_format)
                            end = datetime.strptime(str(to_date).strip(), date_format)
                            weeks = max(((end - start).days / 7), 1)
                            break
                        except ValueError:
                            continue
                except Exception as e:
                    print(f"Error parsing dates: {e}")
                    weeks = 1

            for _, row in df.iterrows():
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
                T = row.get("T", 0)
                TYFCB = row.get("TYFCB", 0)
                CEU = row.get("CEU", 0)
                testimonials = row.get("Testimonials", 0)

                # Attendance Ratio
                total_meetings = P + A + L + S + M
                attendance = (P + S + M) / total_meetings if total_meetings > 0 else 0

                # Derived weekly metrics
                total_referrals = RGI + RGO + RRI + RRO
                referrals_per_week = total_referrals / weeks
                visitors_per_week = V / weeks
                testimonials_per_week = testimonials / weeks

                # --- Absenteeism ---
                if A > 2:
                    abs_score, abs_color = 0, "GREY"
                elif A == 2:
                    abs_score, abs_color = 5, "RED"
                elif A == 1:
                    abs_score, abs_color = 10, "RED"
                else:
                    abs_score, abs_color = 15, "GREEN"

                # --- Referrals ---
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

                # --- Visitors ---
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

                # --- Training (CEU) ---
                if CEU == 0:
                    train_score = 0
                elif CEU == 1:
                    train_score = 5
                elif CEU == 2:
                    train_score = 10
                else:
                    train_score = 15

                # --- TYFCB ---
                if TYFCB < 500000:
                    tyfcb_score = 0
                elif TYFCB < 1000000:
                    tyfcb_score = 5
                elif TYFCB < 2000000:
                    tyfcb_score = 10
                else:
                    tyfcb_score = 15

                # --- On-time ---
                if L >= 1:
                    time_score = 0
                else:
                    time_score = 5

                # --- Testimonials / Week ---
                if testimonials_per_week <= 0:
                    testi_score = 0
                elif testimonials_per_week < 0.075:
                    testi_score = 5
                else:
                    testi_score = 10

                total_score = abs_score + ref_score + vis_score + train_score + tyfcb_score + time_score + testi_score

                # --- Final Color ---
                if total_score >= 70:
                    color = "GREEN"
                elif total_score >= 50:
                    color = "AMBER"
                elif total_score >= 30:
                    color = "RED"
                else:
                    color = "GREY"

                results.append({
                    "First_Name": row.get("First_Name", ""),
                    "Last_Name": row.get("Last_Name", ""),
                    "Total_Score": total_score,
                    "Color": color
                })

        except Exception as e:
            error_message = f"Error processing file: {str(e)}"
            print(error_message)
            return render(request, 'upload_excel.html', {
                "form": ExcelUploadForm(),
                "results": [],
                "error": error_message,
                "from_date": None,
                "to_date": None
            })

    form = ExcelUploadForm()
    return render(request, 'upload_excel.html', {
        "form": form, 
        "results": results,
        "from_date": from_date,
        "to_date": to_date
    })
