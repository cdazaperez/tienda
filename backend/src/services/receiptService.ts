import PDFDocument from 'pdfkit';
import { Sale, SaleItem, StoreConfig } from '@prisma/client';
import prisma from '../config/database.js';
import Decimal from 'decimal.js';

interface ReceiptData {
  sale: Sale & {
    items: SaleItem[];
    user: { firstName: string; lastName: string };
  };
  storeConfig: StoreConfig;
}

export const receiptService = {
  async getReceiptData(saleId: string): Promise<ReceiptData> {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    const storeConfig = await prisma.storeConfig.findUnique({
      where: { id: 'store_config' },
    });

    if (!storeConfig) {
      throw new Error('Configuración de tienda no encontrada');
    }

    return { sale, storeConfig };
  },

  async generatePDF(saleId: string): Promise<Buffer> {
    const { sale, storeConfig } = await this.getReceiptData(saleId);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: [226.77, 600], // ~80mm width
        margin: 10,
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const centerX = 103.4;

      // Header
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(storeConfig.storeName, { align: 'center' });

      if (storeConfig.storeNit) {
        doc.fontSize(8).font('Helvetica');
        doc.text(`NIT: ${storeConfig.storeNit}`, { align: 'center' });
      }

      if (storeConfig.storeAddress) {
        doc.fontSize(8).text(storeConfig.storeAddress, { align: 'center' });
      }

      if (storeConfig.storePhone) {
        doc.text(`Tel: ${storeConfig.storePhone}`, { align: 'center' });
      }

      doc.moveDown(0.5);
      doc.text('─'.repeat(35), { align: 'center' });
      doc.moveDown(0.5);

      // Receipt info
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`RECIBO #${sale.receiptNumber}`, { align: 'center' });
      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Fecha: ${sale.createdAt.toLocaleDateString('es-CO')} ${sale.createdAt.toLocaleTimeString('es-CO')}`,
        { align: 'center' }
      );
      doc.text(
        `Vendedor: ${sale.user.firstName} ${sale.user.lastName}`,
        { align: 'center' }
      );

      doc.moveDown(0.5);
      doc.text('─'.repeat(35), { align: 'center' });
      doc.moveDown(0.5);

      // Items header
      doc.fontSize(8).font('Helvetica-Bold');
      const startY = doc.y;
      doc.text('Producto', 10, startY);
      doc.text('Cant', 120, startY);
      doc.text('Precio', 145, startY);
      doc.text('Total', 180, startY);
      doc.moveDown(0.3);
      doc.font('Helvetica');
      doc.text('─'.repeat(35), { align: 'center' });
      doc.moveDown(0.3);

      // Items
      for (const item of sale.items) {
        const itemY = doc.y;
        const unitPrice = new Decimal(item.unitPrice.toString());
        const total = new Decimal(item.total.toString());
        const discount = new Decimal(item.discountAmount.toString());

        // Nombre del producto (puede ocupar más de una línea)
        doc.fontSize(8);
        const productName =
          item.productName.length > 18
            ? item.productName.substring(0, 18) + '...'
            : item.productName;
        doc.text(productName, 10, itemY, { width: 100 });

        const priceY = itemY;
        doc.text(item.quantity.toString(), 120, priceY);
        doc.text(`$${unitPrice.toFixed(2)}`, 140, priceY);
        doc.text(`$${total.toFixed(2)}`, 175, priceY);

        // Mostrar descuento si existe
        if (discount.greaterThan(0)) {
          doc.moveDown(0.2);
          doc.fontSize(7);
          doc.text(
            `  Desc: -$${discount.toFixed(2)} (${item.discountPercent}%)`,
            10
          );
        }

        doc.moveDown(0.3);
      }

      doc.text('─'.repeat(35), { align: 'center' });
      doc.moveDown(0.5);

      // Totals
      const subtotal = new Decimal(sale.subtotal.toString());
      const taxAmount = new Decimal(sale.taxAmount.toString());
      const discountAmount = new Decimal(sale.discountAmount.toString());
      const total = new Decimal(sale.total.toString());
      const amountPaid = new Decimal(sale.amountPaid.toString());
      const changeAmount = new Decimal(sale.changeAmount.toString());

      doc.fontSize(9);
      const totalsX = 100;
      const valuesX = 165;

      doc.text('Subtotal:', totalsX, doc.y);
      doc.text(`$${subtotal.toFixed(2)}`, valuesX, doc.y - doc.currentLineHeight());
      doc.moveDown(0.3);

      if (discountAmount.greaterThan(0)) {
        doc.text('Descuento:', totalsX, doc.y);
        doc.text(
          `-$${discountAmount.toFixed(2)}`,
          valuesX,
          doc.y - doc.currentLineHeight()
        );
        doc.moveDown(0.3);
      }

      if (taxAmount.greaterThan(0)) {
        doc.text('Impuestos:', totalsX, doc.y);
        doc.text(`$${taxAmount.toFixed(2)}`, valuesX, doc.y - doc.currentLineHeight());
        doc.moveDown(0.3);
      }

      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('TOTAL:', totalsX, doc.y);
      doc.text(`$${total.toFixed(2)}`, valuesX, doc.y - doc.currentLineHeight());
      doc.moveDown(0.5);

      // Payment info
      doc.font('Helvetica').fontSize(8);
      doc.text('─'.repeat(35), { align: 'center' });
      doc.moveDown(0.3);

      const paymentMethodText: Record<string, string> = {
        CASH: 'Efectivo',
        CARD: 'Tarjeta',
        TRANSFER: 'Transferencia',
        MIXED: 'Mixto',
      };

      doc.text(
        `Método de pago: ${paymentMethodText[sale.paymentMethod] || sale.paymentMethod}`,
        { align: 'center' }
      );
      doc.text(`Pagado: $${amountPaid.toFixed(2)}`, { align: 'center' });

      if (sale.paymentMethod === 'CASH' && changeAmount.greaterThan(0)) {
        doc.font('Helvetica-Bold');
        doc.text(`Cambio: $${changeAmount.toFixed(2)}`, { align: 'center' });
      }

      doc.moveDown(1);

      // Footer
      doc.font('Helvetica').fontSize(8);
      doc.text('─'.repeat(35), { align: 'center' });
      doc.moveDown(0.3);

      if (storeConfig.receiptFooter) {
        doc.text(storeConfig.receiptFooter, { align: 'center' });
      } else {
        doc.text('¡Gracias por su compra!', { align: 'center' });
      }

      doc.moveDown(0.5);
      doc.fontSize(7);
      doc.text(`ID: ${sale.id}`, { align: 'center' });

      doc.end();
    });
  },

  generateHTMLReceipt(
    sale: Sale & {
      items: SaleItem[];
      user: { firstName: string; lastName: string };
    },
    storeConfig: StoreConfig
  ): string {
    const subtotal = new Decimal(sale.subtotal.toString());
    const taxAmount = new Decimal(sale.taxAmount.toString());
    const discountAmount = new Decimal(sale.discountAmount.toString());
    const total = new Decimal(sale.total.toString());
    const amountPaid = new Decimal(sale.amountPaid.toString());
    const changeAmount = new Decimal(sale.changeAmount.toString());

    const paymentMethodText: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      MIXED: 'Mixto',
    };

    const itemsHtml = sale.items
      .map((item) => {
        const unitPrice = new Decimal(item.unitPrice.toString());
        const itemTotal = new Decimal(item.total.toString());
        const discount = new Decimal(item.discountAmount.toString());

        return `
        <tr>
          <td>${item.productName}</td>
          <td class="center">${item.quantity}</td>
          <td class="right">$${unitPrice.toFixed(2)}</td>
          <td class="right">$${itemTotal.toFixed(2)}</td>
        </tr>
        ${
          discount.greaterThan(0)
            ? `<tr class="discount-row"><td colspan="4">Desc: -$${discount.toFixed(2)} (${item.discountPercent}%)</td></tr>`
            : ''
        }
      `;
      })
      .join('');

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recibo #${sale.receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 80mm;
      margin: 0 auto;
      padding: 10px;
      background: white;
    }
    .header { text-align: center; margin-bottom: 10px; }
    .store-name { font-size: 16px; font-weight: bold; }
    .store-info { font-size: 10px; color: #666; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .receipt-info { text-align: center; margin: 10px 0; }
    .receipt-number { font-size: 14px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 4px 2px; text-align: left; font-size: 11px; }
    th { border-bottom: 1px solid #000; }
    .center { text-align: center; }
    .right { text-align: right; }
    .discount-row td { font-size: 10px; color: #666; padding-left: 10px; }
    .totals { margin-top: 10px; }
    .totals-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals-row.total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
    .payment-info { text-align: center; margin: 10px 0; }
    .footer { text-align: center; margin-top: 15px; font-size: 10px; }
    .footer p { margin: 3px 0; }
    @media print {
      body { width: 80mm; margin: 0; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${storeConfig.logoUrl ? `<img src="${storeConfig.logoUrl}" alt="Logo" style="max-width: 60px; margin-bottom: 5px;">` : ''}
    <div class="store-name">${storeConfig.storeName}</div>
    ${storeConfig.storeNit ? `<div class="store-info">NIT: ${storeConfig.storeNit}</div>` : ''}
    ${storeConfig.storeAddress ? `<div class="store-info">${storeConfig.storeAddress}</div>` : ''}
    ${storeConfig.storePhone ? `<div class="store-info">Tel: ${storeConfig.storePhone}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="receipt-info">
    <div class="receipt-number">RECIBO #${sale.receiptNumber}</div>
    <div>Fecha: ${sale.createdAt.toLocaleDateString('es-CO')} ${sale.createdAt.toLocaleTimeString('es-CO')}</div>
    <div>Vendedor: ${sale.user.firstName} ${sale.user.lastName}</div>
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="center">Cant</th>
        <th class="right">Precio</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>$${subtotal.toFixed(2)}</span>
    </div>
    ${
      discountAmount.greaterThan(0)
        ? `<div class="totals-row"><span>Descuento:</span><span>-$${discountAmount.toFixed(2)}</span></div>`
        : ''
    }
    ${
      taxAmount.greaterThan(0)
        ? `<div class="totals-row"><span>Impuestos:</span><span>$${taxAmount.toFixed(2)}</span></div>`
        : ''
    }
    <div class="totals-row total">
      <span>TOTAL:</span>
      <span>$${total.toFixed(2)}</span>
    </div>
  </div>

  <div class="divider"></div>

  <div class="payment-info">
    <div>Método de pago: ${paymentMethodText[sale.paymentMethod] || sale.paymentMethod}</div>
    <div>Pagado: $${amountPaid.toFixed(2)}</div>
    ${sale.paymentMethod === 'CASH' && changeAmount.greaterThan(0) ? `<div><strong>Cambio: $${changeAmount.toFixed(2)}</strong></div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="footer">
    <p>${storeConfig.receiptFooter || '¡Gracias por su compra!'}</p>
    <p style="color: #999; font-size: 8px;">ID: ${sale.id}</p>
  </div>

  <script>
    window.onload = function() {
      if (window.location.search.includes('print=true')) {
        window.print();
      }
    }
  </script>
</body>
</html>
    `;
  },
};

export default receiptService;
