import { prisma } from "../lib/prisma.js";

export type FoodCalculation = {
    grams: number;
    calories: number;
    protein: number;
    carbs: number | null;
    fat: number | null;
};

export function calculateFoodNutrition(
    food: {
        servingGrams: number;
        calories: number;
        protein: number;
        carbs: number | null;
        fat: number | null;
    },
    grams: number
): FoodCalculation {
    if (grams <= 0) {
        throw new Error("Quantity must be greater than 0");
    }

    if (food.servingGrams <= 0) {
        throw new Error("Invalid food serving size");
    }

    const multiplier = grams / food.servingGrams;

    return {
        grams,
        calories: round(food.calories * multiplier),
        protein: round(food.protein * multiplier),
        carbs:
            food.carbs === null
                ? null
                : round(food.carbs * multiplier),
        fat:
            food.fat === null
                ? null
                : round(food.fat * multiplier),
    };
}

export async function searchFoods(
    userId: string,
    search?: string
) {
    return (prisma as any).food.findMany({
        where: {
            OR: [
                { userId: null },
                { userId },
            ],
            ...(search
                ? {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                }
                : {}),
        },
        orderBy: {
            name: "asc",
        },
        take: 30,
    });
}

function round(value: number): number {
    return Math.round(value * 10) / 10;
}