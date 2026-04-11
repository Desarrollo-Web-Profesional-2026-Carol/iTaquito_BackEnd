'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Table extends Model {
    static associate(models) {
      Table.hasMany(models.User, { foreignKey: 'iMesaId', as: 'usuarios' });
    }
  }

  Table.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
     sNombre: {
  type: DataTypes.STRING,
  allowNull: false,
  validate: { notEmpty: true },
},
      iCapacidad: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 20 },
      },
      sUbicacion: {
        type: DataTypes.ENUM('interior', 'exterior', 'terraza', 'vip'),
        allowNull: false,
        defaultValue: 'interior',
      },
      sEstado: {
        type: DataTypes.ENUM('disponible', 'ocupada', 'reservada', 'inactiva', 'en_pago'),
        allowNull: false,
        defaultValue: 'disponible',
      },
      sDescripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      bActivo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'false = eliminado lógicamente',
      },
    },
    {
      sequelize,
      modelName: 'Table',
      tableName: 'tables',
      timestamps: true,
    }
  );

  return Table;
};