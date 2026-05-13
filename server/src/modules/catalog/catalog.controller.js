const catalogService = require('./catalog.service');
const { createSuccessResponse } = require('../../utils/response');

/**
 * Handle GET /search
 */
const searchMedicines = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(200).json(
        createSuccessResponse('Empty query', { medicines: [] })
      );
    }

    const medicines = await catalogService.searchMedicines(q);
    
    res.status(200).json(
      createSuccessResponse('Medicines retrieved', { medicines })
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchMedicines,
};
