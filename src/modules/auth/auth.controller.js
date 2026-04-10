const speakeasy = require('speakeasy');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../../models');
const { sendPasswordResetEmail } = require('../../common/config/email');
const { Op } = require('sequelize');

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

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    const user = await User.findOne({ 
      where: { email },
      include: ['mesa']
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

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

// Solicitar recuperación de contraseña (envía email)
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'El correo electrónico es requerido' });
    }

    const user = await User.findOne({ where: { email } });
    
    // Por seguridad, no revelamos si el email existe o no
    if (!user) {
      return res.status(200).json({ 
        message: 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación'
      });
    }

    // Generar token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hora

    await user.update({
      resetToken,
      resetExpires
    });

    // Construir enlace de recuperación
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Enviar email
    await sendPasswordResetEmail(user.email, user.nombre, resetLink);

    res.json({ 
      message: 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación'
    });

  } catch (error) {
    console.error('Error en requestPasswordReset:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
};

// Verificar token de recuperación (opcional, para validar antes de mostrar el formulario)
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ valid: false, message: 'Token inválido o expirado' });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('Error en verifyResetToken:', error);
    res.status(500).json({ message: 'Error al verificar token' });
  }
};

// Restablecer contraseña con token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetExpires: null
    });

    res.json({ message: 'Contraseña restablecida exitosamente' });

  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ message: 'Error al restablecer contraseña' });
  }
};

// ADMIN: Resetear contraseña de cualquier usuario
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

// ADMIN: Generar contraseña temporal
const generateTempPassword = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    await user.update({ password: hashedPassword });

    res.json({ 
      message: 'Contraseña temporal generada',
      tempPassword
    });
  } catch (error) {
    console.error('Error en generateTempPassword:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = {
  register,
  login,
  verify2FA,
  logout,
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
  adminResetPassword,
  generateTempPassword
};