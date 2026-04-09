'use strict';

const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { Order, OrderItem, Product, Table, User } = require('../../models');
const { sequelize } = require('../../models');

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
    attributes: ['id', 'nombre', 'email', 'rol', 'dUltimoLogin'],
  },
];

const calcularTotalOrden = (order) =>
  order.items.reduce((sum, item) => sum + parseFloat(item.dSubtotal || 0), 0);

/* ══════════════════════════════════════════════════════════════
   GET /cajero/orders-by-table
   Filtra pedidos por sesión activa de cada mesa:
   solo muestra órdenes creadas desde el dUltimoLogin
   del usuario asignado a esa mesa.
══════════════════════════════════════════════════════════════ */
const getOrdersByTable = async (req, res) => {
  try {
    const { estado } = req.query;

    // 1. Obtener todos los usuarios cliente con mesa asignada
    //    para saber el dUltimoLogin de cada uno
    const usuarios = await User.findAll({
      where: {
        rol:     'cliente',
        iMesaId: { [Op.ne]: null },
      },
      attributes: ['id', 'iMesaId', 'dUltimoLogin'],
    });

    // Mapa mesaId → dUltimoLogin
    const loginPorMesa = {};
    usuarios.forEach(u => {
      if (u.iMesaId) loginPorMesa[u.iMesaId] = u.dUltimoLogin;
    });

    // 2. Condición base de estado
    const whereBase = { bPagado: false };
    if (estado && estado !== 'todos') {
      whereBase.sEstado = estado;
    } else {
      whereBase.sEstado = { [Op.notIn]: ['cancelado', 'pagado'] };
    }

    const orders = await Order.findAll({
      where: whereBase,
      include: ORDER_INCLUDE,
      order: [['createdAt', 'ASC']],
    });

<<<<<<< HEAD:src/controllers/cajero.controller.js
    // 3. Agrupar por mesa y filtrar por sesión activa
    const ordersByTable = {};

    orders.forEach(order => {
      const mesaId      = order.iMesaId;
      const loginAt     = loginPorMesa[mesaId];
      const totalOrden  = calcularTotalOrden(order);

      // Si hay dUltimoLogin para esta mesa, ignorar pedidos anteriores a esa fecha
      if (loginAt && new Date(order.createdAt) < new Date(loginAt)) return;
=======
    const ordersBySession = {};

    orders.forEach(order => {
      const tokenSesion = order.sTokenSesion || `legacy-${order.iMesaId}`;
      const totalOrden = calcularTotalOrden(order);
>>>>>>> origin/main:src/modules/cajero/cajero.controller.js

      if (!ordersBySession[tokenSesion]) {
        ordersBySession[tokenSesion] = {
          mesa:        order.mesa,
          tokenSesion: tokenSesion,
          orders:      [],
          totalMesa:   0,
          ordersCount: 0,
          sessionStart: loginAt || null,
        };
      }

      ordersBySession[tokenSesion].orders.push({
        ...order.toJSON(),
        totalCalculado: totalOrden,
      });
      ordersBySession[tokenSesion].totalMesa   += totalOrden;
      ordersBySession[tokenSesion].ordersCount += 1;
    });

    const result = Object.values(ordersBySession).sort((a, b) =>
      (a.mesa?.sNombre || '').localeCompare(b.mesa?.sNombre || '')
    );

    res.json({
      success: true,
      data: result,
      totalMesasConCuentas:  result.length,
      totalVentasPendientes: result.reduce((sum, t) => sum + t.totalMesa, 0),
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
══════════════════════════════════════════════════════════════ */
const getOrdersByMesaId = async (req, res) => {
  try {
    const { mesaId } = req.params;

    // Obtener dUltimoLogin del usuario de esta mesa
    const usuario = await User.findOne({
      where: { iMesaId: mesaId, rol: 'cliente' },
      attributes: ['id', 'dUltimoLogin'],
    });

    const where = {
      iMesaId: mesaId,
      bPagado: false,
      sEstado: { [Op.notIn]: ['cancelado', 'pagado'] },
    };

    // Filtrar por sesión activa si existe dUltimoLogin
    if (usuario?.dUltimoLogin) {
      where.createdAt = { [Op.gte]: new Date(usuario.dUltimoLogin) };
    }

    const orders = await Order.findAll({
      where,
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
      sessionStart: usuario?.dUltimoLogin || null,
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
   Al aprobar: actualiza dUltimoLogin del usuario → nueva sesión
══════════════════════════════════════════════════════════════ */
const approvePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { mesaId }     = req.params;
    const { metodoPago, sTokenSesion } = req.body;

    const metodosValidos = ['efectivo', 'tarjeta', 'transferencia'];
    if (!metodoPago || !metodosValidos.includes(metodoPago)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Método de pago inválido. Opciones: ${metodosValidos.join(', ')}`,
      });
    }

    const orderWhere = {
      iMesaId: mesaId,
      bPagado: false,
      sEstado: { [Op.notIn]: ['cancelado', 'pagado'] },
    };
    if (sTokenSesion && !sTokenSesion.startsWith('legacy-')) {
      orderWhere.sTokenSesion = sTokenSesion;
    }

    const mesa = await Table.findByPk(mesaId, { transaction });
    if (!mesa) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    // Obtener usuario de la mesa para filtrar por sesión activa
    const usuarioDeMesa = await User.findOne({
      where: { iMesaId: mesaId, rol: 'cliente' },
      transaction,
    });

    const whereOrdenes = {
      iMesaId: mesaId,
      bPagado: false,
      sEstado: { [Op.notIn]: ['cancelado', 'pagado'] },
    };

    // Solo cobrar órdenes de la sesión activa
    if (usuarioDeMesa?.dUltimoLogin) {
      whereOrdenes.createdAt = { [Op.gte]: new Date(usuarioDeMesa.dUltimoLogin) };
    }

    const orders = await Order.findAll({
<<<<<<< HEAD:src/controllers/cajero.controller.js
      where: whereOrdenes,
=======
      where: orderWhere,
>>>>>>> origin/main:src/modules/cajero/cajero.controller.js
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

    const totalPagar = orders.reduce((sum, o) => sum + calcularTotalOrden(o), 0);

    // 1. Marcar órdenes como pagadas
    await Order.update(
<<<<<<< HEAD:src/controllers/cajero.controller.js
      { bPagado: true, dFechaPago: new Date(), sMetodoPago: metodoPago, sEstado: 'pagado' },
      { where: whereOrdenes, transaction }
=======
      {
        bPagado:     true,
        dFechaPago:  new Date(),
        sMetodoPago: metodoPago,
        sEstado:     'pagado',
      },
      {
        where: orderWhere,
        transaction,
      }
>>>>>>> origin/main:src/modules/cajero/cajero.controller.js
    );

    // 2. Liberar mesa
    await Table.update(
      { sEstado: 'disponible' },
      { where: { id: mesaId }, transaction }
    );

    // 3. Actualizar dUltimoLogin del usuario → inicia nueva sesión limpia
    const nuevaSesionAt = new Date();
    if (usuarioDeMesa) {
      await usuarioDeMesa.update({ dUltimoLogin: nuevaSesionAt }, { transaction });
    }

    await transaction.commit();

    // 4. Generar nuevo token con loginAt actualizado
    let nuevoToken = null;
    if (usuarioDeMesa) {
      nuevoToken = jwt.sign(
        {
          id:      usuarioDeMesa.id,
          rol:     usuarioDeMesa.rol,
          iMesaId: parseInt(mesaId, 10),
          loginAt: nuevaSesionAt.toISOString(),
        },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );
    }

    res.json({
      success: true,
      message: 'Pago aprobado exitosamente',
      data: {
        mesa:              mesa.sNombre,
        totalPagado:       totalPagar,
        metodoPago,
        ordersProcesadas:  orders.length,
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
══════════════════════════════════════════════════════════════ */
const changeTableAvailability = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { mesaId }  = req.params;
    const { sEstado } = req.body;

    const estadosValidos = ['disponible', 'ocupada', 'reservada', 'inactiva', 'en_pago'];
    if (!sEstado || !estadosValidos.includes(sEstado)) {
      return res.status(400).json({
        success: false,
        message: `Estado no válido. Estados permitidos: ${estadosValidos.join(', ')}`,
      });
    }

<<<<<<< HEAD:src/controllers/cajero.controller.js
    const mesa = await Table.findByPk(mesaId);
    if (!mesa) return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
=======
    const mesa = await Table.findByPk(mesaId, { transaction });
    if (!mesa) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }
>>>>>>> origin/main:src/modules/cajero/cajero.controller.js

    if (sEstado === 'disponible') {
      // Cancelar todos los pedidos huérfanos que no estén ya pagados o cancelados
      await Order.update(
        { sEstado: 'cancelado' },
        { 
          where: {
            iMesaId: mesaId,
            bPagado: false,
            sEstado: { [Op.notIn]: ['cancelado', 'pagado'] },
          },
          transaction
        }
      );
    }

    await mesa.update({ sEstado }, { transaction });
    await transaction.commit();

    res.json({ success: true, message: `Estado de mesa actualizado a "${sEstado}"`, data: mesa });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error en changeTableAvailability:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar disponibilidad', error: error.message });
  }
};

/* ══════════════════════════════════════════════════════════════
   GET /cajero/sales-summary
══════════════════════════════════════════════════════════════ */
const getSalesSummary = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const ordersPagadas = await Order.findAll({
      where: { bPagado: true, dFechaPago: { [Op.gte]: hoy, [Op.lt]: manana } },
      include: [{ model: Table, as: 'mesa', attributes: ['id', 'sNombre'] }],
    });

    const totalVentas = ordersPagadas.reduce((sum, o) => sum + parseFloat(o.dTotal || 0), 0);

    const porMetodoPago = ordersPagadas.reduce((acc, o) => {
      const metodo = o.sMetodoPago || 'no_registrado';
      if (!acc[metodo]) acc[metodo] = { total: 0, cantidad: 0 };
      acc[metodo].total    += parseFloat(o.dTotal || 0);
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
        ordenes: ordersPagadas.map(o => ({
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
    res.status(500).json({ success: false, message: 'Error al obtener resumen de ventas', error: error.message });
  }
};

module.exports = {
  getOrdersByTable,
  getOrdersByMesaId,
  approvePayment,
  changeTableAvailability,
  getSalesSummary,
};
