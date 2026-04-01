'use strict';

const { Op } = require('sequelize');
const { Order, OrderItem, Product, Table, User } = require('../models');

/* ─── INCLUDE BASE ───────────────────────────────────────────── */
const ORDER_INCLUDE = [
  {
    model: OrderItem,
    as: 'items',
    include: [
      {
        model: Product,
        as: 'producto',
        attributes: ['id', 'sNombre', 'sImagenUrl', 'dPrecio', 'bDisponible'],
      },
    ],
  },
  {
    model: Table,
    as: 'mesa',
    attributes: ['id', 'sNombre', 'iCapacidad', 'sUbicacion', 'sEstado', 'sDescripcion'],
  },
  {
    model: User,
    as: 'usuario',
    attributes: ['id', 'nombre', 'email', 'rol'],
  },
];

const calcTotal = (items) =>
  items.reduce((sum, item) => sum + parseFloat(item.dPrecioUnitario) * item.iCantidad, 0);

/* ══════════════════════════════════════════════════════════════
   GET /orders
   - Cliente: solo ve pedidos de su mesa DESDE su loginAt
             (aísla la sesión actual sin tabla de sesiones)
   - Staff:   puede filtrar por iMesaId, sEstado, fecha
══════════════════════════════════════════════════════════════ */
const getAll = async (req, res) => {
  try {
    const { sEstado, iMesaId, fecha } = req.query;
    const where = {};

    if (sEstado) where.sEstado = sEstado;
    if (fecha) {
      const inicio = new Date(fecha);
      const fin    = new Date(fecha);
      fin.setDate(fin.getDate() + 1);
      where.createdAt = { [Op.gte]: inicio, [Op.lt]: fin };
    }

    if (req.user.rol === 'cliente') {
      // Forzar mesa del token — el cliente no puede ver otras mesas
      where.iMesaId    = req.user.iMesaId;
      where.iUsuarioId = req.user.id;

      // FIX SESIÓN: filtrar solo pedidos creados desde el inicio de esta sesión.
      // loginAt viene en el JWT y se regenera en cada login, así pedidos
      // de sesiones anteriores del mismo usuario/mesa quedan excluidos.
      if (req.user.loginAt) {
        const desde = new Date(req.user.loginAt);
        where.createdAt = { [Op.gte]: desde };
      }
    } else if (iMesaId) {
      where.iMesaId = iMesaId;
    }

    const orders = await Order.findAll({
      where,
      include: ORDER_INCLUDE,
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Error en getAll orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener pedidos.',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /orders/:id
══════════════════════════════════════════════════════════════ */
const getById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: ORDER_INCLUDE });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
    }

    // Cliente solo puede ver pedidos de su mesa
    if (req.user.rol === 'cliente' && order.iMesaId !== req.user.iMesaId) {
      return res.status(403).json({ success: false, message: 'Sin acceso a este pedido.' });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error en getById order:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener pedido.',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /orders
══════════════════════════════════════════════════════════════ */
const create = async (req, res) => {
  try {
    const { iMesaId, items, sNotas } = req.body;
    const iUsuarioId = req.user?.id || null;

    if (!iMesaId) {
      return res.status(400).json({ success: false, message: 'iMesaId es requerido.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'El pedido debe tener al menos un producto.' });
    }

    const mesa = await Table.findByPk(iMesaId);
    if (!mesa) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada.' });
    }
    if (!mesa.bActivo) {
      return res.status(400).json({ success: false, message: 'La mesa no está activa.' });
    }

    for (const item of items) {
      if (!item.iProductoId) {
        return res.status(400).json({ success: false, message: 'Cada item debe tener iProductoId.' });
      }
      if (!item.iCantidad || item.iCantidad < 1) {
        return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0.' });
      }
    }

    const productoIds = items.map(i => i.iProductoId);
    const productos   = await Product.findAll({
      where: { id: productoIds, bActivo: true, bDisponible: true },
    });

    if (productos.length !== productoIds.length) {
      const encontrados = productos.map(p => p.id);
      const faltantes   = productoIds.filter(id => !encontrados.includes(id));
      return res.status(400).json({
        success: false,
        message: `Los siguientes productos no están disponibles: ${faltantes.join(', ')}`,
      });
    }

    const precioMap = Object.fromEntries(productos.map(p => [p.id, parseFloat(p.dPrecio)]));

    const itemsData = items.map(item => ({
      iProductoId:     item.iProductoId,
      iCantidad:       item.iCantidad,
      dPrecioUnitario: precioMap[item.iProductoId],
      dSubtotal:       precioMap[item.iProductoId] * item.iCantidad,
      sNotas:          item.sNotas || null,
    }));

    const dTotal = calcTotal(itemsData);

    const order = await Order.create({
      iMesaId, iUsuarioId,
      sNotas:  sNotas || null,
      dTotal,
      sEstado: 'pendiente',
    });

    await OrderItem.bulkCreate(itemsData.map(i => ({ ...i, iOrdenId: order.id })));

    const fullOrder = await Order.findByPk(order.id, { include: ORDER_INCLUDE });

    return res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente.',
      data: fullOrder,
    });
  } catch (error) {
    console.error('Error en create order:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear pedido.',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   PATCH /orders/:id/status
══════════════════════════════════════════════════════════════ */
const changeStatus = async (req, res) => {
  const VALID_STATES = ['pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado'];
  const STATE_FLOW   = {
    pendiente:      ['en_preparacion', 'cancelado'],
    en_preparacion: ['listo',          'cancelado'],
    listo:          ['entregado'],
    entregado:      [],
    cancelado:      [],
  };

  try {
    const { sEstado } = req.body;

    if (!sEstado) {
      return res.status(400).json({ success: false, message: 'El estado es requerido.' });
    }
    if (!VALID_STATES.includes(sEstado)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Debe ser uno de: ${VALID_STATES.join(', ')}`,
      });
    }

    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
    }

    const allowedNext = STATE_FLOW[order.sEstado];
    if (!allowedNext.includes(sEstado)) {
      return res.status(400).json({
        success: false,
        message: `No se puede cambiar de "${order.sEstado}" a "${sEstado}". Permitidos: ${allowedNext.join(', ') || 'ninguno'}`,
      });
    }

    await order.update({ sEstado });
    const updated = await Order.findByPk(order.id, { include: ORDER_INCLUDE });

    return res.json({
      success: true,
      message: `Pedido actualizado a "${sEstado}".`,
      data: updated,
    });
  } catch (error) {
    console.error('Error en changeStatus order:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del pedido.',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   DELETE /orders/:id — cancelación lógica
══════════════════════════════════════════════════════════════ */
const cancel = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
    }
    if (order.sEstado === 'entregado') {
      return res.status(400).json({ success: false, message: 'No se puede cancelar un pedido ya entregado.' });
    }
    if (order.sEstado === 'cancelado') {
      return res.status(400).json({ success: false, message: 'El pedido ya está cancelado.' });
    }

    await order.update({ sEstado: 'cancelado' });
    const cancelled = await Order.findByPk(order.id, { include: ORDER_INCLUDE });

    return res.json({
      success: true,
      message: 'Pedido cancelado correctamente.',
      data: cancelled,
    });
  } catch (error) {
    console.error('Error en cancel order:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cancelar pedido.',
      error: error.message,
    });
  }
};

module.exports = { getAll, getById, create, changeStatus, cancel };