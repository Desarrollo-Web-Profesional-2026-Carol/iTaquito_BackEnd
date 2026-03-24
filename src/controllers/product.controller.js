const { Op } = require('sequelize');
const { Product, Category } = require('../models');

const INCLUDE = [{ model: Category, as: 'categoria', attributes: ['id', 'sNombre'] }];

// GET /api/products
const getAll = async (req, res) => {
  try {
    const { iCategoriaId, bDisponible, sNombre } = req.query;
    const where = {};

    // Admin ve todos; cualquier otro solo ve activos
    if (req.user?.rol !== 'admin') {
      where.bActivo = true;
    }

    if (iCategoriaId)              where.iCategoriaId = iCategoriaId;
    if (bDisponible !== undefined)  where.bDisponible  = bDisponible === 'true';
    if (sNombre)                   where.sNombre      = { [Op.like]: `%${sNombre}%` };

    const products = await Product.findAll({
      where,
      include: INCLUDE,
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
    const where = { id: req.params.id };
    if (req.user?.rol !== 'admin') where.bActivo = true;

    const product = await Product.findOne({ where, include: INCLUDE });
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' });

    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener producto.', error: error.message });
  }
};

// POST /api/products  (admin)
const create = async (req, res) => {
  try {
    const {
      sNombre, sDescripcion, dPrecio,
      bDisponible, bActivo, iCategoriaId,
      sImagenUrl: sImagenUrlBody,
    } = req.body;

    if (!sNombre || !dPrecio || !iCategoriaId) {
      return res.status(400).json({ message: 'sNombre, dPrecio e iCategoriaId son requeridos.' });
    }

    const category = await Category.findByPk(iCategoriaId);
    if (!category) return res.status(404).json({ message: 'Categoría no encontrada.' });

    // Multer/Cloudinary tiene prioridad; si no hay archivo, usa la URL del body
    const sImagenUrl = req.file ? req.file.path : (sImagenUrlBody || null);

    const product = await Product.create({
      sNombre,
      sDescripcion: sDescripcion || null,
      dPrecio,
      sImagenUrl,
      bDisponible:  bDisponible !== undefined ? bDisponible : true,
      bActivo:      bActivo     !== undefined ? bActivo     : true,
      iCategoriaId,
    });

    const full = await Product.findByPk(product.id, { include: INCLUDE });
    return res.status(201).json({ message: 'Producto creado exitosamente.', product: full });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear producto.', error: error.message });
  }
};

// PUT /api/products/:id  (admin)
const update = async (req, res) => {
  try {
    // Admin puede editar activos e inactivos
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Producto no encontrado.' });

    const {
      sNombre, sDescripcion, dPrecio,
      bDisponible, bActivo, iCategoriaId,
      sImagenUrl: sImagenUrlBody,
    } = req.body;

    if (iCategoriaId) {
      const category = await Category.findByPk(iCategoriaId);
      if (!category) return res.status(404).json({ message: 'Categoría no encontrada.' });
    }

    // Imagen: archivo subido > URL del body > conservar la existente
    const sImagenUrl = req.file
      ? req.file.path
      : (sImagenUrlBody !== undefined ? sImagenUrlBody : product.sImagenUrl);

    await product.update({
      ...(sNombre      !== undefined && { sNombre      }),
      ...(sDescripcion !== undefined && { sDescripcion }),
      ...(dPrecio      !== undefined && { dPrecio      }),
      ...(bDisponible  !== undefined && { bDisponible  }),
      ...(bActivo      !== undefined && { bActivo      }),
      ...(iCategoriaId !== undefined && { iCategoriaId }),
      sImagenUrl,
    });

    const full = await Product.findByPk(product.id, { include: INCLUDE });
    return res.json({ message: 'Producto actualizado exitosamente.', product: full });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar producto.', error: error.message });
  }
};

// DELETE /api/products/:id  (admin) — eliminación lógica
const remove = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product)          return res.status(404).json({ message: 'Producto no encontrado.' });
    if (!product.bActivo)  return res.status(400).json({ message: 'El producto ya está eliminado.' });

    await product.update({ bActivo: false });
    return res.json({ message: 'Producto eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar producto.', error: error.message });
  }
};

module.exports = { getAll, getById, create, update, remove };