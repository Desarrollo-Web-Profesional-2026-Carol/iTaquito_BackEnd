const { Category } = require('../models');

// GET /api/categories
const getAll = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['sNombre', 'ASC']] });
    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener categorías.', error: error.message });
  }
};

module.exports = { getAll };
