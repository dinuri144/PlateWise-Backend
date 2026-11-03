/*
  Warnings:

  - A unique constraint covering the columns `[userId,date,mealType]` on the table `FoodLog` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FoodLog_userId_date_mealType_key" ON "FoodLog"("userId", "date", "mealType");
