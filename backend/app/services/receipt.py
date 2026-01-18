from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet

from app.models.sale import Sale
from app.models.config import StoreConfig
from app.models.user import User


def generate_receipt_pdf(sale: Sale, config: StoreConfig, user: User) -> bytes:
    """Genera un recibo en formato PDF"""
    buffer = BytesIO()

    # Crear PDF tamaño ticket (80mm x variable)
    width = 80 * mm
    height = 200 * mm  # Altura inicial, se ajustará

    c = canvas.Canvas(buffer, pagesize=(width, height))

    y = height - 10 * mm
    x_left = 5 * mm
    x_right = width - 5 * mm
    x_center = width / 2

    # Encabezado
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(x_center, y, config.store_name)
    y -= 5 * mm

    if config.store_address:
        c.setFont("Helvetica", 8)
        c.drawCentredString(x_center, y, config.store_address)
        y -= 4 * mm

    if config.store_phone:
        c.drawCentredString(x_center, y, f"Tel: {config.store_phone}")
        y -= 4 * mm

    if config.store_rut:
        c.drawCentredString(x_center, y, f"RUT: {config.store_rut}")
        y -= 4 * mm

    if config.receipt_header:
        c.drawCentredString(x_center, y, config.receipt_header)
        y -= 4 * mm

    # Línea separadora
    y -= 2 * mm
    c.line(x_left, y, x_right, y)
    y -= 5 * mm

    # Información de la venta
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x_left, y, f"Recibo: {sale.receipt_number}")
    y -= 4 * mm

    c.setFont("Helvetica", 8)
    c.drawString(x_left, y, f"Fecha: {sale.created_at.strftime('%d/%m/%Y %H:%M')}")
    y -= 4 * mm

    if user:
        c.drawString(x_left, y, f"Vendedor: {user.first_name} {user.last_name}")
        y -= 4 * mm

    # Línea separadora
    y -= 2 * mm
    c.line(x_left, y, x_right, y)
    y -= 5 * mm

    # Items
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x_left, y, "Cant")
    c.drawString(x_left + 12 * mm, y, "Descripción")
    c.drawRightString(x_right, y, "Total")
    y -= 4 * mm

    c.setFont("Helvetica", 8)
    for item in sale.items:
        # Nombre del producto (puede requerir múltiples líneas)
        c.drawString(x_left, y, str(item.quantity))

        # Truncar nombre si es muy largo
        name = item.product_name[:25] + "..." if len(item.product_name) > 28 else item.product_name
        c.drawString(x_left + 12 * mm, y, name)

        c.drawRightString(x_right, y, f"{config.currency_symbol}{item.total:,.2f}")
        y -= 4 * mm

        # Precio unitario y descuento si aplica
        if item.discount_percent > 0:
            c.setFont("Helvetica", 7)
            c.drawString(x_left + 12 * mm, y, f"  @{config.currency_symbol}{item.unit_price:,.2f} -{item.discount_percent}%")
            y -= 3 * mm
            c.setFont("Helvetica", 8)

    # Línea separadora
    y -= 2 * mm
    c.line(x_left, y, x_right, y)
    y -= 5 * mm

    # Totales
    c.setFont("Helvetica", 9)
    c.drawString(x_left, y, "Subtotal:")
    c.drawRightString(x_right, y, f"{config.currency_symbol}{sale.subtotal:,.2f}")
    y -= 4 * mm

    if sale.discount_amount > 0:
        c.drawString(x_left, y, f"Descuento ({sale.discount_percent}%):")
        c.drawRightString(x_right, y, f"-{config.currency_symbol}{sale.discount_amount:,.2f}")
        y -= 4 * mm

    if sale.tax_amount > 0:
        c.drawString(x_left, y, "Impuestos:")
        c.drawRightString(x_right, y, f"{config.currency_symbol}{sale.tax_amount:,.2f}")
        y -= 4 * mm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x_left, y, "TOTAL:")
    c.drawRightString(x_right, y, f"{config.currency_symbol}{sale.total:,.2f}")
    y -= 5 * mm

    # Información de pago
    c.setFont("Helvetica", 8)
    payment_methods = {
        "CASH": "Efectivo",
        "CARD": "Tarjeta",
        "TRANSFER": "Transferencia",
        "MIXED": "Mixto"
    }
    c.drawString(x_left, y, f"Método de pago: {payment_methods.get(sale.payment_method.value, sale.payment_method.value)}")
    y -= 4 * mm

    c.drawString(x_left, y, f"Monto recibido: {config.currency_symbol}{sale.amount_paid:,.2f}")
    y -= 4 * mm

    if sale.change_amount > 0:
        c.drawString(x_left, y, f"Cambio: {config.currency_symbol}{sale.change_amount:,.2f}")
        y -= 4 * mm

    # Línea separadora
    y -= 2 * mm
    c.line(x_left, y, x_right, y)
    y -= 5 * mm

    # Pie de página
    c.setFont("Helvetica", 8)
    if config.receipt_footer:
        c.drawCentredString(x_center, y, config.receipt_footer)
        y -= 4 * mm

    c.drawCentredString(x_center, y, "¡Gracias por su compra!")

    c.save()
    buffer.seek(0)
    return buffer.read()


