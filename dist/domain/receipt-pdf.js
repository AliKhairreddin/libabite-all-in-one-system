const POINTS_PER_MM = 72 / 25.4;
const RECEIPT_WIDTH = 80 * POINTS_PER_MM;
const RECEIPT_MARGIN = 12;
function asciiText(value) {
    return String(value ?? "")
        .replace(/€/g, "EUR")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function escapePdfText(value) {
    return asciiText(value).replace(/[\\()]/g, "\\$&");
}
function wrapText(value, maxLength = 32) {
    const words = asciiText(value).split(" ").filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
        if (!current) {
            current = word;
            return;
        }
        if ((current.length + word.length + 1) <= maxLength) {
            current = `${current} ${word}`;
            return;
        }
        lines.push(current);
        current = word;
    });
    if (current)
        lines.push(current);
    return lines.length ? lines : [""];
}
function pdfObject(id, body) {
    return `${id} 0 obj\n${body}\nendobj\n`;
}
export function createReceiptPdfBlob(input) {
    const textRows = [
        { value: input.restaurantName, size: 12, bold: true },
        { value: input.location, size: 8 },
        { value: `Order #${input.orderNumber}`, size: 11, bold: true, gapAfter: 2 },
        { value: input.createdAt, size: 8 },
        { value: input.orderType, size: 8 },
        { value: input.locationLabel, size: 8 },
        { value: input.fulfillment, size: 8 },
        { value: `Staff: ${input.staffName}`, size: 8, gapAfter: 4 },
        { divider: true }
    ];
    input.items.forEach((item) => {
        wrapText(`${item.quantity}x ${item.name}`, 31).forEach((value, index) => {
            textRows.push({ value, size: index === 0 ? 9 : 8, bold: true });
        });
        textRows.push({ value: `${item.unitPrice} each  ${item.total}`, size: 8 });
        if (item.detail)
            textRows.push(...wrapText(item.detail, 31).map((value) => ({ value, size: 7 })));
    });
    if (input.notes) {
        textRows.push({ value: "Order note", size: 8, bold: true, gapAfter: 1 });
        textRows.push(...wrapText(input.notes, 31).map((value) => ({ value, size: 8 })));
    }
    textRows.push({ divider: true });
    input.totals.forEach((total) => {
        textRows.push({ value: `${total.label}: ${total.value}`, size: total.label === "Total" ? 10 : 8, bold: total.label === "Total" });
    });
    input.paymentRows.forEach((row) => textRows.push({ value: row, size: 8 }));
    (input.footerRows || []).forEach((row) => textRows.push({ value: row, size: 7 }));
    const height = Math.max(360, RECEIPT_MARGIN * 2 + textRows.reduce((sum, row) => {
        if (row.divider)
            return sum + 11;
        return sum + (row.size || 8) + (row.gapAfter || 2);
    }, 0) + 28);
    let y = height - RECEIPT_MARGIN;
    const commands = ["0.1 w"];
    function addText(row) {
        const size = row.size || 8;
        const font = row.bold ? "F2" : "F1";
        commands.push(`BT /${font} ${size} Tf ${RECEIPT_MARGIN} ${y.toFixed(2)} Td (${escapePdfText(row.value)}) Tj ET`);
        y -= size + (row.gapAfter ?? 2);
    }
    function addDivider() {
        y -= 3;
        commands.push(`${RECEIPT_MARGIN} ${y.toFixed(2)} m ${(RECEIPT_WIDTH - RECEIPT_MARGIN).toFixed(2)} ${y.toFixed(2)} l S`);
        y -= 8;
    }
    textRows.forEach((row) => {
        if (row.divider) {
            addDivider();
            return;
        }
        addText(row);
    });
    const stream = commands.join("\n");
    const objects = [
        pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>"),
        pdfObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
        pdfObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${RECEIPT_WIDTH.toFixed(2)} ${height.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`),
        pdfObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"),
        pdfObject(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>"),
        pdfObject(6, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object) => {
        offsets.push(pdf.length);
        pdf += object;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    offsets.slice(1).forEach((offset) => {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
}
//# sourceMappingURL=receipt-pdf.js.map