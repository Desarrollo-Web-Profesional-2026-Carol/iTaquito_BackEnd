const { Router } = require('express');
const { getAllUsers, getMe } = require('../controllers/user.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/users/me - Usuario autenticado ve su perfil
router.get('/me', verifyToken, getMe);

// GET /api/users - Solo admin puede ver todos los usuarios
router.get('/', verifyToken, verifyAdmin, getAllUsers);

module.exports = router;
