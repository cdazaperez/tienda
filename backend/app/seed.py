"""
Script para cargar datos de ejemplo en la base de datos
Ejecutar: python -m app.seed
"""

import sys
import os
from decimal import Decimal

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.product import Product
from app.models.config import StoreConfig, Sequence
from app.models.inventory import InventoryMovement, MovementType


def seed_database():
    """Carga datos de ejemplo"""
    print("Creando tablas...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Verificar si ya hay datos
        if db.query(User).first():
            print("La base de datos ya tiene datos. Saltando seed.")
            return

        print("Cargando datos de ejemplo...")

        # ==================== USUARIOS ====================
        print("  Creando usuarios...")

        admin = User(
            email="admin@tienda.com",
            username="admin",
            password_hash=get_password_hash("Admin123!"),
            first_name="Administrador",
            last_name="Sistema",
            role=UserRole.ADMIN
        )
        db.add(admin)

        seller = User(
            email="vendedor@tienda.com",
            username="vendedor",
            password_hash=get_password_hash("Vendedor123!"),
            first_name="Juan",
            last_name="Pérez",
            role=UserRole.SELLER
        )
        db.add(seller)

        db.flush()

        # ==================== CATEGORÍAS ====================
        print("  Creando categorías...")

        categories_data = [
            {"name": "Camisetas", "description": "Camisetas y playeras de diversos estilos"},
            {"name": "Pantalones", "description": "Jeans, pantalones casuales y formales"},
            {"name": "Gorras", "description": "Gorras, cachuchas y sombreros"},
            {"name": "Gafas", "description": "Gafas de sol y accesorios"},
            {"name": "Accesorios", "description": "Cinturones, billeteras y otros accesorios"},
        ]

        categories = {}
        for cat_data in categories_data:
            cat = Category(**cat_data)
            db.add(cat)
            db.flush()
            categories[cat_data["name"]] = cat

        # ==================== PRODUCTOS ====================
        print("  Creando productos...")

        products_data = [
            # Camisetas
            {
                "sku": "CAM-001",
                "barcode": "7501234567890",
                "name": "Camiseta Básica Blanca",
                "description": "Camiseta de algodón 100%, cuello redondo",
                "category": "Camisetas",
                "brand": "BasicWear",
                "size": "M",
                "color": "Blanco",
                "sale_price": Decimal("15990"),
                "cost_price": Decimal("8000"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 10,
                "initial_stock": 50
            },
            {
                "sku": "CAM-002",
                "barcode": "7501234567891",
                "name": "Camiseta Básica Negra",
                "description": "Camiseta de algodón 100%, cuello redondo",
                "category": "Camisetas",
                "brand": "BasicWear",
                "size": "M",
                "color": "Negro",
                "sale_price": Decimal("15990"),
                "cost_price": Decimal("8000"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 10,
                "initial_stock": 45
            },
            {
                "sku": "CAM-003",
                "barcode": "7501234567892",
                "name": "Polo Premium Azul",
                "description": "Polo de algodón piqué con bordado",
                "category": "Camisetas",
                "brand": "PoloStyle",
                "size": "L",
                "color": "Azul",
                "sale_price": Decimal("29990"),
                "cost_price": Decimal("15000"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 5,
                "initial_stock": 30
            },
            # Pantalones
            {
                "sku": "PAN-001",
                "barcode": "7501234567893",
                "name": "Jean Clásico Azul",
                "description": "Jean de mezclilla, corte recto",
                "category": "Pantalones",
                "brand": "DenimCo",
                "size": "32",
                "color": "Azul",
                "sale_price": Decimal("39990"),
                "cost_price": Decimal("20000"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 8,
                "initial_stock": 25
            },
            {
                "sku": "PAN-002",
                "barcode": "7501234567894",
                "name": "Pantalón Casual Beige",
                "description": "Pantalón de gabardina, corte slim",
                "category": "Pantalones",
                "brand": "CasualFit",
                "size": "34",
                "color": "Beige",
                "sale_price": Decimal("34990"),
                "cost_price": Decimal("17500"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 5,
                "initial_stock": 20
            },
            # Gorras
            {
                "sku": "GOR-001",
                "barcode": "7501234567895",
                "name": "Gorra Baseball Negra",
                "description": "Gorra de baseball con ajuste trasero",
                "category": "Gorras",
                "brand": "CapStyle",
                "size": "Única",
                "color": "Negro",
                "sale_price": Decimal("12990"),
                "cost_price": Decimal("6500"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 15,
                "initial_stock": 40
            },
            {
                "sku": "GOR-002",
                "barcode": "7501234567896",
                "name": "Gorra Trucker Roja",
                "description": "Gorra trucker con malla trasera",
                "category": "Gorras",
                "brand": "CapStyle",
                "size": "Única",
                "color": "Rojo",
                "sale_price": Decimal("14990"),
                "cost_price": Decimal("7500"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 10,
                "initial_stock": 35
            },
            # Gafas
            {
                "sku": "GAF-001",
                "barcode": "7501234567897",
                "name": "Gafas de Sol Aviador",
                "description": "Gafas estilo aviador con protección UV",
                "category": "Gafas",
                "brand": "SunVision",
                "size": "Única",
                "color": "Dorado/Negro",
                "sale_price": Decimal("24990"),
                "cost_price": Decimal("12500"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 10,
                "initial_stock": 25
            },
            {
                "sku": "GAF-002",
                "barcode": "7501234567898",
                "name": "Gafas de Sol Wayfarer",
                "description": "Gafas estilo wayfarer clásico",
                "category": "Gafas",
                "brand": "SunVision",
                "size": "Única",
                "color": "Negro",
                "sale_price": Decimal("22990"),
                "cost_price": Decimal("11500"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 10,
                "initial_stock": 30
            },
            # Accesorios
            {
                "sku": "ACC-001",
                "barcode": "7501234567899",
                "name": "Cinturón Cuero Negro",
                "description": "Cinturón de cuero genuino con hebilla metálica",
                "category": "Accesorios",
                "brand": "LeatherCraft",
                "size": "M",
                "color": "Negro",
                "sale_price": Decimal("19990"),
                "cost_price": Decimal("10000"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 8,
                "initial_stock": 20
            },
            {
                "sku": "ACC-002",
                "barcode": "7501234567900",
                "name": "Billetera Cuero Café",
                "description": "Billetera de cuero con múltiples compartimentos",
                "category": "Accesorios",
                "brand": "LeatherCraft",
                "size": "Única",
                "color": "Café",
                "sale_price": Decimal("29990"),
                "cost_price": Decimal("15000"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 5,
                "initial_stock": 15
            },
            {
                "sku": "ACC-003",
                "barcode": "7501234567901",
                "name": "Reloj Deportivo Digital",
                "description": "Reloj digital resistente al agua",
                "category": "Accesorios",
                "brand": "SportTime",
                "size": "Única",
                "color": "Negro",
                "sale_price": Decimal("49990"),
                "cost_price": Decimal("25000"),
                "tax_rate": Decimal("0.19"),
                "min_stock": 3,
                "initial_stock": 10
            },
        ]

        for prod_data in products_data:
            category_name = prod_data.pop("category")
            initial_stock = prod_data.pop("initial_stock")

            product = Product(
                **prod_data,
                category_id=categories[category_name].id,
                current_stock=initial_stock
            )
            db.add(product)
            db.flush()

            # Crear movimiento de inventario inicial
            if initial_stock > 0:
                movement = InventoryMovement(
                    product_id=product.id,
                    user_id=admin.id,
                    type=MovementType.ENTRY,
                    quantity=initial_stock,
                    previous_stock=0,
                    new_stock=initial_stock,
                    reason="Stock inicial"
                )
                db.add(movement)

        # ==================== CONFIGURACIÓN ====================
        print("  Creando configuración de tienda...")

        config = StoreConfig(
            store_name="Mi Tienda de Ropa",
            store_address="Calle Principal 123, Ciudad",
            store_phone="+56 9 1234 5678",
            store_email="contacto@mitienda.com",
            store_rut="12.345.678-9",
            primary_color="#3B82F6",
            secondary_color="#1E40AF",
            accent_color="#F59E0B",
            receipt_header="¡Bienvenido a nuestra tienda!",
            receipt_footer="Gracias por su compra. Vuelva pronto.",
            currency_symbol="$",
            currency_code="CLP"
        )
        db.add(config)

        # ==================== SECUENCIA ====================
        print("  Creando secuencia de recibos...")

        sequence = Sequence(
            name="receipt",
            prefix="R",
            current_value=0,
            padding=8
        )
        db.add(sequence)

        db.commit()
        print("\n✅ Datos de ejemplo cargados exitosamente!")
        print("\nCredenciales de acceso:")
        print("  Admin:    admin@tienda.com / Admin123!")
        print("  Vendedor: vendedor@tienda.com / Vendedor123!")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error al cargar datos: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
