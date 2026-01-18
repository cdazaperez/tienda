import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // Crear configuración de tienda
  const storeConfig = await prisma.storeConfig.upsert({
    where: { id: 'store_config' },
    update: {},
    create: {
      id: 'store_config',
      storeName: 'Mi Tienda de Ropa',
      storeNit: '900123456-7',
      storeAddress: 'Calle 123 #45-67, Local 101',
      storePhone: '+57 300 123 4567',
      storeEmail: 'contacto@mitienda.com',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E40AF',
      accentColor: '#F59E0B',
      defaultTaxRate: 0.19, // IVA 19%
      receiptFooter: '¡Gracias por su compra! Visítenos pronto.',
    },
  });
  console.log('✅ Configuración de tienda creada');

  // Crear secuencias
  await prisma.sequence.upsert({
    where: { id: 'receipt_number' },
    update: {},
    create: { id: 'receipt_number', currentValue: 0 },
  });

  await prisma.sequence.upsert({
    where: { id: 'return_number' },
    update: {},
    create: { id: 'return_number', currentValue: 0 },
  });
  console.log('✅ Secuencias creadas');

  // Crear usuario administrador
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tienda.com' },
    update: {},
    create: {
      email: 'admin@tienda.com',
      username: 'admin',
      passwordHash: adminPassword,
      firstName: 'Administrador',
      lastName: 'Sistema',
      role: UserRole.ADMIN,
    },
  });
  console.log('✅ Usuario administrador creado: admin@tienda.com / Admin123!');

  // Crear usuario vendedor
  const sellerPassword = await bcrypt.hash('Vendedor123!', 12);
  const seller = await prisma.user.upsert({
    where: { email: 'vendedor@tienda.com' },
    update: {},
    create: {
      email: 'vendedor@tienda.com',
      username: 'vendedor',
      passwordHash: sellerPassword,
      firstName: 'Juan',
      lastName: 'Vendedor',
      role: UserRole.SELLER,
    },
  });
  console.log('✅ Usuario vendedor creado: vendedor@tienda.com / Vendedor123!');

  // Crear categorías
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Camisetas' },
      update: {},
      create: { name: 'Camisetas', description: 'Camisetas y polos' },
    }),
    prisma.category.upsert({
      where: { name: 'Pantalones' },
      update: {},
      create: { name: 'Pantalones', description: 'Jeans, pantalones casuales y formales' },
    }),
    prisma.category.upsert({
      where: { name: 'Gorras' },
      update: {},
      create: { name: 'Gorras', description: 'Gorras y sombreros' },
    }),
    prisma.category.upsert({
      where: { name: 'Gafas' },
      update: {},
      create: { name: 'Gafas', description: 'Gafas de sol y accesorios' },
    }),
    prisma.category.upsert({
      where: { name: 'Accesorios' },
      update: {},
      create: { name: 'Accesorios', description: 'Cinturones, carteras y otros' },
    }),
  ]);
  console.log('✅ Categorías creadas');

  // Crear productos de ejemplo
  const products = [
    // Camisetas
    {
      sku: 'CAM-001',
      barcode: '7501234567890',
      name: 'Camiseta Básica Blanca',
      description: 'Camiseta 100% algodón',
      categoryId: categories[0].id,
      brand: 'Marca Propia',
      size: 'M',
      color: 'Blanco',
      salePrice: 35000,
      costPrice: 18000,
      taxRate: 0.19,
      minStock: 10,
      currentStock: 50,
    },
    {
      sku: 'CAM-002',
      barcode: '7501234567891',
      name: 'Camiseta Básica Negra',
      description: 'Camiseta 100% algodón',
      categoryId: categories[0].id,
      brand: 'Marca Propia',
      size: 'M',
      color: 'Negro',
      salePrice: 35000,
      costPrice: 18000,
      taxRate: 0.19,
      minStock: 10,
      currentStock: 45,
    },
    {
      sku: 'CAM-003',
      barcode: '7501234567892',
      name: 'Polo Premium Azul',
      description: 'Polo con cuello, tejido premium',
      categoryId: categories[0].id,
      brand: 'Premium Wear',
      size: 'L',
      color: 'Azul',
      salePrice: 75000,
      costPrice: 40000,
      taxRate: 0.19,
      minStock: 5,
      currentStock: 20,
    },
    // Pantalones
    {
      sku: 'PAN-001',
      barcode: '7501234567893',
      name: 'Jean Clásico Azul',
      description: 'Jean corte recto',
      categoryId: categories[1].id,
      brand: 'Denim Co',
      size: '32',
      color: 'Azul',
      salePrice: 89000,
      costPrice: 45000,
      taxRate: 0.19,
      minStock: 8,
      currentStock: 30,
    },
    {
      sku: 'PAN-002',
      barcode: '7501234567894',
      name: 'Pantalón Casual Beige',
      description: 'Pantalón casual de algodón',
      categoryId: categories[1].id,
      brand: 'Casual Style',
      size: '30',
      color: 'Beige',
      salePrice: 65000,
      costPrice: 32000,
      taxRate: 0.19,
      minStock: 5,
      currentStock: 15,
    },
    // Gorras
    {
      sku: 'GOR-001',
      barcode: '7501234567895',
      name: 'Gorra Baseball Negra',
      description: 'Gorra ajustable con visera curva',
      categoryId: categories[2].id,
      brand: 'Sport Cap',
      color: 'Negro',
      salePrice: 28000,
      costPrice: 12000,
      taxRate: 0.19,
      minStock: 15,
      currentStock: 40,
    },
    {
      sku: 'GOR-002',
      barcode: '7501234567896',
      name: 'Gorra Trucker Roja',
      description: 'Gorra estilo trucker con malla',
      categoryId: categories[2].id,
      brand: 'Urban Style',
      color: 'Rojo',
      salePrice: 32000,
      costPrice: 15000,
      taxRate: 0.19,
      minStock: 10,
      currentStock: 25,
    },
    // Gafas
    {
      sku: 'GAF-001',
      barcode: '7501234567897',
      name: 'Gafas de Sol Aviador',
      description: 'Gafas estilo aviador con protección UV',
      categoryId: categories[3].id,
      brand: 'SunVision',
      color: 'Dorado/Negro',
      salePrice: 55000,
      costPrice: 25000,
      taxRate: 0.19,
      minStock: 10,
      currentStock: 35,
    },
    {
      sku: 'GAF-002',
      barcode: '7501234567898',
      name: 'Gafas de Sol Wayfarer',
      description: 'Gafas clásicas estilo wayfarer',
      categoryId: categories[3].id,
      brand: 'SunVision',
      color: 'Negro Mate',
      salePrice: 48000,
      costPrice: 22000,
      taxRate: 0.19,
      minStock: 10,
      currentStock: 28,
    },
    // Accesorios
    {
      sku: 'ACC-001',
      barcode: '7501234567899',
      name: 'Cinturón de Cuero Negro',
      description: 'Cinturón de cuero genuino',
      categoryId: categories[4].id,
      brand: 'Leather Pro',
      size: 'M',
      color: 'Negro',
      salePrice: 42000,
      costPrice: 20000,
      taxRate: 0.19,
      minStock: 8,
      currentStock: 22,
    },
    {
      sku: 'ACC-002',
      barcode: '7501234567800',
      name: 'Billetera Cuero Café',
      description: 'Billetera de cuero con múltiples compartimentos',
      categoryId: categories[4].id,
      brand: 'Leather Pro',
      color: 'Café',
      salePrice: 58000,
      costPrice: 28000,
      taxRate: 0.19,
      minStock: 5,
      currentStock: 18,
    },
    // Producto con bajo stock para pruebas
    {
      sku: 'CAM-004',
      barcode: '7501234567801',
      name: 'Camiseta Edición Especial',
      description: 'Camiseta de edición limitada',
      categoryId: categories[0].id,
      brand: 'Exclusive',
      size: 'S',
      color: 'Multicolor',
      salePrice: 95000,
      costPrice: 50000,
      taxRate: 0.19,
      minStock: 5,
      currentStock: 3, // Bajo stock
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }
  console.log(`✅ ${products.length} productos creados`);

  // Crear movimientos de inventario iniciales
  const allProducts = await prisma.product.findMany();
  for (const product of allProducts) {
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        userId: admin.id,
        type: 'ENTRY',
        quantity: product.currentStock,
        previousStock: 0,
        newStock: product.currentStock,
        unitCost: product.costPrice,
        reason: 'Stock inicial de apertura',
      },
    });
  }
  console.log('✅ Movimientos de inventario iniciales creados');

  // Registrar en auditoría
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SEED',
      entity: 'system',
      description: 'Base de datos inicializada con datos de ejemplo',
    },
  });

  console.log('');
  console.log('🎉 Seed completado exitosamente!');
  console.log('');
  console.log('📋 Credenciales de acceso:');
  console.log('   Administrador: admin@tienda.com / Admin123!');
  console.log('   Vendedor: vendedor@tienda.com / Vendedor123!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
