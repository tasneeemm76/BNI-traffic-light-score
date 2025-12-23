import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Color mapping function matching the scoring system
function getScoreColor(totalScore: number): string {
  if (totalScore >= 70) return "#008000"; // Green
  if (totalScore >= 50) return "#FFBF00"; // Amber
  if (totalScore >= 30) return "#ff0000"; // Red
  return "#808080"; // Grey
}

function getScoreLabel(totalScore: number): string {
  if (totalScore >= 70) return "Green";
  if (totalScore >= 50) return "Amber";
  if (totalScore >= 30) return "Red";
  return "Grey";
}

// Convert hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [128, 128, 128]; // Default to grey
}

type MemberDataPoint = {
  id: string;
  member: {
    displayName: string;
    chapter?: string | null;
  };
  totalScore: number;
  colorBand: string;
};

type ReportUpload = {
  label?: string | null;
  chapter?: string | null;
  periodStart: Date | string;
  periodEnd: Date | string;
  dataPoints: MemberDataPoint[];
};

export function generatePDFReport(upload: ReportUpload): void {
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  // Convert date strings to Date objects if needed
  const periodStart = typeof upload.periodStart === "string" ? new Date(upload.periodStart) : upload.periodStart;
  const periodEnd = typeof upload.periodEnd === "string" ? new Date(upload.periodEnd) : upload.periodEnd;

  // Calculate overall statistics for header/footer
  const totalMembers = upload.dataPoints.length;
  const greenCount = upload.dataPoints.filter((dp) => dp.totalScore >= 70).length;
  const amberCount = upload.dataPoints.filter((dp) => dp.totalScore >= 50 && dp.totalScore < 70).length;
  const redCount = upload.dataPoints.filter((dp) => dp.totalScore >= 30 && dp.totalScore < 50).length;
  const greyCount = upload.dataPoints.filter((dp) => dp.totalScore < 30).length;

  // Calculate average score for header color
  const avgScore = upload.dataPoints.reduce((sum, dp) => sum + dp.totalScore, 0) / totalMembers;
  const headerColor = getScoreColor(avgScore);
  const headerRgb = hexToRgb(headerColor);

  // Header function
  const addHeader = (pageNum: number, totalPages: number) => {
    // Header background with color
    doc.setFillColor(headerRgb[0], headerRgb[1], headerRgb[2]);
    doc.rect(0, 0, pageWidth, 30, "F");

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("BNI Scoring Report", margin, 20);

    // Period label
    const periodLabel = upload.label ?? 
      `${periodStart.toLocaleDateString()} – ${periodEnd.toLocaleDateString()}`;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(periodLabel, pageWidth - margin - doc.getTextWidth(periodLabel), 20);

    // Chapter info
    if (upload.chapter) {
      doc.setFontSize(10);
      doc.text(`Chapter: ${upload.chapter}`, margin, 28);
    }

    // Score summary in header
    doc.setFontSize(9);
    const summaryText = `Avg Score: ${Math.round(avgScore)} | Green: ${greenCount} | Amber: ${amberCount} | Red: ${redCount} | Grey: ${greyCount}`;
    doc.text(summaryText, pageWidth - margin - doc.getTextWidth(summaryText), 28);
  };

  // Footer function
  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 15;

    // Footer background with color (lighter shade)
    const footerRgb = hexToRgb(headerColor);
    doc.setFillColor(footerRgb[0] * 0.8, footerRgb[1] * 0.8, footerRgb[2] * 0.8);
    doc.rect(0, footerY - 5, pageWidth, 15, "F");

    // Footer text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    const footerLeft = `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    doc.text(footerLeft, margin, footerY + 3);

    const footerCenter = `Overall Status: ${getScoreLabel(avgScore)} (${Math.round(avgScore)}%)`;
    doc.text(footerCenter, pageWidth / 2 - doc.getTextWidth(footerCenter) / 2, footerY + 3);

    const footerRight = `Page ${pageNum} of ${totalPages}`;
    doc.text(footerRight, pageWidth - margin - doc.getTextWidth(footerRight), footerY + 3);

    // Color legend
    doc.setFontSize(7);
    const legendY = footerY + 8;
    doc.text("Legend: ", margin, legendY);
    
    const colors = [
      { color: "#008000", label: "Green (≥70%)" },
      { color: "#FFBF00", label: "Amber (50-69%)" },
      { color: "#ff0000", label: "Red (30-49%)" },
      { color: "#808080", label: "Grey (<30%)" },
    ];
    
    let legendX = margin + 15;
    colors.forEach((item) => {
      const rgb = hexToRgb(item.color);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(legendX, legendY - 2, 3, 3, "F");
      doc.text(item.label, legendX + 5, legendY);
      legendX += doc.getTextWidth(item.label) + 20;
    });
  };

  // Prepare table data with row colors
  const tableData: Array<{
    rank: string;
    member: string;
    chapter: string;
    score: string;
    status: string;
    color: [number, number, number];
  }> = upload.dataPoints.map((dp, index) => {
    const scoreColor = getScoreColor(dp.totalScore);
    const scoreRgb = hexToRgb(scoreColor);
    
    return {
      rank: (index + 1).toString(),
      member: dp.member.displayName,
      chapter: dp.member.chapter ?? "—",
      score: Math.round(dp.totalScore).toString(),
      status: getScoreLabel(dp.totalScore),
      color: scoreRgb,
    };
  });

  // Generate table with autoTable
  let totalPages = 1;
  
  autoTable(doc, {
    head: [["Rank", "Member", "Chapter", "Total Score", "Status"]],
    body: tableData.map((row) => [row.rank, row.member, row.chapter, row.score, row.status]),
    startY: 35,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    didParseCell: (data) => {
      // Color code rows based on score
      if (data.row.index >= 0 && data.row.index < tableData.length) {
        const rowData = tableData[data.row.index];
        if (rowData && rowData.color) {
          data.cell.styles.fillColor = rowData.color;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    didDrawPage: (data) => {
      // Update total pages
      totalPages = doc.getNumberOfPages();
      const pageNum = data.pageNumber;
      // Add header and footer to each page
      addHeader(pageNum, totalPages);
      addFooter(pageNum, totalPages);
    },
  });
  
  // Update headers and footers on all pages with correct total
  const finalTotalPages = doc.getNumberOfPages();
  for (let i = 1; i <= finalTotalPages; i++) {
    doc.setPage(i);
    addHeader(i, finalTotalPages);
    addFooter(i, finalTotalPages);
  }

  // Generate filename
  const filenamePeriodLabel = upload.label ?? 
    `${periodStart.toLocaleDateString().replace(/\//g, "-")}_${periodEnd.toLocaleDateString().replace(/\//g, "-")}`;
  const filename = `BNI_Score_Report_${filenamePeriodLabel}.pdf`;

  // Save PDF
  doc.save(filename);
}

