const express = require('express');
const cors = require('cors');

const app = express();

// Configuración CORS mejorada
const corsOptions = {
  origin: function(origin, callback) {
    // Permitir solicitudes sin origen (como Postman, apps móviles)
    if (!origin) return callback(null, true);
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:5173',      // Desarrollo Vite
      'http://localhost:3000',      // Desarrollo local
      'https://itaquito.netlify.app' // Producción Netlify
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200
};

// Aplicar CORS a todas las rutas
app.use(cors(corsOptions));

// NO necesitas esta línea - CORREGIDO: ELIMINAR o comentar
// app.options('*', cors(corsOptions));  // ← ELIMINA ESTA LÍNEA

// Middlewares globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const productRoutes = require('./modules/products/products.routes');
const categoryRoutes = require('./modules/categories/categories.routes');
const tableRoutes = require('./modules/tables/tables.routes'); 
const orderRoutes = require('./modules/orders/orders.routes');
const cajeroRoutes = require('./modules/cajero/cajero.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cajero', cajeroRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'iTaquito API corriendo correctamente' });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

module.exports = app;