import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { calculateFoodNutrition, searchFoods } from "../services/foodService.js";

const router = Router();

router.use(requireAuth);

/* =========================================================
   VALIDATION
========================================================= */

const mealTypeEnum = z.enum([
    "BREAKFAST",
    "LUNCH",
    "DINNER",
    "SNACK",
]);

const createFoodSchema = z.object({
    name: z.string().trim().min(2).max(100),
    category: z.string().trim().max(50).optional(),
    servingGrams: z.number().positive(),
    calories: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
});

const calculateFoodSchema = z.object({
    foodId: z.string().min(1),
    grams: z.number().positive().max(10000),
});

const addFoodLogSchema = z.object({
    date: z.string().min(1),
    mealType: mealTypeEnum,
    foodId: z.string().min(1),
    grams: z.number().positive().max(10000),
    notes: z.string().trim().max(500).optional(),
});

/* =========================================================
   HELPERS
========================================================= */

/**
 * Parse a date safely.
 *
 * Food logging uses a calendar date rather than an exact timestamp.
 * This creates the start/end boundaries in the server's local time.
 */
function parseDateOnly(dateString: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    // Prevent invalid dates such as 2026-02-31.
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    date.setHours(0, 0, 0, 0);

    return date;
}

function getDayRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
}

/**
 * Make sure the selected food belongs either to:
 * - the global/system food database, or
 * - the currently logged-in user's custom foods.
 */
async function findAccessibleFood(foodId: string, userId: string) {
    return prisma.food.findFirst({
        where: {
            id: foodId,
            OR: [
                { userId: null },
                { userId },
            ],
        },
    });
}

/* =========================================================
   GET /api/food
   Search system foods + user's custom foods
========================================================= */

router.get("/", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim()
                : undefined;

        const foods = await searchFoods(userId, search);

        return res.json(foods);
    } catch (error) {
        console.error("GET /api/food error:", error);

        return res.status(500).json({
            error: "Failed to load foods",
        });
    }
});

/* =========================================================
   POST /api/food
   Create a custom food
========================================================= */

router.post("/", async (req: AuthRequest, res) => {
    try {
        const parsed = createFoodSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid food information",
                details: parsed.error.flatten(),
            });
        }

        const userId = req.user!.userId;

        const food = await prisma.food.create({
            data: {
                name: parsed.data.name,
                category: parsed.data.category,
                servingUnit: "100g",
                servingGrams: parsed.data.servingGrams,
                calories: parsed.data.calories,
                protein: parsed.data.protein,
                carbs: parsed.data.carbs,
                fat: parsed.data.fat,
                isCustom: true,
                userId,
            },
        });

        return res.status(201).json(food);
    } catch (error) {
        console.error("POST /api/food error:", error);

        return res.status(500).json({
            error: "Failed to create custom food",
        });
    }
});

/* =========================================================
   POST /api/food/calculate
   Calculate nutrition for a specific gram amount
========================================================= */

router.post("/calculate", async (req: AuthRequest, res) => {
    try {
        const parsed = calculateFoodSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid calculation data",
                details: parsed.error.flatten(),
            });
        }

        const userId = req.user!.userId;

        const food = await findAccessibleFood(
            parsed.data.foodId,
            userId
        );

        if (!food) {
            return res.status(404).json({
                error: "Food not found",
            });
        }

        const nutrition = calculateFoodNutrition(
            food,
            parsed.data.grams
        );

        return res.json({
            food,
            nutrition,
        });
    } catch (error) {
        console.error("POST /api/food/calculate error:", error);

        return res.status(500).json({
            error: "Failed to calculate nutrition",
        });
    }
});

/* =========================================================
   POST /api/food/log
   Add food to breakfast/lunch/dinner/snack
========================================================= */

router.post("/log", async (req: AuthRequest, res) => {
    try {
        const parsed = addFoodLogSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid food log data",
                details: parsed.error.flatten(),
            });
        }

        const userId = req.user!.userId;

        /* -----------------------------------------------
           Validate date
        ------------------------------------------------ */

        const date = parseDateOnly(parsed.data.date);

        if (!date) {
            return res.status(400).json({
                error: "Invalid date. Use YYYY-MM-DD format.",
            });
        }

        /* -----------------------------------------------
           Find accessible food
        ------------------------------------------------ */

        const food = await findAccessibleFood(
            parsed.data.foodId,
            userId
        );

        if (!food) {
            return res.status(404).json({
                error: "Food not found",
            });
        }

        /* -----------------------------------------------
           Calculate nutrition from grams
        ------------------------------------------------ */

        const nutrition = calculateFoodNutrition(
            food,
            parsed.data.grams
        );

        /* -----------------------------------------------
           Create or update today's meal
        ------------------------------------------------ */

        const foodLog = await prisma.foodLog.upsert({
            where: {
                userId_date_mealType: {
                    userId,
                    date,
                    mealType: parsed.data.mealType,
                },
            },

            create: {
                userId,
                date,
                mealType: parsed.data.mealType,
                notes: parsed.data.notes,

                items: {
                    create: {
                        foodId: food.id,
                        quantity: parsed.data.grams,
                        unit: "g",
                        grams: nutrition.grams,
                        calories: nutrition.calories,
                        protein: nutrition.protein,
                    },
                },
            },

            update: {
                ...(parsed.data.notes !== undefined
                    ? { notes: parsed.data.notes }
                    : {}),

                items: {
                    create: {
                        foodId: food.id,
                        quantity: parsed.data.grams,
                        unit: "g",
                        grams: nutrition.grams,
                        calories: nutrition.calories,
                        protein: nutrition.protein,
                    },
                },
            },

            include: {
                items: {
                    include: {
                        food: true,
                    },
                },
            },
        });

        return res.status(201).json(foodLog);
    } catch (error) {
        console.error("POST /api/food/log error:", error);

        return res.status(500).json({
            error: "Failed to log food",
        });
    }
});

