const bcrypt = require('bcryptjs');
const { User, Table } = require('../models');

const USER_ATTRS = { exclude: ['password'] };
const INCLUDE_MESA = [{ model: Table, as: 'mesa', attributes: ['id', 'sNombre', 'sEstado', 'sUbicacion'] }];

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: USER_ATTRS,
      include: INCLUDE_MESA,
      order: [['createdAt', 'DESC']],
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener usuarios.', error: error.message });
  }
};

// GET /api/users/me
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: USER_ATTRS,
      include: INCLUDE_MESA,
    });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener usuario.', error: error.message });
  }
};

// GET /api/users/mesas-disponibles — mesas sin usuario cliente asignado
const getMesasDisponibles = async (req, res) => {
  try {
    // Mesas que no tienen ningún usuario cliente asignado
    const mesasOcupadas = await User.findAll({
      where: { rol: 'cliente' },
      attributes: ['iMesaId'],
      raw: true,
    });
    const idsOcupados = mesasOcupadas.map(u => u.iMesaId).filter(Boolean);

    const where = { bActivo: true };
    if (idsOcupados.length > 0) {
      const { Op } = require('sequelize');
      where.id = { [Op.notIn]: idsOcupados };
    }

    const mesas = await Table.findAll({
      where,
      attributes: ['id', 'sNombre', 'sUbicacion', 'sEstado', 'iCapacidad'],
      order: [['sNombre', 'ASC']],
    });

    return res.json(mesas);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener mesas.', error: error.message });
  }
};

// POST /api/users
const createUser = async (req, res) => {
  try {
    const { nombre, email, password, rol, iMesaId } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ message: 'nombre, email, password y rol son requeridos.' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'El email ya está registrado.' });

    // Si es cliente, debe tener mesa; si no es cliente, no debe tener mesa
    if (rol === 'cliente') {
      if (!iMesaId) return res.status(400).json({ message: 'Un cliente debe tener una mesa asignada.' });

      const mesa = await Table.findByPk(iMesaId);
      if (!mesa)         return res.status(404).json({ message: 'Mesa no encontrada.' });
      if (!mesa.bActivo) return res.status(400).json({ message: 'La mesa no está activa.' });

      // Verificar que la mesa no esté asignada a otro cliente
      const mesaOcupada = await User.findOne({ where: { rol: 'cliente', iMesaId } });
      if (mesaOcupada) return res.status(400).json({ message: 'Esa mesa ya tiene un cliente asignado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      rol,
      iMesaId: rol === 'cliente' ? iMesaId : null,
    });

    const full = await User.findByPk(user.id, { attributes: USER_ATTRS, include: INCLUDE_MESA });
    return res.status(201).json({ message: 'Usuario creado exitosamente.', user: full });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear usuario.', error: error.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    const { nombre, email, password, rol, iMesaId } = req.body;

    if (email && email !== user.email) {
      const existing = await User.findOne({ where: { email } });
      if (existing) return res.status(400).json({ message: 'El email ya está en uso.' });
    }

    const rolFinal = rol || user.rol;

    if (rolFinal === 'cliente' && iMesaId !== undefined) {
      const mesa = await Table.findByPk(iMesaId);
      if (!mesa) return res.status(404).json({ message: 'Mesa no encontrada.' });

      // Verificar que la mesa no esté asignada a otro cliente diferente
      const { Op } = require('sequelize');
      const mesaOcupada = await User.findOne({
        where: { rol: 'cliente', iMesaId, id: { [Op.ne]: user.id } },
      });
      if (mesaOcupada) return res.status(400).json({ message: 'Esa mesa ya tiene un cliente asignado.' });
    }

    const updates = {};
    if (nombre)   updates.nombre = nombre;
    if (email)    updates.email  = email;
    if (rol)      updates.rol    = rol;
    if (password) updates.password = await bcrypt.hash(password, 10);

    // Manejo de mesa según rol
    if (rolFinal === 'cliente') {
      updates.iMesaId = iMesaId !== undefined ? iMesaId : user.iMesaId;
    } else {
      updates.iMesaId = null; // staff nunca tiene mesa
    }

    await user.update(updates);

    const full = await User.findByPk(user.id, { attributes: USER_ATTRS, include: INCLUDE_MESA });
    return res.json({ message: 'Usuario actualizado exitosamente.', user: full });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar usuario.', error: error.message });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    // No permitir borrar al admin que está haciendo la petición
    if (user.id === req.user.id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' });
    }

    await user.destroy();
    return res.json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar usuario.', error: error.message });
  }
};

module.exports = { getAllUsers, getMe, getMesasDisponibles, createUser, updateUser, deleteUser };
