'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Un cliente pertenece a una mesa
      User.belongsTo(models.Table, { foreignKey: 'iMesaId', as: 'mesa' });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nombre: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      rol: {
        type: DataTypes.ENUM('admin', 'cliente', 'mesero', 'caja'),
        defaultValue: 'cliente',
      },
      iMesaId: {
        type: DataTypes.INTEGER,
        allowNull: true,    // null para admin, mesero y caja
        references: { model: 'tables', key: 'id' },
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
    }
  );

  return User;
};