def generate_receipt_html(sale: Sale, config: StoreConfig, user: User) -> str:
    """Genera un recibo en formato HTML para impresión"""
    payment_methods = {
        "CASH": "Efectivo",
        "CARD": "Tarjeta",
        "TRANSFER": "Transferencia",
        "MIXED": "Mixto"
    }

    items_html = ""
    for item in sale.items:
        discount_info = f'<div class="discount">@{config.currency_symbol}{item.unit_price:,.2f} -{item.discount_percent}%</div>' if item.discount_percent > 0 else ""
        items_html += f"""
        <tr>
            <td class="qty">{item.quantity}</td>
            <td class="desc">
                {item.product_name}
                {discount_info}
            </td>
            <td class="price">{config.currency_symbol}{item.total:,.2f}</td>
        </tr>
        """

    discount_row = ""
    if sale.discount_amount > 0:
        discount_row = f"""
        <tr>
            <td colspan="2">Descuento ({sale.discount_percent}%):</td>
            <td class="price">-{config.currency_symbol}{sale.discount_amount:,.2f}</td>
        </tr>
        """

    tax_row = ""
    if sale.tax_amount > 0:
        tax_row = f"""
        <tr>
            <td colspan="2">Impuestos:</td>
            <td class="price">{config.currency_symbol}{sale.tax_amount:,.2f}</td>
        </tr>
        """

    change_row = ""
    if sale.change_amount > 0:
        change_row = f"""
        <tr>
            <td colspan="2">Cambio:</td>
            <td class="price">{config.currency_symbol}{sale.change_amount:,.2f}</td>
        </tr>
        """

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Recibo {sale.receipt_number}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            padding: 5mm;
        }}
        .header {{
            text-align: center;
            margin-bottom: 10px;
        }}
        .store-name {{
            font-size: 16px;
            font-weight: bold;
        }}
        .divider {{
            border-top: 1px dashed #000;
            margin: 8px 0;
        }}
        .info {{
            margin-bottom: 10px;
        }}
        .info div {{
            margin-bottom: 2px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th, td {{
            text-align: left;
            padding: 2px 0;
        }}
        .qty {{
            width: 30px;
        }}
        .price {{
            text-align: right;
            width: 70px;
        }}
        .discount {{
            font-size: 10px;
            color: #666;
            padding-left: 10px;
        }}
        .totals {{
            margin-top: 10px;
        }}
        .totals td {{
            padding: 3px 0;
        }}
        .total-row {{
            font-weight: bold;
            font-size: 14px;
        }}
        .footer {{
            text-align: center;
            margin-top: 15px;
        }}
        @media print {{
            body {{
                width: 80mm;
            }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="store-name">{config.store_name}</div>
        {f'<div>{config.store_address}</div>' if config.store_address else ''}
        {f'<div>Tel: {config.store_phone}</div>' if config.store_phone else ''}
        {f'<div>RUT: {config.store_rut}</div>' if config.store_rut else ''}
        {f'<div>{config.receipt_header}</div>' if config.receipt_header else ''}
    </div>

    <div class="divider"></div>

    <div class="info">
        <div><strong>Recibo: {sale.receipt_number}</strong></div>
        <div>Fecha: {sale.created_at.strftime('%d/%m/%Y %H:%M')}</div>
        {f'<div>Vendedor: {user.first_name} {user.last_name}</div>' if user else ''}
    </div>

    <div class="divider"></div>

    <table>
        <thead>
            <tr>
                <th class="qty">Cant</th>
                <th>Descripción</th>
                <th class="price">Total</th>
            </tr>
        </thead>
        <tbody>
            {items_html}
        </tbody>
    </table>

    <div class="divider"></div>

    <table class="totals">
        <tr>
            <td colspan="2">Subtotal:</td>
            <td class="price">{config.currency_symbol}{sale.subtotal:,.2f}</td>
        </tr>
        {discount_row}
        {tax_row}
        <tr class="total-row">
            <td colspan="2">TOTAL:</td>
            <td class="price">{config.currency_symbol}{sale.total:,.2f}</td>
        </tr>
        <tr>
            <td colspan="2">Método de pago:</td>
            <td class="price">{payment_methods.get(sale.payment_method.value, sale.payment_method.value)}</td>
        </tr>
        <tr>
            <td colspan="2">Monto recibido:</td>
            <td class="price">{config.currency_symbol}{sale.amount_paid:,.2f}</td>
        </tr>
        {change_row}
    </table>

    <div class="divider"></div>

    <div class="footer">
        {f'<div>{config.receipt_footer}</div>' if config.receipt_footer else ''}
        <div>¡Gracias por su compra!</div>
    </div>

    <script>
        window.onload = function() {{
            window.print();
        }}
    </script>
</body>
</html>
    """

    return html
