const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const moduleController = require('../../controllers/moduleController');

router.get('/', requireAuth, requireAdmin, moduleController.getModules);
router.get('/:id', requireAuth, requireAdmin, moduleController.getModuleById);
router.post('/', requireAuth, requireAdmin, moduleController.createModule);
router.put('/:id', requireAuth, requireAdmin, moduleController.updateModule);
router.delete('/:id', requireAuth, requireAdmin, moduleController.deleteModule);

module.exports = router;
