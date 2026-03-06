require('dotenv').config();
const { sequelize, Category } = require('../models');

const categories = [
  { sNombre: 'Tacos',        sDescripcion: 'Los clásicos tacos de la taquería' },
  { sNombre: 'Quesadillas',  sDescripcion: 'Quesadillas con diferentes ingredientes' },
  { sNombre: 'Especialidades', sDescripcion: 'Platillos especiales de la casa' },
  { sNombre: 'Bebidas',      sDescripcion: 'Refrescos, aguas y más' },
  { sNombre: 'Postres',      sDescripcion: 'Dulces y postres para el final' },
  { sNombre: 'Burritos',     sDescripcion: 'Burritos con variedad de rellenos' },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Conectado a la base de datos.');

    await sequelize.sync({ alter: true });
    console.log('Tablas sincronizadas.');

    for (const cat of categories) {
      const [instance, created] = await Category.findOrCreate({
        where: { sNombre: cat.sNombre },
        defaults: cat,
      });
      console.log(`${created ? 'Creada' : 'Ya existe'}: ${instance.sNombre}`);
    }

    console.log('Seed completado exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error en seed:', error);
    process.exit(1);
  }
}

seed();
