'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      OrderItem.belongsTo(models.Order,   { foreignKey: 'iOrdenId',    as: 'orden'    });
      OrderItem.belongsTo(models.Product, { foreignKey: 'iProductoId', as: 'producto' });
    }
  }

  OrderItem.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      iOrdenId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
      },
      iProductoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'products', key: 'id' },
      },
      // Snapshot del precio al momento de ordenar
      // (evita que cambios futuros de precio afecten órdenes pasadas)
      dPrecioUnitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      iCantidad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: { min: 1 },
      },
      dSubtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      sNotas: {
        type: DataTypes.TEXT,
        allowNull: true,          // notas por producto ("sin cebolla", etc.)
      },
    },
    {
      sequelize,
      modelName: 'OrderItem',
      tableName: 'order_items',
      timestamps: true,
    }
  );

  return OrderItem;
};