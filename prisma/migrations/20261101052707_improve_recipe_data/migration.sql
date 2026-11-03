-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dietaryTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nutritionSource" TEXT,
ADD COLUMN     "nutritionVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "servingSizeGrams" DOUBLE PRECISION,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceUrl" TEXT;
