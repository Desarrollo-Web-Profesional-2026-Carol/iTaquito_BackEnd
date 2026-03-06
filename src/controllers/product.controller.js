const { Op } = require('sequelize');
const { Product, Category } = require('../models');
const { cloudinary } = require('../config/cloudinary');

// GET /api/products
const getAll = async (req, res) => {
  try {
    const { iCategoriaId, bDisponible, sNombre } = req.query;

    const where = { bActivo: true };

    if (iCategoriaId) where.iCategoriaId = iCategoriaId;
    if (bDisponible !== undefined) where.bDisponible = bDisponible === 'true';
    if (sNombre) where.sNombre = { [Op.like]: `%${sNombre}%` };

    const products = await Product.findAll({
      where,
      include: [{ model: Category, as: 'categoria', attributes: ['id', 'sNombre'] }],
      order: [['sNombre', 'ASC']],
    });

    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener productos.', error: error.message });
  }
};

// GET /api/products/:id
const getById = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, bActivo: true },
      include: [{ model: Category, as: 'categoria', attributes: ['id', 'sNombre'] }],
    });

    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' });
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener producto.', error: error.message });
  }
};

// POST /api/products  (admin)
const create = async (req, res) => {
  try {
    const { sNombre, sDescripcion, dPrecio, bDisponible, iCategoriaId } = req.body;

    if (!sNombre || !dPrecio || !iCategoriaId) {
      return res.status(400).json({ message: 'sNombre, dPrecio e iCategoriaId son requeridos.' });
    }

    const category = await Category.findByPk(iCategoriaId);
    if (!category) return res.status(404).json({ message: 'Categoría no encontrada.' });

    // Si se subió imagen, multer+Cloudinary ya la guardó y retorna la URL en req.file.path
    const sImagenUrl = req.file ? req.file.path : null;

    const product = await Product.create({
      sNombre, sDescripcion, dPrecio, sImagenUrl,
      bDisponible: bDisponible ?? true,
      iCategoriaId,
    });

    return res.status(201).json({ message: 'Producto creado exitosamente.', product });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear producto.', error: error.message });
  }
};

// PUT /api/products/:id  (admin)
const update = async (req, res) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, bActivo: true } });
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' });

    const { sNombre, sDescripcion, dPrecio, bDisponible, iCategoriaId } = req.body;

    if (iCategoriaId) {
      const category = await Category.findByPk(iCategoriaId);
      if (!category) return res.status(404).json({ message: 'Categoría no encontrada.' });
    }

    // Si se sube nueva imagen, reemplaza la URL; si no, conserva la existente
    const sImagenUrl = req.file ? req.file.path : product.sImagenUrl;

    await product.update({ sNombre, sDescripcion, dPrecio, sImagenUrl, bDisponible, iCategoriaId });

    return res.json({ message: 'Producto actualizado exitosamente.', product });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar producto.', error: error.message });
  }
};

// DELETE /api/products/:id  (admin) — eliminación lógica
const remove = async (req, res) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, bActivo: true } });
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' });

    await product.update({ bActivo: false });

    return res.json({ message: 'Producto eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar producto.', error: error.message });
  }
};

module.exports = { getAll, getById, create, update, remove };
