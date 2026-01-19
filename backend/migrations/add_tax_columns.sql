-- Migración: Agregar columnas de impuestos a store_config
-- Ejecutar en la base de datos PostgreSQL

-- Agregar columna tax_enabled si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'store_config' AND column_name = 'tax_enabled'
    ) THEN
        ALTER TABLE store_config ADD COLUMN tax_enabled BOOLEAN NOT NULL DEFAULT TRUE;
        RAISE NOTICE 'Columna tax_enabled agregada';
    ELSE
        RAISE NOTICE 'Columna tax_enabled ya existe';
    END IF;
END $$;

-- Agregar columna tax_rate si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'store_config' AND column_name = 'tax_rate'
    ) THEN
        ALTER TABLE store_config ADD COLUMN tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.19;
        RAISE NOTICE 'Columna tax_rate agregada';
    ELSE
        RAISE NOTICE 'Columna tax_rate ya existe';
    END IF;
END $$;

-- Agregar columna tax_name si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'store_config' AND column_name = 'tax_name'
    ) THEN
        ALTER TABLE store_config ADD COLUMN tax_name VARCHAR(50) NOT NULL DEFAULT 'IVA';
        RAISE NOTICE 'Columna tax_name agregada';
    ELSE
        RAISE NOTICE 'Columna tax_name ya existe';
    END IF;
END $$;

-- Verificar las columnas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'store_config'
AND column_name IN ('tax_enabled', 'tax_rate', 'tax_name');
