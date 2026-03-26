const { Router } = require('express');
const { getAllUsers, getMe, getMesasDisponibles, createUser, updateUser, deleteUser } = require('../controllers/user.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/users/me - Usuario autenticado ve su perfil
router.get('/me', verifyToken, getMe);

// GET /api/users/mesas-disponibles - Solo admin
router.get('/mesas-disponibles', verifyToken, verifyAdmin, getMesasDisponibles);

// GET /api/users - Solo admin puede ver todos los usuarios
router.get('/', verifyToken, verifyAdmin, getAllUsers);

// CRUD de Usuarios - Solo admin
router.post('/', verifyToken, verifyAdmin, createUser);
router.put('/:id', verifyToken, verifyAdmin, updateUser);
router.delete('/:id', verifyToken, verifyAdmin, deleteUser);

module.exports = router;
