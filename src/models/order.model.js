'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.Table,   { foreignKey: 'iMesaId',    as: 'mesa'    });
      Order.belongsTo(models.User,    { foreignKey: 'iUsuarioId', as: 'usuario' });
      Order.hasMany(models.OrderItem, { foreignKey: 'iOrdenId',   as: 'items'   });
    }
  }

  Order.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      iMesaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'tables', key: 'id' },
      },
      iUsuarioId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      sEstado: {
        type: DataTypes.ENUM('pendiente', 'en_preparacion', 'listo', 'entregado', 'pagado', 'cancelado'),
        defaultValue: 'pendiente',
        allowNull: false,
      },
      dTotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      sNotas: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // NUEVOS CAMPOS PARA CAJERO
      bPagado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      dFechaPago: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      sMetodoPago: {
        type: DataTypes.ENUM('efectivo', 'tarjeta', 'transferencia'),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
      timestamps: true,
    }
  );

  return Order;
};