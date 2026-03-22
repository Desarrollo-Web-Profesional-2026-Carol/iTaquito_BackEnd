const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User, Table } = require('../models');

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ nombre, email, password: hashedPassword });

    return res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al registrar usuario.', error: error.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Incluir mesa si el usuario es cliente
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Table,
        as: 'mesa',
        attributes: ['id', 'sNombre', 'sUbicacion', 'sEstado'],
        required: false,
      }],
    });

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // iMesaId viaja en el token para que el backend lo use al crear pedidos
    const token = jwt.sign(
      {
        id:      user.id,
        email:   user.email,
        rol:     user.rol,
        iMesaId: user.iMesaId || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    return res.json({
      message: 'Login exitoso.',
      token,
      user: {
        id:      user.id,
        nombre:  user.nombre,
        email:   user.email,
        rol:     user.rol,
        iMesaId: user.iMesaId || null,
        mesa:    user.mesa    || null,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al iniciar sesión.', error: error.message });
  }
};

module.exports = { register, login };