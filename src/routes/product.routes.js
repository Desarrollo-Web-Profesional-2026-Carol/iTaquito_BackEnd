const { Router } = require('express');
const { getAll, getById, create, update, remove } = require('../controllers/product.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../config/cloudinary');

const router = Router();

// Middleware "soft" — decodifica el token si viene, pero no bloquea si no hay
const softAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // token inválido → sin usuario, continúa
    }
  }
  next();
};

// Públicas (con softAuth para que admin vea inactivos)
router.get('/',    softAuth, getAll);
router.get('/:id', softAuth, getById);

// Solo admin
router.post('/',      verifyToken, verifyAdmin, upload.single('imagen'), create);
router.put('/:id',    verifyToken, verifyAdmin, upload.single('imagen'), update);
router.delete('/:id', verifyToken, verifyAdmin, remove);

module.exports = router;