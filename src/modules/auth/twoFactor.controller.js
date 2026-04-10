const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const { User } = require('../../models');

// Generar códigos de respaldo (6 códigos de 8 caracteres)
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 6; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

// ========== ADMIN: Activar 2FA para un usuario ==========
const enable2FAForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Generar secreto 2FA
    const secret = speakeasy.generateSecret({
      name: `iTaquito (${user.nombre})`,
      issuer: 'iTaquito',
    });

    // Generar códigos de respaldo
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    // Guardar en BD
    await user.update({
      twoFactorSecret:  secret.base32,
      backupCodes:      JSON.stringify(hashedBackupCodes),
      twoFactorEnabled: true,
    });

    // Generar QR code como base64
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      qrCodeUrl,
      backupCodes,
      secret: secret.base32,
    });
  } catch (error) {
    console.error('Error en enable2FAForUser:', error);
    res.status(500).json({ message: 'Error al activar 2FA' });
  }
};

// ========== ADMIN: Desactivar 2FA para un usuario ==========
const disable2FAForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await user.update({
      twoFactorSecret:  null,
      twoFactorEnabled: false,
      backupCodes:      null,
    });

    res.json({ message: '2FA desactivado correctamente' });
  } catch (error) {
    console.error('Error en disable2FAForUser:', error);
    res.status(500).json({ message: 'Error al desactivar 2FA' });
  }
};

// ========== USUARIO: Regenerar códigos de respaldo ==========
const getBackupCodes = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user?.backupCodes) {
      return res.status(404).json({ message: 'No hay códigos de respaldo' });
    }

    const newBackupCodes = generateBackupCodes();
    const hashedNewCodes = await Promise.all(
      newBackupCodes.map(code => bcrypt.hash(code, 10))
    );

    await user.update({ backupCodes: JSON.stringify(hashedNewCodes) });

    res.json({ backupCodes: newBackupCodes });
  } catch (error) {
    console.error('Error en getBackupCodes:', error);
    res.status(500).json({ message: 'Error al generar códigos' });
  }
};

// ========== Verificar código 2FA (para usar en login) ==========
const verify2FACode = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1
  });
};

module.exports = {
  enable2FAForUser,
  disable2FAForUser,
  getBackupCodes,
  verify2FACode,
};