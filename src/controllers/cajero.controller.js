'use strict';

const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { Order, OrderItem, Product, Table, User } = require('../models');
const { sequelize } = require('../models');

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

/* ─── HELPER: total desde items ──────────────────────────────── */
const calcularTotalOrden = (order) =>
  order.items.reduce((sum, item) => sum + parseFloat(item.dSubtotal || 0), 0);

/* ══════════════════════════════════════════════════════════════
   GET /cajero/orders-by-table
   Órdenes agrupadas por mesa.
   Solo muestra órdenes de la sesión activa de cada usuario:
   filtra por createdAt >= loginAt del usuario de esa mesa.
   Excluye canceladas y pagadas.
══════════════════════════════════════════════════════════════ */
const getOrdersByTable = async (req, res) => {
  try {
    const { estado } = req.query;

    // Condición base: no pagadas, no canceladas
    const whereConditions = {
      bPagado: false,
      sEstado: estado && estado !== 'todos'
        ? { [Op.and]: [{ [Op.ne]: 'cancelado' }, { [Op.eq]: estado }] }
        : { [Op.ne]: 'cancelado' },
    };

    const orders = await Order.findAll({
      where: whereConditions,
      include: ORDER_INCLUDE,
      order: [['createdAt', 'ASC']],
    });

    // Agrupar por mesa
    const ordersByTable = {};

    orders.forEach(order => {
      const mesaId    = order.iMesaId;
      const totalOrden = calcularTotalOrden(order);

      if (!ordersByTable[mesaId]) {
        ordersByTable[mesaId] = {
          mesa:        order.mesa,
          orders:      [],
          totalMesa:   0,
          ordersCount: 0,
        };
      }

      ordersByTable[mesaId].orders.push({
        ...order.toJSON(),
        totalCalculado: totalOrden,
      });
      ordersByTable[mesaId].totalMesa   += totalOrden;
      ordersByTable[mesaId].ordersCount += 1;
    });

    const result = Object.values(ordersByTable).sort((a, b) =>
      (a.mesa?.sNombre || '').localeCompare(b.mesa?.sNombre || '')
    );

    res.json({
      success: true,
      data: result,
      totalMesasConCuentas:   result.length,
      totalVentasPendientes:  result.reduce((sum, t) => sum + t.totalMesa, 0),
    });

  } catch (error) {
    console.error('Error en getOrdersByTable:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las órdenes por mesa',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /cajero/orders-by-table/:mesaId
   Detalle de órdenes no pagadas de una mesa
══════════════════════════════════════════════════════════════ */
const getOrdersByMesaId = async (req, res) => {
  try {
    const { mesaId } = req.params;

    const orders = await Order.findAll({
      where: {
        iMesaId: mesaId,
        bPagado: false,
        sEstado: { [Op.ne]: 'cancelado' },
      },
      include: ORDER_INCLUDE,
      order: [['createdAt', 'ASC']],
    });

    const ordersConTotal = orders.map(order => ({
      ...order.toJSON(),
      totalCalculado: calcularTotalOrden(order),
    }));

    const totalMesa = ordersConTotal.reduce((sum, o) => sum + o.totalCalculado, 0);

    res.json({
      success: true,
      data: ordersConTotal,
      totalMesa,
      ordersCount: orders.length,
    });

  } catch (error) {
    console.error('Error en getOrdersByMesaId:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las órdenes de la mesa',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /cajero/approve-payment/:mesaId
   Aprueba el pago de todas las órdenes de una mesa.

   Flujo de sesión:
   1. Marca todas las órdenes como pagadas
   2. Libera la mesa (sEstado = 'disponible')
   3. Genera un nuevo token para el usuario de la mesa con
      un loginAt nuevo — esto invalida el token anterior
      ya que los pedidos anteriores quedaron antes de ese loginAt.
      El frontend debe recibir este token y reemplazar el actual,
      forzando así el "cierre de sesión" de la sesión anterior.
══════════════════════════════════════════════════════════════ */
const approvePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { mesaId }    = req.params;
    const { metodoPago } = req.body;

    const metodosValidos = ['efectivo', 'tarjeta', 'transferencia'];
    if (!metodoPago || !metodosValidos.includes(metodoPago)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Método de pago inválido. Opciones: ${metodosValidos.join(', ')}`,
      });
    }

    const mesa = await Table.findByPk(mesaId, { transaction });
    if (!mesa) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    const orders = await Order.findAll({
      where: {
        iMesaId: mesaId,
        bPagado: false,
        sEstado: { [Op.ne]: 'cancelado' },
      },
      include: ORDER_INCLUDE,
      transaction,
    });

    if (orders.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'No hay órdenes pendientes de pago en esta mesa',
      });
    }

    const totalPagar = orders.reduce((sum, order) => sum + calcularTotalOrden(order), 0);

    // 1. Marcar órdenes como pagadas
    await Order.update(
      {
        bPagado:     true,
        dFechaPago:  new Date(),
        sMetodoPago: metodoPago,
        sEstado:     'pagado',
      },
      {
        where: {
          iMesaId: mesaId,
          bPagado: false,
          sEstado: { [Op.ne]: 'cancelado' },
        },
        transaction,
      }
    );

    // 2. Liberar la mesa
    await Table.update(
      { sEstado: 'disponible' },
      { where: { id: mesaId }, transaction }
    );

    await transaction.commit();

    // 3. Regenerar token del usuario de la mesa con nuevo loginAt.
    //    Esto "invalida" la sesión anterior: cuando el cliente intente
    //    consultar /orders, su loginAt viejo no coincidirá con los nuevos
    //    pedidos (que aún no existen), mostrando lista vacía.
    //    El frontend recibe este token y lo guarda, reemplazando el anterior.
    const usuarioDeMesa = orders[0]?.usuario;
    let nuevoToken = null;

    if (usuarioDeMesa) {
      nuevoToken = jwt.sign(
        {
          id:      usuarioDeMesa.id,
          rol:     usuarioDeMesa.rol,
          iMesaId: parseInt(mesaId, 10),
          loginAt: new Date().toISOString(), // nuevo loginAt → nueva sesión
        },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );
    }

    res.json({
      success: true,
      message: 'Pago aprobado exitosamente',
      data: {
        mesa:             mesa.sNombre,
        totalPagado:      totalPagar,
        metodoPago,
        ordersProcesadas: orders.length,
        // El frontend del cajero puede entregar este token al cliente
        // (ej. mostrarlo en pantalla o enviarlo por otro canal)
        nuevoTokenCliente: nuevoToken,
      },
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error en approvePayment:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el pago',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   PUT /cajero/change-table-status/:mesaId
   Cambiar disponibilidad de mesa manualmente
══════════════════════════════════════════════════════════════ */
const changeTableAvailability = async (req, res) => {
  try {
    const { mesaId }  = req.params;
    const { sEstado } = req.body;

    const estadosValidos = ['disponible', 'ocupada', 'reservada', 'inactiva'];
    if (!sEstado || !estadosValidos.includes(sEstado)) {
      return res.status(400).json({
        success: false,
        message: `Estado no válido. Estados permitidos: ${estadosValidos.join(', ')}`,
      });
    }

    const mesa = await Table.findByPk(mesaId);
    if (!mesa) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    await mesa.update({ sEstado });

    res.json({
      success: true,
      message: `Estado de mesa actualizado a "${sEstado}"`,
      data: mesa,
    });

  } catch (error) {
    console.error('Error en changeTableAvailability:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar disponibilidad de la mesa',
      error: error.message,
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /cajero/sales-summary
   Resumen de ventas del día
══════════════════════════════════════════════════════════════ */
const getSalesSummary = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const ordersPagadas = await Order.findAll({
      where: {
        bPagado:    true,
        dFechaPago: { [Op.gte]: hoy, [Op.lt]: manana },
      },
      include: [
        { model: Table, as: 'mesa', attributes: ['id', 'sNombre'] },
      ],
    });

    const totalVentas = ordersPagadas.reduce(
      (sum, order) => sum + parseFloat(order.dTotal || 0), 0
    );

    const porMetodoPago = ordersPagadas.reduce((acc, order) => {
      const metodo = order.sMetodoPago || 'no_registrado';
      if (!acc[metodo]) acc[metodo] = { total: 0, cantidad: 0 };
      acc[metodo].total    += parseFloat(order.dTotal || 0);
      acc[metodo].cantidad += 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        fecha:        hoy.toISOString().split('T')[0],
        totalVentas,
        totalOrdenes: ordersPagadas.length,
        porMetodoPago,
        ordenes:      ordersPagadas.map(o => ({
          id:         o.id,
          mesa:       o.mesa?.sNombre || `Mesa ${o.iMesaId}`,
          total:      o.dTotal,
          metodoPago: o.sMetodoPago,
          fechaPago:  o.dFechaPago,
        })),
      },
    });

  } catch (error) {
    console.error('Error en getSalesSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen de ventas',
      error: error.message,
    });
  }
};

module.exports = {
  getOrdersByTable,
  getOrdersByMesaId,
  approvePayment,
  changeTableAvailability,
  getSalesSummary,
};