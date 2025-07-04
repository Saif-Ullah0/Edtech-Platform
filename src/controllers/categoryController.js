const categoryService = require('../services/categoryService');
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

module.exports = {
    getCategories
};