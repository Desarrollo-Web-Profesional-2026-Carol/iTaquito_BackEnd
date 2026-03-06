const { User } = require('../models');

// GET /api/users (solo admin)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
    });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener usuarios.', error: error.message });
  }
};

// GET /api/users/me (usuario autenticado)
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener usuario.', error: error.message });
  }
};

module.exports = { getAllUsers, getMe };
