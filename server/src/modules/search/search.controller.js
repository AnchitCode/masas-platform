const searchService = require('./search.service');
const { createSuccessResponse } = require('../../utils/response');

/**
 * GET /inventory — public location-based inventory search
 */
const searchInventory = async (req, res, next) => {
  try {
    const payload = await searchService.searchPublicInventory(req.query);
    res.status(200).json(
      createSuccessResponse('Search completed', payload)
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchInventory,
};
