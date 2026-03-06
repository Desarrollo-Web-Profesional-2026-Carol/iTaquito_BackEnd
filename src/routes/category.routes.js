const { Router } = require('express');
const { getAll } = require('../controllers/category.controller');

const router = Router();

router.get('/', getAll);

module.exports = router;
