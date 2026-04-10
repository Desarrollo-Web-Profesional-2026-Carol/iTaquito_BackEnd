'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Una cuenta de rol "mesa" pertenece a un registro de mesa física
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
        type: DataTypes.ENUM('admin', 'mesa', 'mesero', 'cajero', 'taquero'),
        defaultValue: 'mesa',
      },
      iMesaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'tables', key: 'id' },
      },
      // NUEVO: marca el inicio de la sesión activa del cliente.
      // Se actualiza en cada login y cuando el cajero aprueba el pago.
      // El cajero filtra pedidos de la mesa solo desde esta fecha.
      dUltimoLogin: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      twoFactorEnabled: {
  type: DataTypes.BOOLEAN,
  defaultValue: false
},
twoFactorSecret: {
  type: DataTypes.STRING,
  allowNull: true
},
backupCodes: {
  type: DataTypes.TEXT,
  allowNull: true
},

resetToken: {
  type: DataTypes.STRING,
  allowNull: true
},
resetExpires: {
  type: DataTypes.DATE,
  allowNull: true
},
resetRequestedAt: {
  type: DataTypes.DATE,
  allowNull: true
}
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