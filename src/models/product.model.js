'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.Category, { foreignKey: 'iCategoriaId', as: 'categoria' });
    }
  }

  Product.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sNombre: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sDescripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      dPrecio: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      sImagenUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bDisponible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      bActivo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'false = eliminado lógicamente',
      },
      iCategoriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
      },
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'products',
      timestamps: true,
    }
  );

  return Product;
};
