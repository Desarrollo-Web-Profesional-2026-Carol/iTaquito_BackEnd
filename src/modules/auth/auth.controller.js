const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User, Table } = require('../../models');

/* ══════════════════════════════════════════════════════════════
   POST /api/auth/register
══════════════════════════════════════════════════════════════ */
const register = async (req, res) => {
  try {
    const { nombre, email, password, iMesaId } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado.' });
    }

    if (iMesaId) {
      const mesa = await Table.findByPk(iMesaId);
      if (!mesa) return res.status(404).json({ message: 'Mesa no encontrada.' });
      if (mesa.sEstado === 'ocupada') return res.status(400).json({ message: 'La mesa ya está ocupada.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      nombre, email,
      password: hashedPassword,
      iMesaId: iMesaId || null,
    });

    return res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, iMesaId: user.iMesaId },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al registrar usuario.', error: error.message });
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /api/auth/login
   - Actualiza dUltimoLogin en BD para clientes
   - Incluye loginAt en JWT para filtrar pedidos por sesión
══════════════════════════════════════════════════════════════ */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      include: [{
        model: Table,
        as: 'mesa',
        attributes: ['id', 'sNombre', 'sUbicacion', 'sEstado'],
        required: false,
      }],
    });

    if (!user) return res.status(401).json({ message: 'Credenciales inválidas.' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Credenciales inválidas.' });

    const loginAt = new Date();

    if (user.rol === 'cliente' && user.iMesaId) {
      const mesa = await Table.findByPk(user.iMesaId);
      if (mesa) await mesa.update({ sEstado: 'ocupada' });
      // NUEVO: guardar inicio de sesión en BD
      await user.update({ dUltimoLogin: loginAt });
    }

    const token = jwt.sign(
      {
        id:      user.id,
        email:   user.email,
        rol:     user.rol,
        iMesaId: user.iMesaId || null,
        loginAt: loginAt.toISOString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const mesaActualizada = user.iMesaId ? await Table.findByPk(user.iMesaId) : null;

    return res.json({
      message: 'Login exitoso.',
      token,
      user: {
        id:      user.id,
        nombre:  user.nombre,
        email:   user.email,
        rol:     user.rol,
        iMesaId: user.iMesaId || null,
        mesa:    mesaActualizada || null,
        loginAt: loginAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al iniciar sesión.', error: error.message });
  }
};

/* ══════════════════════════════════════════════════════════════
   POST /api/auth/logout
══════════════════════════════════════════════════════════════ */
const logout = async (req, res) => {
  try {
    if (req.user?.rol === 'mesa' && req.user?.iMesaId) {
      const mesa = await Table.findByPk(req.user.iMesaId);
      if (mesa) await mesa.update({ sEstado: 'disponible' });
    }
    return res.json({ message: 'Sesión cerrada correctamente.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error al cerrar sesión.', error: error.message });
  }
};

module.exports = { register, login, logout };
