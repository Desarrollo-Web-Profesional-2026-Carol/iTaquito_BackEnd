require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, Table, User } = require('../models');

const tables = [
  { sNombre: 'Mesa 1',    iCapacidad: 2, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa cerca de la ventana' },
  { sNombre: 'Mesa 2',    iCapacidad: 4, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa familiar' },
  { sNombre: 'Mesa 3',    iCapacidad: 4, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa central' },
  { sNombre: 'Mesa 4',    iCapacidad: 6, sUbicacion: 'interior', sEstado: 'disponible', sDescripcion: 'Mesa para grupos' },
  { sNombre: 'Terraza 1', iCapacidad: 2, sUbicacion: 'terraza',  sEstado: 'disponible', sDescripcion: 'Mesa con vista' },
  { sNombre: 'Terraza 2', iCapacidad: 4, sUbicacion: 'terraza',  sEstado: 'disponible', sDescripcion: 'Mesa en terraza' },
  { sNombre: 'VIP',       iCapacidad: 8, sUbicacion: 'vip',      sEstado: 'disponible', sDescripcion: 'Área VIP' },
  { sNombre: 'Barra',     iCapacidad: 2, sUbicacion: 'exterior', sEstado: 'disponible', sDescripcion: 'Asientos en barra' },
];

async function seedTables() {
  try {
    await sequelize.authenticate();
    console.log(' Conectado a la base de datos.');

    // Sincronizar modelos
    await Table.sync({ alter: true });
    await User.sync({ alter: true });
    console.log(' Tablas sincronizadas.');

    const passwordHash = await bcrypt.hash('mesa1234', 10);

    console.log('\n Creando mesas y usuarios...\n');

    for (const tableData of tables) {
      // 1. Crear o encontrar la mesa
      const [table, tableCreated] = await Table.findOrCreate({
        where:    { sNombre: tableData.sNombre },
        defaults: tableData,
      });
      console.log(`${tableCreated ? ' Creada' : '  Existe'}: ${table.sNombre} (id: ${table.id})`);

      // 2. Crear o encontrar el usuario de esa mesa
      const email = `mesa${table.id}@itaquito.com`;
      const [user, userCreated] = await User.findOrCreate({
        where: { email },
        defaults: {
          nombre:   `${table.sNombre}`,
          email,
          password: passwordHash,
          rol:      'cliente',
          iMesaId:  table.id,
        },
      });

      // Si el usuario ya existe pero no tiene iMesaId asignado, actualizarlo
      if (!userCreated && !user.iMesaId) {
        await user.update({ iMesaId: table.id });
        console.log(`    Usuario ${email} actualizado con iMesaId: ${table.id}`);
      } else {
        console.log(`    Usuario ${userCreated ? 'creado' : 'existe'}: ${email}`);
      }
    }

    console.log('\n Seed completado exitosamente.');
    console.log(' Contraseña de todos los dispositivos: mesa1234');
    console.log(' Formato de email: mesa{id}@itaquito.com\n');

    process.exit(0);
  } catch (error) {
    console.error(' Error en seed:', error);
    process.exit(1);
  }
}

seedTables();