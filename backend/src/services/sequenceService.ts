import prisma from '../config/database.js';

export const sequenceService = {
  async getNextValue(sequenceId: string): Promise<number> {
    // Usar transacción para garantizar atomicidad
    const result = await prisma.$transaction(async (tx) => {
      // Intentar obtener y actualizar en una sola operación
      const sequence = await tx.sequence.upsert({
        where: { id: sequenceId },
        create: { id: sequenceId, currentValue: 1 },
        update: { currentValue: { increment: 1 } },
      });

      return sequence.currentValue;
    });

    return result;
  },

  async getCurrentValue(sequenceId: string): Promise<number> {
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
    });

    return sequence?.currentValue || 0;
  },

  async resetSequence(sequenceId: string, value: number = 0): Promise<void> {
    await prisma.sequence.upsert({
      where: { id: sequenceId },
      create: { id: sequenceId, currentValue: value },
      update: { currentValue: value },
    });
  },
};

export const SEQUENCES = {
  RECEIPT: 'receipt_number',
  RETURN: 'return_number',
} as const;

export default sequenceService;
