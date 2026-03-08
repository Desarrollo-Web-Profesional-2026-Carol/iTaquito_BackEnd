const { Op } = require('sequelize');
const { Table } = require('../models');

// GET /api/tables - Obtener todas las mesas con filtros
const getAll = async (req, res) => {
  try {
    const { sNombre, iCapacidad, sUbicacion, sEstado, bActivo } = req.query;

    const where = {};

    // Filtros opcionales
    if (sNombre) where.sNombre = { [Op.like]: `%${sNombre}%` };
    if (iCapacidad) where.iCapacidad = iCapacidad;
    if (sUbicacion) where.sUbicacion = sUbicacion;
    if (sEstado) where.sEstado = sEstado;
    if (bActivo !== undefined) where.bActivo = bActivo === 'true';

    const tables = await Table.findAll({
      where,
      order: [
        ['sUbicacion', 'ASC'],
        ['sNombre', 'ASC'],
      ],
    });

    return res.json({
      success: true,
      data: tables,
      count: tables.length,
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener mesas.', 
      error: error.message 
    });
  }
};

// GET /api/tables/:id - Obtener una mesa por ID
const getById = async (req, res) => {
  try {
    const table = await Table.findByPk(req.params.id);

    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mesa no encontrada.' 
      });
    }

    return res.json({
      success: true,
      data: table,
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener mesa.', 
      error: error.message 
    });
  }
};

// POST /api/tables - Crear una nueva mesa
const create = async (req, res) => {
  try {
    const { sNombre, iCapacidad, sUbicacion, sEstado, sDescripcion } = req.body;

    // Validaciones
    if (!sNombre || !iCapacidad || !sUbicacion) {
      return res.status(400).json({ 
        success: false, 
        message: 'sNombre, iCapacidad y sUbicacion son requeridos.' 
      });
    }

    // Validar capacidad
    if (iCapacidad < 1 || iCapacidad > 20) {
      return res.status(400).json({ 
        success: false, 
        message: 'La capacidad debe ser entre 1 y 20 personas.' 
      });
    }

    // Verificar si ya existe una mesa con el mismo nombre
    const existingTable = await Table.findOne({ 
      where: { sNombre, bActivo: true } 
    });

    if (existingTable) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ya existe una mesa con ese nombre.' 
      });
    }

    const table = await Table.create({
      sNombre,
      iCapacidad,
      sUbicacion,
      sEstado: sEstado || 'disponible',
      sDescripcion,
      bActivo: true,
    });

    return res.status(201).json({ 
      success: true, 
      message: 'Mesa creada exitosamente.', 
      data: table 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error al crear mesa.', 
      error: error.message 
    });
  }
};

// PUT /api/tables/:id - Actualizar una mesa
const update = async (req, res) => {
  try {
    const table = await Table.findByPk(req.params.id);
    
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mesa no encontrada.' 
      });
    }

    const { sNombre, iCapacidad, sUbicacion, sEstado, sDescripcion } = req.body;

    // Validar capacidad si se proporciona
    if (iCapacidad && (iCapacidad < 1 || iCapacidad > 20)) {
      return res.status(400).json({ 
        success: false, 
        message: 'La capacidad debe ser entre 1 y 20 personas.' 
      });
    }

    // Verificar si el nombre ya existe en otra mesa
    if (sNombre && sNombre !== table.sNombre) {
      const existingTable = await Table.findOne({ 
        where: { 
          sNombre, 
          bActivo: true,
          id: { [Op.ne]: req.params.id }
        } 
      });

      if (existingTable) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe otra mesa con ese nombre.' 
        });
      }
    }

    await table.update({
      sNombre: sNombre || table.sNombre,
      iCapacidad: iCapacidad || table.iCapacidad,
      sUbicacion: sUbicacion || table.sUbicacion,
      sEstado: sEstado || table.sEstado,
      sDescripcion: sDescripcion !== undefined ? sDescripcion : table.sDescripcion,
    });

    return res.json({ 
      success: true, 
      message: 'Mesa actualizada exitosamente.', 
      data: table 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar mesa.', 
      error: error.message 
    });
  }
};

// DELETE /api/tables/:id - Eliminar una mesa (eliminación lógica)
const remove = async (req, res) => {
  try {
    const table = await Table.findOne({ 
      where: { id: req.params.id, bActivo: true } 
    });

    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mesa no encontrada.' 
      });
    }

    await table.update({ bActivo: false });

    return res.json({ 
      success: true, 
      message: 'Mesa eliminada correctamente.' 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar mesa.', 
      error: error.message 
    });
  }
};

// PATCH /api/tables/:id/estado - Cambiar estado de la mesa
const changeStatus = async (req, res) => {
  try {
    const { sEstado } = req.body;
    const table = await Table.findOne({ 
      where: { id: req.params.id, bActivo: true } 
    });

    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mesa no encontrada.' 
      });
    }

    if (!['disponible', 'ocupada', 'reservada', 'inactiva'].includes(sEstado)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Estado no válido.' 
      });
    }

    await table.update({ sEstado });

    return res.json({ 
      success: true, 
      message: 'Estado de mesa actualizado.', 
      data: table 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error al cambiar estado.', 
      error: error.message 
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  changeStatus,
};