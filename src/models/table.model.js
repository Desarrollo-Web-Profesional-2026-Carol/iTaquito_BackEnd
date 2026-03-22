'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Table extends Model {
    static associate(models) {
      // Una mesa puede tener un usuario (dispositivo cliente) asignado
      Table.hasOne(models.User, { foreignKey: 'iMesaId', as: 'usuario' });
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
        unique: true,
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
        type: DataTypes.ENUM('disponible', 'ocupada', 'reservada', 'inactiva'),
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