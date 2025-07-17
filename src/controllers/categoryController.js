const categoryService = require('../services/categoryService');
const prisma = require('../../prisma/client');

const getCategories = async (req, res) => {
    try {
        console.log('🔍 BACKEND Categories: Fetching all categories...');
        
        const categories = await prisma.category.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                imageUrl: true,
                createdAt: true,
                _count: {
                    select: {
                        courses: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        console.log('✅ BACKEND Categories: Found categories:', categories.length);
        res.status(200).json(categories);
    } catch (error) {
        console.error('❌ BACKEND Categories: Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

const createCategory = async (req, res) => {
    try {
        console.log('🔍 BACKEND Categories: Creating new category...');
        console.log('🔍 BACKEND Categories: Request body:', req.body);
        
        const { name, slug, description, imageUrl } = req.body;

        if (!name || !description) {
            return res.status(400).json({ error: 'Name and description are required' });
        }

        const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        const existing = await prisma.category.findUnique({
            where: { slug: finalSlug },
        });

        if (existing) {
            return res.status(409).json({ error: 'Slug already exists' });
        }

        const category = await prisma.category.create({
            data: {
                name,
                slug: finalSlug,
                description,
                imageUrl: imageUrl || '',
            },
        });

        console.log('✅ BACKEND Categories: Category created successfully:', category);
        
        res.status(201).json(category);
    } catch (error) {
        console.error('❌ BACKEND Categories: Error creating category:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getCategoryById = async (req, res) => {
    const { id } = req.params;
    try {
        console.log('🔍 BACKEND Categories: Fetching category by ID:', id);
        
        const category = await categoryService.getCategoryById(parseInt(id));
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.status(200).json(category);
    } catch (error) {
        console.error('❌ BACKEND Categories: Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
};

const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, slug, description, imageUrl } = req.body;
    
    try {
        console.log('🔍 BACKEND Categories: Updating category:', id);
        console.log('🔍 BACKEND Categories: Update data:', req.body);

        if (!name || !description) {
            return res.status(400).json({ error: 'Name and description are required' });
        }

        const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        const existing = await prisma.category.findFirst({
            where: {
                slug: finalSlug,
                NOT: {
                    id: parseInt(id)
                }
            }
        });

        if (existing) {
            return res.status(409).json({ error: 'Slug already exists' });
        }

        const updated = await prisma.category.update({
            where: {
                id: parseInt(id)
            },
            data: {
                name,
                slug: finalSlug,
                description,
                imageUrl: imageUrl || ''
            }
        });

        console.log('✅ BACKEND Categories: Category updated successfully:', updated);
        res.status(200).json(updated);
    } catch (error) {
        console.error('❌ BACKEND Categories: Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
};

const deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        console.log('🔍 BACKEND Categories: Deleting category:', id);

        const categoryWithCourses = await prisma.category.findUnique({
            where: {
                id: parseInt(id)
            },
            include: {
                _count: {
                    select: {
                        courses: true
                    }
                }
            }
        });

        if (!categoryWithCourses) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (categoryWithCourses._count.courses > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category that contains courses. Please move or delete courses first.' 
            });
        }

        await categoryService.deleteCategory(parseInt(id));
        
        console.log('✅ BACKEND Categories: Category deleted successfully');
        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('❌ BACKEND Categories: Error deleting category:', error);
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