require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

const users = [
  {
    nombre: 'Administrador',
    email: 'admin@itaquito.com',
    password: 'admin123',
    rol: 'admin'  
  },
  {
    nombre: 'Cliente Ejemplo',
    email: 'cliente@itaquito.com',
    password: 'cliente123',
    rol: 'cliente'  
  },
  {
    nombre: 'Juan Pérez',
    email: 'juan@example.com',
    password: 'juan123',
    rol: 'cliente'
  },
  {
    nombre: 'María García',
    email: 'maria@example.com',
    password: 'maria123',
    rol: 'cliente'
  }
];

async function seedUsers() {
  try {
    await sequelize.authenticate();
    console.log('Conectado a la base de datos.');

    // Sincronizar el modelo User (crea la tabla si no existe)
    await User.sync({ alter: true });
    console.log('Tabla "users" sincronizada/creada');

    console.log(' Sembrando usuarios...');
    
    for (const userData of users) {
      // Hashear la contraseña
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },  // Buscar por email
        defaults: {
          nombre: userData.nombre,
          email: userData.email,
          password: hashedPassword,
          rol: userData.rol
        }
      });

      console.log(`${created ? ' Creado' : ' Ya existe'}: ${user.email} (${user.rol})`);
    }

    console.log('Seed de usuarios completado exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error(' Error en seed de usuarios:', error);
    process.exit(1);
  }
}

seedUsers();