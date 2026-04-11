const https = require('https');

const sendPasswordResetEmail = async (to, nombre, resetLink) => {
  const apiKey = (process.env.BREVO_API_KEY || '').replace(/"/g, '');

  if (!apiKey) {
    console.error('❌ BREVO_API_KEY no está configurado');
    throw new Error('Configuración de email faltante.');
  }

  console.log(`📧 Intentando enviar correo de recuperación a: ${to}`);

  const payload = JSON.stringify({
    sender: { name: 'iTaquito', email: 'a7c57b001@smtp-brevo.com' },
    to: [{ email: to, name: nombre }],
    subject: '🔐 Recupera tu contraseña - iTaquito',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Recupera tu contraseña - iTaquito</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f0e8; margin: 0; padding: 0; }
          .container { max-width: 500px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #E83E8C, #FF6B35); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .button { display: inline-block; background: #E83E8C; color: white; text-decoration: none; padding: 12px 30px; border-radius: 50px; margin: 20px 0; font-weight: bold; }
          .footer { background: #f5f0e8; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .warning { color: #E83E8C; font-size: 12px; margin-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌮 iTaquito</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Restaurante Mexicano</p>
          </div>
          <div class="content">
            <h2>Hola ${nombre}!</h2>
            <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña:</p>
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Restablecer Contraseña</a>
            </div>
            <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
            <div class="warning">
              ⚠️ Este enlace expirará en 1 hora.
            </div>
          </div>
          <div class="footer">
            <p>iTaquito - Los mejores tacos de la ciudad</p>
            <p>¿Necesitas ayuda? Contacta a tu administrador</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Correo enviado exitosamente a ${to}`);
          resolve(JSON.parse(data));
        } else {
          console.error(`❌ Error de Brevo API: ${res.statusCode} — ${data}`);
          reject(new Error(`Error de Brevo: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error al enviar el correo:', error.message);
      reject(new Error(`No se pudo enviar el correo: ${error.message}`));
    });

    req.write(payload);
    req.end();
  });
};

module.exports = { sendPasswordResetEmail };