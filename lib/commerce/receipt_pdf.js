if (typeof window !== "undefined") {
  throw new Error("lib/commerce/receipt_pdf is server-only.");
}

// The buyer's receipt / invoice as a real PDF, drawn with pdf-lib so it needs
// no headless browser. Mirrors store/invoice_view.jsx: seller block, receipt
// number and stamp, billed-to, the line items, totals, then footer + refunds.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatPrice } from "./pricing";

const PAGE = { width: 595.28, height: 841.89 }; // A4, points
const MARGIN = 48;
const INK = rgb(0.07, 0.07, 0.08);
const MUTED = rgb(0.42, 0.42, 0.45);
const RULE = rgb(0.87, 0.87, 0.89);
const PAID = rgb(0.02, 0.47, 0.34);
const DUE = rgb(0.71, 0.33, 0.04);

// Characters outside Latin-1 that WinAnsi (the standard fonts' encoding) still has.
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Standard PDF fonts can't draw arbitrary Unicode — swap or drop the rest. */
function safe(value) {
  return Array.from(String(value ?? ""))
    .map((ch) => {
      if (ch === "−") return "-";
      if (ch === "\t") return " ";
      const code = ch.codePointAt(0);
      return code <= 0xff || WINANSI_EXTRA.has(ch) ? ch : "?";
    })
    .join("");
}

