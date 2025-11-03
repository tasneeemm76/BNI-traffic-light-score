import io
import math
import re
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional

import pandas as pd


EXPECTED_COLUMNS = [
	'First Name', 'Last Name', 'P', 'A', 'L', 'M', 'S', 'RGI', 'RGO', 'RRI', 'RRO', 'V', '1-2-1', 'TYFCB', 'CEU', 'T'
]


def parse_reporting_period_and_header(df_raw: pd.DataFrame) -> Tuple[Optional[datetime], Optional[datetime], int]:
	from_date: Optional[datetime] = None
	to_date: Optional[datetime] = None
	header_row_index: int = -1

	def parse_date_flex(value: Any) -> Optional[datetime]:
		if value is None or (isinstance(value, float) and math.isnan(value)):
			return None
		# Already datetime-like
		if isinstance(value, pd.Timestamp):
			return value.to_pydatetime()
		if isinstance(value, datetime):
			return value
		text = str(value).strip()
		# Accept patterns like 01-04-25 or 01/04/2025 etc.
		for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%m-%d-%Y", "%m/%d/%Y", "%d-%m-%y", "%d/%m/%y", "%m-%d-%y", "%m/%d/%y"):
			try:
				return datetime.strptime(text, fmt)
			except ValueError:
				continue
		return None

	max_scan = min(50, len(df_raw))
	for i in range(max_scan):
		row = df_raw.iloc[i].tolist()
		# Find From:/To: across cells: if a cell is 'From:' then next non-empty cell is the date
		for j, cell in enumerate(row):
			if pd.isna(cell):
				continue
			label = str(cell).strip().lower()
			if label in ('from:', 'from'):
				# find next meaningful cell
				for k in range(j + 1, len(row)):
					if pd.isna(row[k]):
						continue
					maybe_date = parse_date_flex(row[k])
					if maybe_date:
						from_date = maybe_date
					break
			elif label in ('to:', 'to'):
				for k in range(j + 1, len(row)):
					if pd.isna(row[k]):
						continue
					maybe_date = parse_date_flex(row[k])
					if maybe_date:
						to_date = maybe_date
					break

		first_cell = str(df_raw.iloc[i, 0]).strip() if df_raw.shape[1] > 0 else ''
		if first_cell.lower() == 'first name':
			header_row_index = i
			break

	return from_date, to_date, header_row_index



def parse_training_period_and_header(df_raw: pd.DataFrame) -> Tuple[Optional[datetime], Optional[datetime], int]:
    """
    Detects From:/To: dates and header row in a BNI Training Report.
    Ignores metadata above header rows.
    Returns (from_date, to_date, header_row_index)
    """
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    header_row_index: int = -1

    def parse_date_flex(value: Any) -> Optional[datetime]:
        """Parse flexible date formats like 01-04-25, 01/04/2025, etc."""
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime()
        if isinstance(value, datetime):
            return value
        text = str(value).strip()
        for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%m-%d-%Y", "%m/%d/%Y", "%d-%m-%y", "%d/%m/%y", "%m-%d-%y", "%m/%d/%y"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
        return None

    # Scan first 60 rows (covers all metadata)
    max_scan = min(60, len(df_raw))
    for i in range(max_scan):
        row = df_raw.iloc[i].tolist()

        # Detect From:/To: dates inside early metadata rows
        for j, cell in enumerate(row):
            if pd.isna(cell):
                continue
            label = str(cell).strip().lower()
            if label in ('from:', 'from'):
                for k in range(j + 1, len(row)):
                    if pd.isna(row[k]):
                        continue
                    maybe_date = parse_date_flex(row[k])
                    if maybe_date:
                        from_date = maybe_date
                    break
            elif label in ('to:', 'to'):
                for k in range(j + 1, len(row)):
                    if pd.isna(row[k]):
                        continue
                    maybe_date = parse_date_flex(row[k])
                    if maybe_date:
                        to_date = maybe_date
                    break

        # Detect the actual data header row (Training Report always has these columns)
        cells_lower = [str(c).strip().lower() for c in row]
        if 'first name' in cells_lower and 'last name' in cells_lower:
            header_row_index = i
            break

    return from_date, to_date, header_row_index

def compute_total_weeks(from_date: Optional[datetime], to_date: Optional[datetime]) -> float:
	if not from_date or not to_date:
		return 1.0
	delta_days = (to_date - from_date).days
	weeks = delta_days / 7.0
	return max(1.0, weeks)


def compute_total_months(from_date: Optional[datetime], to_date: Optional[datetime]) -> float:
	if not from_date or not to_date:
		return 1.0
	delta_days = (to_date - from_date).days
	months = delta_days / 30.44  # average days per month
	return max(1.0, months)


