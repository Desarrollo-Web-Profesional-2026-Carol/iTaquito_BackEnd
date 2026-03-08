require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { sequelize, Table } = require('../models');

const tables = [
  { sNombre: 'Mesa 1', iCapacidad: 2, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa cerca de la ventana' },
  { sNombre: 'Mesa 2', iCapacidad: 4, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa familiar' },
  { sNombre: 'Mesa 3', iCapacidad: 4, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa central' },
  { sNombre: 'Mesa 4', iCapacidad: 6, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa para grupos' },
  { sNombre: 'Terraza 1', iCapacidad: 2, sUbicacion: 'terraza', sEstado: 'disponible', sDescripcion: 'Mesa con vista' },
  { sNombre: 'Terraza 2', iCapacidad: 4, sUbicacion: 'terraza', sEstado: 'disponible', sDescripcion: 'Mesa en terraza' },
  { sNombre: 'VIP', iCapacidad: 8, sUbicacion: 'vip', sEstado: 'disponible', sDescripcion: 'Área VIP' },
  { sNombre: 'Barra', iCapacidad: 2, sUbicacion: 'exterior', sEstado: 'disponible', sDescripcion: 'Asientos en barra' }
];

async function seedTables() {
  try {
    await sequelize.authenticate();
    console.log(' Conectado a la base de datos.');

    // Sincronizar el modelo Table (crea la tabla si no existe)
    await Table.sync({ alter: true });
    console.log(' Tabla "tables" sincronizada/creada');

    
    for (const tableData of tables) {
      const [table, created] = await Table.findOrCreate({
        where: { sNombre: tableData.sNombre },
        defaults: tableData
      });

      console.log(`${created ? ' Creada' : ' Ya existe'}: ${table.sNombre}`);
    }

    console.log('Seed de mesas completado exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error(' Error en seed de mesas:', error);
    process.exit(1);
  }
}

seedTables();