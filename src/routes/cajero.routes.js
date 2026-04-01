'use strict';

const { Router } = require('express');
const { verifyToken, verifyCajero } = require('../middlewares/auth.middleware');
const {
  getOrdersByTable,
  getOrdersByMesaId,
  approvePayment,
  changeTableAvailability,
  getSalesSummary,
} = require('../controllers/cajero.controller');

const router = Router();

// Todas las rutas requieren token + rol cajero o admin
router.use(verifyToken, verifyCajero);

router.get('/orders-by-table',             getOrdersByTable);
router.get('/orders-by-table/:mesaId',     getOrdersByMesaId);
router.post('/approve-payment/:mesaId',    approvePayment);
router.put('/change-table-status/:mesaId', changeTableAvailability);
router.get('/sales-summary',               getSalesSummary);

module.exports = router;