def load_and_clean(file_bytes: bytes, filename: str) -> Tuple[pd.DataFrame, float, float, Optional[datetime], Optional[datetime]]:
	buffer = io.BytesIO(file_bytes)
	if filename.lower().endswith('.xlsx'):
		try:
			df_raw = pd.read_excel(buffer, header=None, dtype=object, engine='openpyxl')
		except Exception:
			buffer.seek(0)
			df_raw = pd.read_excel(buffer, header=None, dtype=object)
	elif filename.lower().endswith('.csv'):
		df_raw = pd.read_csv(buffer, header=None, dtype=object)
	else:
		raise ValueError('Unsupported file type')

	from_date, to_date, header_idx = parse_reporting_period_and_header(df_raw)
	weeks = compute_total_weeks(from_date, to_date)
	months = compute_total_months(from_date, to_date)

	if header_idx == -1:
		raise ValueError('Could not locate header row starting with "First Name"')

	df = df_raw.iloc[header_idx:].copy()
	df.columns = df.iloc[0]
	df = df[1:]

	# Keep only expected columns if present
	available_cols = [c for c in EXPECTED_COLUMNS if c in df.columns]
	df = df[available_cols]

	# Ensure all expected columns exist, fill missing with 0
	for c in EXPECTED_COLUMNS:
		if c not in df.columns:
			df[c] = 0

	# Coerce numeric columns
	numeric_cols = [c for c in EXPECTED_COLUMNS if c not in ('First Name', 'Last Name')]
	for c in numeric_cols:
		df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0)

	# Fill missing names with empty strings
	df['First Name'] = df['First Name'].fillna('').astype(str)
	df['Last Name'] = df['Last Name'].fillna('').astype(str)

	return df.reset_index(drop=True), weeks, months, from_date, to_date


def parse_training_counts(file_bytes: bytes, filename: str) -> Dict[str, int]:
	"""Parse the training report and count occurrences by member full name.

	Expected columns include 'First Name' and 'Last Name'.
	"""
	buffer = io.BytesIO(file_bytes)
	if filename.lower().endswith('.xlsx'):
		try:
			df = pd.read_excel(buffer, dtype=object, engine='openpyxl')
		except Exception:
			buffer.seek(0)
			df = pd.read_excel(buffer, dtype=object)
	elif filename.lower().endswith('.csv'):
		df = pd.read_csv(buffer, dtype=object)
	else:
		raise ValueError('Unsupported training file type')

	# Normalize columns
	cols_lc = {str(c).strip().lower(): c for c in df.columns}
	first_col = cols_lc.get('first name') or cols_lc.get('firstname') or cols_lc.get('first')
	last_col = cols_lc.get('last name') or cols_lc.get('lastname') or cols_lc.get('last')
	if not first_col or not last_col:
		raise ValueError('Training report must have First Name and Last Name columns')

	counts: Dict[str, int] = {}
	for _, r in df.iterrows():
		fn = str(r.get(first_col, '') or '').strip()
		ln = str(r.get(last_col, '') or '').strip()
		name_key = f"{fn} {ln}".strip().lower()
		if not name_key:
			continue
		counts[name_key] = counts.get(name_key, 0) + 1
	return counts


def _color_by_absolute(score: int, max_score: int) -> str:
	# Map per-metric score to a color using percentage bands similar to total
	if max_score <= 0:
		return '#d3d3d3'
	percent = (score / max_score) * 100.0
	if percent >= 70:
		return '#6cc070'
	elif percent >= 50:
		return '#f5c542'
	elif percent >= 30:
		return '#e84c3d'
	else:
		return '#d3d3d3'


def score_member(row: pd.Series, total_weeks: float, total_months: float, training_counts: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
	RGI = row.get('RGI', 0)
	RGO = row.get('RGO', 0)
	RRI = row.get('RRI', 0)
	RRO = row.get('RRO', 0)
	V = row.get('V', 0)
	T = row.get('T', 0)
	A = row.get('A', 0)
	L_col = row.get('L', 0)
	CEU = row.get('CEU', 0)
	TYFCB = row.get('TYFCB', 0)

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

	# Training (CEU from training report occurrences if provided)
	name_key = f"{row.get('First Name', '').strip()} {row.get('Last Name', '').strip()}".strip().lower()
	ceu_count = int(training_counts.get(name_key, 0)) if training_counts else int(CEU or 0)
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

	name = f"{row.get('First Name', '').strip()} {row.get('Last Name', '').strip()}".strip()

	return {
		'name': name if name else 'Unknown',
		'total_score': int(total_score),
		'color': color,
		# per-metric scores and colors
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
		'arrival_score': int(arriving_on_time_score),
		'arrival_color': _color_by_absolute(int(arriving_on_time_score), arriving_on_time_max),
	}


def score_dataframe(df: pd.DataFrame, total_weeks: float, total_months: float, training_counts: Optional[Dict[str, int]] = None) -> List[Dict[str, Any]]:
	results: List[Dict[str, Any]] = []
	for _, row in df.iterrows():
		results.append(score_member(row, total_weeks, total_months, training_counts))
	# Sort by score desc then name
	results.sort(key=lambda x: (-x['total_score'], x['name']))
	return results


