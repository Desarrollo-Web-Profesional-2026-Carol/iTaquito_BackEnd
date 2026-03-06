const { Router } = require('express');
const { getAll, getById, create, update, remove } = require('../controllers/product.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../config/cloudinary');

const router = Router();

// Rutas públicas
router.get('/', getAll);
router.get('/:id', getById);

// Rutas protegidas (solo admin)
// upload.single('imagen') intercepta el campo "imagen" del FormData y lo sube a Cloudinary
router.post('/', verifyToken, verifyAdmin, upload.single('imagen'), create);
router.put('/:id', verifyToken, verifyAdmin, upload.single('imagen'), update);
router.delete('/:id', verifyToken, verifyAdmin, remove);

module.exports = router;

