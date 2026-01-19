"""
Script para agregar las columnas de impuestos a la tabla store_config.
Ejecutar: python -m app.add_tax_columns
"""
from sqlalchemy import text
from app.core.database import engine

def add_tax_columns():
    """Agrega las columnas tax_enabled, tax_rate, tax_name a store_config"""

    with engine.connect() as conn:
        # Verificar si las columnas ya existen
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'store_config'
            AND column_name IN ('tax_enabled', 'tax_rate', 'tax_name')
        """))
        existing_columns = [row[0] for row in result]

        # Agregar columnas faltantes
        if 'tax_enabled' not in existing_columns:
            print("Agregando columna tax_enabled...")
            conn.execute(text("""
                ALTER TABLE store_config
                ADD COLUMN tax_enabled BOOLEAN NOT NULL DEFAULT TRUE
            """))
            print("  ✓ tax_enabled agregada")
        else:
            print("  - tax_enabled ya existe")

        if 'tax_rate' not in existing_columns:
            print("Agregando columna tax_rate...")
            conn.execute(text("""
                ALTER TABLE store_config
                ADD COLUMN tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.19
            """))
            print("  ✓ tax_rate agregada")
        else:
            print("  - tax_rate ya existe")

        if 'tax_name' not in existing_columns:
            print("Agregando columna tax_name...")
            conn.execute(text("""
                ALTER TABLE store_config
                ADD COLUMN tax_name VARCHAR(50) NOT NULL DEFAULT 'IVA'
            """))
            print("  ✓ tax_name agregada")
        else:
            print("  - tax_name ya existe")

        conn.commit()
        print("\n✓ Migración completada exitosamente")

if __name__ == "__main__":
    add_tax_columns()
