-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dietaryPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[];