/* =========================================================
   GET /api/food/log/today
   Get today's complete food log
========================================================= */

router.get("/log/today", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const { start, end } = getDayRange(today);

        const logs = await prisma.foodLog.findMany({
            where: {
                userId,
                date: {
                    gte: start,
                    lt: end,
                },
            },

            include: {
                items: {
                    include: {
                        food: true,
                    },
                },
            },

            orderBy: {
                mealType: "asc",
            },
        });

        /* -----------------------------------------------
           Calculate daily totals
        ------------------------------------------------ */

        let calories = 0;
        let protein = 0;
        let carbs = 0;
        let fat = 0;

        for (const log of logs) {
            for (const item of log.items) {
                calories += item.calories;
                protein += item.protein;

                /*
                 * carbs and fat are currently not stored
                 * inside FoodLogItem.
                 *
                 * Therefore we calculate them from the
                 * original Food record when available.
                 */

                if (item.food.carbs != null) {
                    const factor =
                        item.grams / item.food.servingGrams;

                    carbs += item.food.carbs * factor;
                }

                if (item.food.fat != null) {
                    const factor =
                        item.grams / item.food.servingGrams;

                    fat += item.food.fat * factor;
                }
            }
        }

        return res.json({
            date: start.toISOString().slice(0, 10),

            logs,

            totals: {
                calories: Math.round(calories * 10) / 10,
                protein: Math.round(protein * 10) / 10,
                carbs: Math.round(carbs * 10) / 10,
                fat: Math.round(fat * 10) / 10,
            },
        });
    } catch (error) {
        console.error("GET /api/food/log/today error:", error);

        return res.status(500).json({
            error: "Failed to load today's food log",
        });
    }
});

/* =========================================================
   GET /api/food/log
   Get food logs for a selected date
========================================================= */

router.get("/log", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const dateString =
            typeof req.query.date === "string"
                ? req.query.date
                : new Date().toISOString().slice(0, 10);

        const date = parseDateOnly(dateString);

        if (!date) {
            return res.status(400).json({
                error: "Invalid date. Use YYYY-MM-DD format.",
            });
        }

        const { start, end } = getDayRange(date);

        const logs = await prisma.foodLog.findMany({
            where: {
                userId,
                date: {
                    gte: start,
                    lt: end,
                },
            },

            include: {
                items: {
                    include: {
                        food: true,
                    },
                },
            },

            orderBy: {
                mealType: "asc",
            },
        });

        let calories = 0;
        let protein = 0;

        for (const log of logs) {
            for (const item of log.items) {
                calories += item.calories;
                protein += item.protein;
            }
        }

        return res.json({
            date: dateString,
            logs,
            totals: {
                calories: Math.round(calories * 10) / 10,
                protein: Math.round(protein * 10) / 10,
            },
        });
    } catch (error) {
        console.error("GET /api/food/log error:", error);

        return res.status(500).json({
            error: "Failed to load food log",
        });
    }
});

/* =========================================================
   DELETE /api/food/log/item/:itemId
   Remove a logged food item
========================================================= */

router.delete(
    "/log/item/:itemId",
    async (req: AuthRequest, res) => {
        try {
            const userId = req.user!.userId;
            const itemId = req.params.itemId;

            if (typeof itemId !== "string") {
                return res.status(400).json({
                    error: "Invalid food log item ID",
                });
            }

            const item = await prisma.foodLogItem.findFirst({
                where: {
                    id: itemId,
                    foodLog: {
                        userId,
                    },
                },
                include: {
                    foodLog: true,
                },
            });

            if (!item) {
                return res.status(404).json({
                    error: "Food log item not found",
                });
            }

            await prisma.foodLogItem.delete({
                where: {
                    id: itemId,
                },
            });

            /*
             * If a meal no longer has any food items,
             * remove the empty FoodLog as well.
             */

            const remainingItems =
                await prisma.foodLogItem.count({
                    where: {
                        foodLogId: item.foodLogId,
                    },
                });

            if (remainingItems === 0) {
                await prisma.foodLog.delete({
                    where: {
                        id: item.foodLogId,
                    },
                });
            }

            return res.json({
                message: "Food item removed successfully",
            });
        } catch (error) {
            console.error(
                "DELETE /api/food/log/item/:itemId error:",
                error
            );

            return res.status(500).json({
                error: "Failed to remove food item",
            });
        }
    }
);

export default router;