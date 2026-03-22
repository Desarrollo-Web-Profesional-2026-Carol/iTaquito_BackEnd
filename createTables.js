require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTables() {
  console.log('🔌 Conectando a la base de datos...');

  try {
    const connection = await mysql.createConnection({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false },
    });

    console.log('✅ Conectado a Railway MySQL\n');

    /* ══════════════════════════════════════════════════════════
       ALTER users — agregar iMesaId y ampliar ENUM de rol
    ══════════════════════════════════════════════════════════ */

    // 1. Ampliar ENUM rol para incluir mesero y caja
    const [rolColumns] = await connection.execute(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'users'
        AND COLUMN_NAME  = 'rol'
    `);

    const rolType = rolColumns[0]?.COLUMN_TYPE || '';
    if (!rolType.includes('mesero')) {
      console.log('📝 Actualizando ENUM rol en users...');
      await connection.execute(`
        ALTER TABLE users
          MODIFY COLUMN rol ENUM('admin','cliente','mesero','caja') NOT NULL DEFAULT 'cliente'
      `);
      console.log('✅ ENUM rol actualizado (admin, cliente, mesero, caja)');
    } else {
      console.log('✅ ENUM rol ya está actualizado');
    }

    // 2. Agregar columna iMesaId si no existe
    const [mesaCol] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'users'
        AND COLUMN_NAME  = 'iMesaId'
    `);

    if (mesaCol.length === 0) {
      console.log('📝 Agregando columna iMesaId a users...');
      await connection.execute(`
        ALTER TABLE users
          ADD COLUMN iMesaId INT NULL,
          ADD CONSTRAINT fk_users_mesa
            FOREIGN KEY (iMesaId) REFERENCES tables(id)
            ON DELETE SET NULL ON UPDATE CASCADE
      `);
      console.log('✅ Columna iMesaId agregada a users');
    } else {
      console.log('✅ Columna iMesaId ya existe en users');
    }

    /* ══════════════════════════════════════════════════════════
       CREATE orders
    ══════════════════════════════════════════════════════════ */
    const [ordersExists] = await connection.execute(`SHOW TABLES LIKE 'orders'`);

    if (ordersExists.length === 0) {
      console.log('\n📝 Creando tabla orders...');
      await connection.execute(`
        CREATE TABLE orders (
          id          INT PRIMARY KEY AUTO_INCREMENT,
          iMesaId     INT NOT NULL,
          iUsuarioId  INT NULL,
          sEstado     ENUM('pendiente','en_preparacion','listo','entregado','cancelado') DEFAULT 'pendiente',
          dTotal      DECIMAL(10,2) NOT NULL DEFAULT 0,
          sNotas      TEXT NULL,
          createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (iMesaId)    REFERENCES tables(id) ON DELETE RESTRICT  ON UPDATE CASCADE,
          FOREIGN KEY (iUsuarioId) REFERENCES users(id)  ON DELETE SET NULL  ON UPDATE CASCADE
        )
      `);
      console.log('✅ Tabla orders creada');
    } else {
      console.log('\n✅ Tabla orders ya existe');
    }

    /* ══════════════════════════════════════════════════════════
       CREATE order_items
    ══════════════════════════════════════════════════════════ */
    const [itemsExists] = await connection.execute(`SHOW TABLES LIKE 'order_items'`);

    if (itemsExists.length === 0) {
      console.log('📝 Creando tabla order_items...');
      await connection.execute(`
        CREATE TABLE order_items (
          id               INT PRIMARY KEY AUTO_INCREMENT,
          iOrdenId         INT NOT NULL,
          iProductoId      INT NOT NULL,
          dPrecioUnitario  DECIMAL(10,2) NOT NULL,
          iCantidad        INT NOT NULL DEFAULT 1,
          dSubtotal        DECIMAL(10,2) NOT NULL,
          sNotas           TEXT NULL,
          createdAt        DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (iOrdenId)    REFERENCES orders(id)   ON DELETE CASCADE  ON UPDATE CASCADE,
          FOREIGN KEY (iProductoId) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          UNIQUE KEY unique_order_product (iOrdenId, iProductoId)
        )
      `);
      console.log('✅ Tabla order_items creada');
    } else {
      console.log('✅ Tabla order_items ya existe');
    }

    /* ══════════════════════════════════════════════════════════
       RESUMEN
    ══════════════════════════════════════════════════════════ */
    const [allTables] = await connection.execute('SHOW TABLES');
    console.log('\n📋 Tablas en la base de datos:');
    allTables.forEach(row => console.log(`  - ${Object.values(row)[0]}`));

    console.log('\n🔍 Estructura de users (columnas clave):');
    const [usersStructure] = await connection.execute('DESCRIBE users');
    console.table(usersStructure.filter(c => ['rol','iMesaId'].includes(c.Field)));

    console.log('\n🔍 Estructura de orders:');
    const [orderStructure] = await connection.execute('DESCRIBE orders');
    console.table(orderStructure);

    console.log('\n🔍 Estructura de order_items:');
    const [itemsStructure] = await connection.execute('DESCRIBE order_items');
    console.table(itemsStructure);

    await connection.end();
    console.log('\n🎉 Configuración completada exitosamente!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      console.error('⚠️  Asegúrate de que las tablas "tables" y "users" existan primero');
    }
    process.exit(1);
  }
}

createTables();