const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../../models');

// Función para verificar código 2FA
const verify2FACode = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1
  });
};

// Registro de usuario
const register = async (req, res) => {
  try {
    const { email, password, nombre, rol } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await User.create({
      email,
      password: hashedPassword,
      nombre,
      rol: rol || 'usuario',
      twoFactorEnabled: false
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};

// Login con manejo de 2FA
const login = async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    // Buscar usuario por email INCLUYENDO la relación con mesa
    const user = await User.findOne({ 
      where: { email },
      include: ['mesa']
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // Verificar si el usuario tiene 2FA activado
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(200).json({
          requires2FA: true,
          userId: user.id,
          message: 'Se requiere código de autenticación de dos factores'
        });
      }

      const isValid2FA = verify2FACode(user.twoFactorSecret, twoFactorCode);
      
      let isBackupCode = false;
      if (!isValid2FA && user.backupCodes) {
        const backupCodes = JSON.parse(user.backupCodes);
        for (let i = 0; i < backupCodes.length; i++) {
          if (await bcrypt.compare(twoFactorCode, backupCodes[i])) {
            isBackupCode = true;
            backupCodes.splice(i, 1);
            await user.update({ backupCodes: JSON.stringify(backupCodes) });
            break;
          }
        }
      }

      if (!isValid2FA && !isBackupCode) {
        return res.status(401).json({ message: 'Código 2FA inválido' });
      }
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        rol: user.rol,
        nombre: user.nombre 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Construir respuesta con los datos de la mesa
    const userResponse = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      twoFactorEnabled: user.twoFactorEnabled,
      iMesaId: user.mesa ? user.mesa.id : null,
      mesa: user.mesa ? {
        id: user.mesa.id,
        sNumero: user.mesa.sNumero,
        sEstado: user.mesa.sEstado
      } : null
    };

    // Enviar respuesta exitosa
    res.json({
      message: 'Login exitoso',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Verificar 2FA por separado
const verify2FA = async (req, res) => {
  try {
    const { userId, twoFactorCode } = req.body;

    const user = await User.findByPk(userId, {
      include: ['mesa']
    });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar código 2FA
    const isValid2FA = verify2FACode(user.twoFactorSecret, twoFactorCode);
    
    let isBackupCode = false;
    if (!isValid2FA && user.backupCodes) {
      const backupCodes = JSON.parse(user.backupCodes);
      for (let i = 0; i < backupCodes.length; i++) {
        if (await bcrypt.compare(twoFactorCode, backupCodes[i])) {
          isBackupCode = true;
          backupCodes.splice(i, 1);
          await user.update({ backupCodes: JSON.stringify(backupCodes) });
          break;
        }
      }
    }

    if (!isValid2FA && !isBackupCode) {
      return res.status(401).json({ message: 'Código 2FA inválido' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        rol: user.rol,
        nombre: user.nombre 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Respuesta con datos de la mesa
    const userResponse = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      twoFactorEnabled: user.twoFactorEnabled,
      iMesaId: user.mesa ? user.mesa.id : null,
      mesa: user.mesa ? {
        id: user.mesa.id,
        sNumero: user.mesa.sNumero,
        sEstado: user.mesa.sEstado
      } : null
    };

    res.json({
      message: '2FA verificado correctamente',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Error en verify2FA:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    res.json({ message: 'Logout exitoso' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Solicitar reset de contraseña
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const resetToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Token de reset generado',
      resetToken
    });
  } catch (error) {
    console.error('Error en requestPasswordReset:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Reset de contraseña por admin
const adminResetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashedPassword });

    res.json({ message: 'Contraseña restablecida exitosamente' });
  } catch (error) {
    console.error('Error en adminResetPassword:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = {
  register,
  login,
  verify2FA,
  logout,
  requestPasswordReset,
  adminResetPassword
};