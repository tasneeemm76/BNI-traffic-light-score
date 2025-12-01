import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get("id");

    if (!uploadId) {
      return NextResponse.json({ error: "Upload ID is required" }, { status: 400 });
    }

    // Delete the upload and all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related MemberData
      await tx.memberData.deleteMany({
        where: {
          uploadId: uploadId,
        },
      });

      // Delete related TrainingData
      await tx.trainingData.deleteMany({
        where: {
          uploadId: uploadId,
        },
      });

      // Delete the upload
      await tx.reportUpload.delete({
        where: {
          id: uploadId,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Upload and all related records deleted successfully" });
  } catch (error) {
    console.error("Error deleting upload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete upload" },
      { status: 500 }
    );
  }
}

