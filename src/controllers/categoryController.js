const categoryService = require('../services/categoryService');
const prisma = require('../../prisma/client');

const getCategories = async (req, res) => {
    try {
        const categories = await categoryService.getAllCategories({
            select:{
                id: true,
                name: true,
                description: true,
                imageUrl: true
            }
        });
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

const createCategory = async (req, res) => {
  try {
    const { name, slug, description, imageUrl } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    const existing = await prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(409).json({ error: 'Slug already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        imageUrl,
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    console.error('❌ Error creating category:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await categoryService.getCategoryById(parseInt(id));
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const updated = await categoryService.updateCategory(parseInt(id), data);
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await categoryService.deleteCategory(parseInt(id));
    res.status(204).send(); // No content
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
};
