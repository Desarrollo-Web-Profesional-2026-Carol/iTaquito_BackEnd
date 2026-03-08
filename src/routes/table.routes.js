const { Router } = require('express');
const {
  getAll,
  getById,
  create,
  update,
  remove,
  changeStatus,
} = require('../controllers/table.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');

const router = Router();

// Rutas públicas (accesibles con token de empleado)
router.get('/', verifyToken, getAll);
router.get('/:id', verifyToken, getById);

// Rutas protegidas (solo admin)
router.post('/', verifyToken, verifyAdmin, create);
router.put('/:id', verifyToken, verifyAdmin, update);
router.delete('/:id', verifyToken, verifyAdmin, remove);
router.patch('/:id/estado', verifyToken, verifyAdmin, changeStatus);

module.exports = router;