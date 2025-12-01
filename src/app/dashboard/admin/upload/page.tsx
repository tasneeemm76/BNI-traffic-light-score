import { PageLayout } from "@/components/layouts/PageLayout";
import { AdminUploadForm } from "@/components/admin-upload-form";
import { UploadPeriodsList } from "@/components/upload-periods-list";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUploadPage() {
  // Fetch existing uploads - include PROCESSING status too in case transaction is still completing
  const existingUploads = await prisma.reportUpload.findMany({
    where: {
      source: "ADMIN",
      status: {
        in: ["PROCESSED", "PROCESSING"],
      },
    },
    orderBy: {
      createdAt: "desc", // Order by creation time to show most recent first
    },
    select: {
      id: true,
      label: true,
      chapter: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      status: true,
      _count: {
        select: {
          dataPoints: true,
        },
      },
    },
    take: 50, // Show last 50 uploads to see history
  });

  console.log(`Found ${existingUploads.length} existing uploads:`, existingUploads.map(u => ({
    id: u.id,
    label: u.label,
    period: `${u.periodStart.toISOString()} - ${u.periodEnd.toISOString()}`,
    status: u.status,
    members: u._count.dataPoints
  })));

  // Convert dates to ISO strings for client component
  const uploadsForClient = existingUploads.map((upload) => ({
    ...upload,
    periodStart: upload.periodStart.toISOString(),
    periodEnd: upload.periodEnd.toISOString(),
    createdAt: upload.createdAt.toISOString(),
  }));

  return (
    <PageLayout
      title="Upload Reports"
      subtitle="Upload reports for multiple months. Each month's data is stored separately. Re-uploading the same period will replace existing data for that period."
    >
      <AdminUploadForm />

      <UploadPeriodsList 
        key={existingUploads.length > 0 ? `${existingUploads[0].id}-${existingUploads.length}` : 'empty'} 
        uploads={uploadsForClient} 
      />
      
      <Card
        title="What happens after upload?"
      >
        <ol
          style={{
            listStyle: "decimal",
            paddingLeft: "var(--spacing-xl)",
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-md)",
          }}
        >
          <li style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-relaxed)" }}>
            File metadata saved to database, physical file stored securely.
          </li>
          <li style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-relaxed)" }}>
            Parser validates column headers, normalizes months, and stores raw JSON rows.
          </li>
          <li style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-relaxed)" }}>
            Member data and monthly stats are updated; calculated scores are refreshed.
          </li>
          <li style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-relaxed)" }}>
            Status updates to completed with row counts and timestamps for auditing.
          </li>
        </ol>
      </Card>
    </PageLayout>
  );
}
