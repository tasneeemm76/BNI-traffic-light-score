import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMonthDetail } from "@/lib/reporting";

type Params = {
  params: {
    month: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  const month = params.month;
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
  }
  const rows = await getMonthDetail(prisma, date);
  return NextResponse.json({ rows });
}



