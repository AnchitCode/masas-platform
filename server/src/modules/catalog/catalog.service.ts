import prisma from '../../lib/prisma.js';

/**
 * Search the medicine catalog by name or generic name
 */
const searchMedicines = async (query: string) => {
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
    take: 10,
    orderBy: {
      name: 'asc',
    },
  });

  return medicines;
};

export { searchMedicines };
