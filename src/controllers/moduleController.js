const moduleService = require('../services/moduleService');

const getModules = async (req, res) => {
  const { courseId } = req.query;
  try {
    const modules = await moduleService.getAllModulesByCourse(Number(courseId));
    res.status(200).json(modules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
};

const getModuleById = async (req, res) => {
  try {
    const module = await moduleService.getModuleById(Number(req.params.id));
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.status(200).json(module);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch module' });
  }
};

const createModule = async (req, res) => {
  try {
    const module = await moduleService.createModule(req.body);
    res.status(201).json(module);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create module' });
  }
};

const updateModule = async (req, res) => {
  try {
    const module = await moduleService.updateModule(Number(req.params.id), req.body);
    res.status(200).json(module);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update module' });
  }
};

const deleteModule = async (req, res) => {
  try {
    await moduleService.deleteModule(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete module' });
  }
};

module.exports = {
  getModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule
};
