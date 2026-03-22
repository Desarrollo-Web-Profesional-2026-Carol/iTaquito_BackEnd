'use strict';

const { Router } = require('express');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');
const {
  getAll,
  getById,
  create,
  changeStatus,
  cancel,
} = require('../controllers/order.controller');

const router = Router();

// POST /api/orders — cliente crea su pedido
router.post('/', verifyToken, create);

// GET /api/orders — cliente ve sus pedidos (filtrado por mesa), staff ve todos
router.get('/', verifyToken, getAll);

// GET /api/orders/:id
router.get('/:id', verifyToken, getById);

// PATCH /api/orders/:id/status — staff
router.patch('/:id/status', verifyToken, verifyAdmin, changeStatus);

// DELETE /api/orders/:id — staff
router.delete('/:id', verifyToken, verifyAdmin, cancel);

module.exports = router;