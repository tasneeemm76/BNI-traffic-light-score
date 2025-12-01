import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberAnalysis } from "@/lib/reporting";

type Params = {
  params: { memberId: string };
};

export async function GET(request: Request, { params }: Params) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  if (limit !== undefined && Number.isNaN(limit)) {
    return NextResponse.json({ error: "limit must be numeric" }, { status: 400 });
  }
  try {
    const rows = await getMemberAnalysis(prisma, { memberId: params.memberId, limit });
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch member trend" },
      { status: 400 }
    );
  }
}