function formatDay(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** INV-0042 for order ORD-0042 — same rule as the on-screen invoice. */
function invoiceNumber(order, settings) {
  const orderPrefix = settings?.invoices?.orderPrefix || "ORD-";
  const invoicePrefix = settings?.invoices?.invoicePrefix || "INV-";
  const number = String(order?.number || "");
  return number.startsWith(orderPrefix) ? `${invoicePrefix}${number.slice(orderPrefix.length)}` : `${invoicePrefix}${number}`;
}

export function receiptFilename(order, settings) {
  const paid = ["paid", "fulfilled", "partially_refunded", "refunded"].includes(order.status);
  return `${paid ? "Receipt" : "Invoice"}-${invoiceNumber(order, settings)}.pdf`.replace(/[^\w.-]+/g, "-");
}

/** Receipt / invoice PDF bytes for one order. */
export async function buildReceiptPdf({ order, items, settings, galleryName = "" }) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const inv = settings?.invoices || {};
  const store = settings?.store || {};
  const billing = order.billing || {};
  const address = billing.address || {};
  const paid = ["paid", "fulfilled", "partially_refunded", "refunded"].includes(order.status);
  const money = (cents) => formatPrice(cents, order.currency);
  const number = invoiceNumber(order, settings);
  const sellerName = inv.sellerName || store.name || galleryName || "Receipt";

  doc.setTitle(`${paid ? "Receipt" : "Invoice"} ${number}`);
  doc.setAuthor(safe(sellerName));

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const right = PAGE.width - MARGIN;

  const width = (text, size, font = regular) => font.widthOfTextAtSize(safe(text), size);
  const draw = (text, x, top, { size = 10, font = regular, color = INK, align = "left" } = {}) => {
    const str = safe(text);
    const drawX = align === "right" ? x - font.widthOfTextAtSize(str, size) : x;
    page.drawText(str, { x: drawX, y: top - size, size, font, color });
  };
  const rule = (top, color = RULE, thickness = 0.75) =>
    page.drawLine({ start: { x: MARGIN, y: top }, end: { x: right, y: top }, thickness, color });

  /** Greedy word wrap of `text` (which may hold newlines) to `max` points. */
  const wrap = (text, max, size, font = regular) => {
    const lines = [];
    for (const paragraph of safe(text).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > max) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  };

  const ensureRoom = (needed) => {
    if (y - needed >= MARGIN) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  // Header: seller on the left, receipt number + stamp on the right.
  const headerTop = y;
  draw(sellerName, MARGIN, y, { size: 18, font: bold });
  y -= 26;
  const sellerLines = [
    ...(inv.sellerAddress ? wrap(inv.sellerAddress, 260, 9) : []),
    ...(inv.taxId ? [`Tax ID ${inv.taxId}`] : []),
    ...(store.supportEmail ? [store.supportEmail] : []),
  ];
  for (const line of sellerLines) {
    draw(line, MARGIN, y, { size: 9, color: MUTED });
    y -= 13;
  }

  let ry = headerTop;
  draw(paid ? "RECEIPT" : "INVOICE", right, ry, { size: 9, font: bold, color: MUTED, align: "right" });
  ry -= 14;
  draw(number, right, ry, { size: 12, font: bold, align: "right" });
  ry -= 17;
  draw(`Order ${order.number}`, right, ry, { size: 9, color: MUTED, align: "right" });
  ry -= 12;
  draw(`Issued ${formatDay(order.paidAt || order.createdAt)}`, right, ry, { size: 9, color: MUTED, align: "right" });
  ry -= 18;
  const stamp = order.status === "refunded" ? "REFUNDED" : paid ? "PAID" : "DUE";
  const stampColor = paid && order.status !== "refunded" ? PAID : order.status === "refunded" ? MUTED : DUE;
  const stampWidth = width(stamp, 8, bold) + 14;
  page.drawRectangle({ x: right - stampWidth, y: ry - 14, width: stampWidth, height: 16, borderColor: stampColor, borderWidth: 1 });
  draw(stamp, right - 7, ry - 4, { size: 8, font: bold, color: stampColor, align: "right" });
  ry -= 16;

  y = Math.min(y, ry) - 24;
  rule(y);
  y -= 20;

  // Billed to / from gallery.
  const billedTop = y;
  draw("BILLED TO", MARGIN, y, { size: 8, font: bold, color: MUTED });
  y -= 14;
  const cityLine = [address.city, address.region, address.postalCode].filter(Boolean).join(", ");
  const billedLines = [
    { text: order.name || order.email, font: bold },
    ...(billing.company ? [{ text: billing.company }] : []),
    { text: order.email, color: MUTED },
    ...[address.line1, address.line2, cityLine, address.country].filter(Boolean).map((text) => ({ text, color: MUTED })),
  ];
  for (const line of billedLines) {
    draw(line.text, MARGIN, y, { size: 10, font: line.font, color: line.color });
    y -= 14;
  }
  if (galleryName) {
    draw("FROM GALLERY", right, billedTop, { size: 8, font: bold, color: MUTED, align: "right" });
    draw(galleryName, right, billedTop - 14, { size: 10, align: "right" });
  }
  y -= 16;

  // Line items.
  const col = { qty: right - 170, unit: right - 85, amount: right };
  const itemWidth = col.qty - 40 - MARGIN;
  const tableHeader = () => {
    draw("ITEM", MARGIN, y, { size: 8, font: bold, color: MUTED });
    draw("QTY", col.qty, y, { size: 8, font: bold, color: MUTED, align: "right" });
    draw("UNIT", col.unit, y, { size: 8, font: bold, color: MUTED, align: "right" });
    draw("AMOUNT", col.amount, y, { size: 8, font: bold, color: MUTED, align: "right" });
    y -= 14;
    rule(y);
    y -= 10;
  };
  tableHeader();

  for (const item of items) {
    const name = wrap(item.productName || item.title, itemWidth, 10, bold);
    const detail = item.title && item.title !== item.productName ? wrap(item.title, itemWidth, 9) : [];
    const height = name.length * 13 + detail.length * 12 + 10;
    if (y - height < MARGIN) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
      tableHeader();
    }
    const rowTop = y;
    for (const line of name) {
      draw(line, MARGIN, y, { size: 10, font: bold });
      y -= 13;
    }
    for (const line of detail) {
      draw(line, MARGIN, y, { size: 9, color: MUTED });
      y -= 12;
    }
    draw(String(item.quantity || 1), col.qty, rowTop, { size: 10, align: "right" });
    draw(money(item.unitCents), col.unit, rowTop, { size: 10, align: "right" });
    draw(money(item.totalCents), col.amount, rowTop, { size: 10, align: "right" });
    y -= 6;
    rule(y);
    y -= 10;
  }

  // Totals.
  const totals = [["Subtotal", money(order.subtotalCents)]];
  if (order.discountCents) totals.push([`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`, `-${money(order.discountCents)}`]);
  if (order.taxCents) {
    totals.push([`${billing.taxLabel || settings?.taxes?.label || "Tax"}${billing.taxInclusive ? " (included)" : ""}`, money(order.taxCents)]);
  }
  ensureRoom(totals.length * 16 + 60);
  const labelX = right - 230;
  y -= 4;
  for (const [label, value] of totals) {
    draw(label, labelX, y, { size: 10, color: MUTED });
    draw(value, right, y, { size: 10, align: "right" });
    y -= 16;
  }
  y -= 2;
  page.drawLine({ start: { x: labelX, y }, end: { x: right, y }, thickness: 1, color: INK });
  y -= 10;
  draw(paid ? "Total paid" : "Total due", labelX, y, { size: 12, font: bold });
  draw(money(order.totalCents), right, y, { size: 12, font: bold, align: "right" });
  y -= 18;
  if (order.refundedCents) {
    draw("Refunded", labelX, y, { size: 10, color: MUTED });
    draw(`-${money(order.refundedCents)}`, right, y, { size: 10, align: "right" });
    y -= 16;
  }

  // Footer notes.
  const notes = [
    ...(inv.footer ? wrap(inv.footer, right - MARGIN, 9) : []),
    ...(settings?.policies?.refunds ? wrap(`Refunds: ${settings.policies.refunds}`, right - MARGIN, 9) : []),
  ];
  if (notes.length) {
    ensureRoom(notes.length * 12 + 40);
    y -= 20;
    rule(y);
    y -= 14;
    for (const line of notes) {
      ensureRoom(12);
      draw(line, MARGIN, y, { size: 9, color: MUTED });
      y -= 12;
    }
  }

  return doc.save();
}
