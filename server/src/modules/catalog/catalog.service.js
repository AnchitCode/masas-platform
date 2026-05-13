const prisma = require('../../lib/prisma');

/**
 * Search the medicine catalog by name or generic name
 * @param {string} query - The search query string
 * @returns {Promise<Array>} List of matching medicines
 */
const searchMedicines = async (query) => {
  if (!query || query.trim() === '') {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();

  const medicines = await prisma.medicineCatalog.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { genericName: { contains: searchTerm, mode: 'insensitive' } },
      ],
    },
    take: 10, // Limit results for autocomplete
    orderBy: {
      name: 'asc',
    },
  });

  return medicines;
};

module.exports = {
  searchMedicines,
};
