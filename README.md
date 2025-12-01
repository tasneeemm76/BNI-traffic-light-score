## BNI Scoring Platform

Upload official BNI performance exports (attendance/referrals + optional training credits), calculate the chapter’s scorecard with the exact BNI business rules, and expose REST endpoints for analytics views (ranked lists, heatmaps, drill-downs, and member trends).

### Tech Stack

- **Next.js App Router** (React Server Components + API Routes)
- **TypeScript + Tailwind CSS** for the landing/dashboard experience
- **PostgreSQL + Prisma** schema for `Member`, `ReportUpload`, `MemberData`, and `TrainingData`
- **PapaParse + SheetJS** for CSV/XLSX ingestion (metadata rows supported on CEU sheet)
- **Local/S3/Supabase** storage pluggable through `FILE_STORAGE_ROOT`
- **React Query + Recharts ready** (hooks/components available for future charts)

### Getting Started

1. Install dependencies
   ```bash
   npm install
   ```
2. Copy environment file and fill in secrets
   ```bash
   cp env.example .env
   ```
3. Provision PostgreSQL & run Prisma
   ```bash
   npx prisma migrate deploy   # or prisma db push
   npx prisma db seed          # optional seed script (todo)
   ```
4. Start dev server
   ```bash
   npm run dev
   ```

### Key Workflows

- **Dual-file ingestion** – `/dashboard/admin/upload` collects main performance + optional training report and posts to `/api/upload_file`.
- **User preview** – the landing page uploader posts to `/api/upload_file` with `source=USER_PREVIEW`, marking runs as previews but still queryable.
- **Dashboard** – `/dashboard` shows the most recent upload with ranked members.
- **REST views** – APIs for `view_scoring`, `score_summary`, `list_score_results`, `month_detail_view`, and `member_analysis_view` back any frontend/reporting tools.
- **Color bands** – `_color_by_absolute` rules (>=70% green, >=50% yellow, >=30% red, else gray) applied to every metric and stored with each member row.
- **Ignored rows** – members containing “total”, “bni”, or “visitors” (case-insensitive) never enter scoring.

### API Surface

| Endpoint | Method | Description |
| --- | --- | --- |
| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/upload_file` | `POST` | Core ingestion endpoint. Accepts `mainReport` + optional `trainingReport`, parses, scores, stores, and returns the score list. |
| `/api/view_scoring` | `GET/DELETE` | Filter member scores by date range or delete an entire range of uploads. |
| `/api/score_summary` | `GET` | Produces the Member × Month heatmap payload with color bands. |
| `/api/list_score_results` | `GET` | Ranked list combining ADMIN runs and USER_PREVIEW runs. |
| `/api/month_detail_view/[yyyy-mm]` | `GET` | Drill-down for a specific month (all metrics per member). |
| `/api/member_analysis_view/[memberId]` | `GET` | Trend analysis for a member (chronological scores + upload metadata). |

All endpoints include structured error responses with validation messages.

### Scoring Rules

For each member:

1. Ignore rows whose names contain `total`, `bni`, or `visitors`.
2. `total_meetings = P + A + S + M` (fallback 1 week).
3. Convert metrics to per-week values (`referrals`, `visitors`, `testimonials`).
4. Map metrics to BNI scores:  
   - Referrals per week → 0/5/10/15/20  
   - Visitors per week → 0/5/10/15/20  
   - Testimonials per week → 0/2.5/5/7.5/10  
   - Training count → 0/5/10/15 (using CEU sheet, first/last name match)  
   - TYFCB total → 0/5/10/15  
   - Absenteeism rate → 0/5/10/15 (fewer absences ⇒ higher score)  
   - Arrival on time → 5 or 0 (<=5% late keeps the points)
5. Sum to `total_score` (~100 max) and assign color bands using `_color_by_absolute`.

Every result stores the raw per-week numbers, score components, and the derived color for future analytics.

### Database Schema Highlights

- `Member` – canonical profile with normalized names for matching CEU rows.
- `ReportUpload` – each ingestion (ADMIN or USER_PREVIEW) with file paths, weeks covered, and status.
- `MemberData` – normalized metric row per member per upload (stores scores, colors, raw metrics).
- `TrainingData` – raw CEU rows (matched or unmatched) for auditing.

### Extending

- Swap `persistUpload` with Supabase/S3 adapters for production storage.
- Move scoring to background workers/queues for 50k+ rows.
- Extend the React dashboard to call the new REST endpoints (heatmaps, trends, etc.).

### Scripts

- `npm run dev` – Next.js dev server
- `npm run build` – Production build
- `npm run lint` – Next linting
- `npx prisma studio` – Inspect database

Enjoy building! 🎯
