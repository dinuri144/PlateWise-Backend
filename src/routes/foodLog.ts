import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const mealTypeEnum = z.enum([
    "BREAKFAST",
    "LUNCH",
    "DINNER",
    "SNACK",
]);

/*
|--------------------------------------------------------------------------
| GET /api/food-logs/today
|--------------------------------------------------------------------------
| Returns today's food logs with all items and daily totals.
*/
router.get("/today", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const logs = await prisma.foodLog.findMany({
            where: {
                userId,
                date: {
                    gte: start,
                    lte: end,
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
                createdAt: "asc",
            },
        });

        const totals = logs.reduce(
            (acc, log) => {
                for (const item of log.items) {
                    acc.calories += item.calories;
                    acc.protein += item.protein;
                }

                return acc;
            },
            {
                calories: 0,
                protein: 0,
            }
        );

        return res.json({
            logs,
            totals: {
                calories: Number(totals.calories.toFixed(1)),
                protein: Number(totals.protein.toFixed(1)),
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: "Failed to load today's food logs",
        });
    }
});


/*
|--------------------------------------------------------------------------
| GET /api/food-logs/weekly
|--------------------------------------------------------------------------
| Returns nutrition insights for the last 7 days.
*/
router.get("/weekly", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        // Start from 6 days ago, including today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 6);

        const endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        const [logs, profile] = await Promise.all([
            prisma.foodLog.findMany({
                where: {
                    userId,
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                include: {
                    items: true,
                },
                orderBy: {
                    date: "asc",
                },
            }),

            prisma.profile.findUnique({
                where: { userId },
                select: {
                    calorieTarget: true,
                    proteinTarget: true,
                },
            }),
        ]);

        const dailyData = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);

            const dateKey = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                String(date.getDate()).padStart(2, "0"),
            ].join("-");

            return {
                date: dateKey,
                day: date.toLocaleDateString("en-US", {
                    weekday: "short",
                }),
                calories: 0,
                protein: 0,
                mealsLogged: 0,
            };
        });

        const dailyMap = new Map(
            dailyData.map((day) => [day.date, day])
        );

        const mealBreakdown = {
            BREAKFAST: 0,
            LUNCH: 0,
            DINNER: 0,
            SNACK: 0,
        };

        for (const log of logs) {
            const dateKey = [
                log.date.getFullYear(),
                String(log.date.getMonth() + 1).padStart(2, "0"),
                String(log.date.getDate()).padStart(2, "0"),
            ].join("-");

            const day = dailyMap.get(dateKey);

            if (!day) continue;

            day.mealsLogged += 1;

            for (const item of log.items) {
                day.calories += item.calories;
                day.protein += item.protein;

                mealBreakdown[log.mealType] += item.calories;
            }
        }

        const totalCalories = dailyData.reduce(
            (sum, day) => sum + day.calories,
            0
        );

        const totalProtein = dailyData.reduce(
            (sum, day) => sum + day.protein,
            0
        );

        const averageCalories = totalCalories / 7;
        const averageProtein = totalProtein / 7;

        const calorieTarget = profile?.calorieTarget ?? null;
        const proteinTarget = profile?.proteinTarget ?? null;

        const calorieGoalDays = calorieTarget
            ? dailyData.filter(
                (day) => day.calories >= calorieTarget
            ).length
            : 0;

        const proteinGoalDays = proteinTarget
            ? dailyData.filter(
                (day) => day.protein >= proteinTarget
            ).length
            : 0;

        return res.json({
            period: {
                startDate,
                endDate,
                days: 7,
            },
            summary: {
                totalCalories: Number(totalCalories.toFixed(1)),
                totalProtein: Number(totalProtein.toFixed(1)),
                averageCalories: Number(averageCalories.toFixed(1)),
                averageProtein: Number(averageProtein.toFixed(1)),
                loggedDays: dailyData.filter(
                    (day) => day.mealsLogged > 0
                ).length,
            },
            goals: {
                calorieTarget,
                proteinTarget,
                calorieGoalDays,
                proteinGoalDays,
            },
            dailyData: dailyData.map((day) => ({
                ...day,
                calories: Number(day.calories.toFixed(1)),
                protein: Number(day.protein.toFixed(1)),
            })),
            mealBreakdown,
        });
    } catch (err) {
        console.error("Weekly insights error:", err);

        return res.status(500).json({
            error: "Failed to load weekly insights",
        });
    }
});


/*
|--------------------------------------------------------------------------
| GET /api/foods
|--------------------------------------------------------------------------
| Search available foods.
|
| Example:
| /api/foods?search=egg
|--------------------------------------------------------------------------
*/
router.get("/foods", async (req: AuthRequest, res) => {
    try {
        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim()
                : "";

        const userId = req.user!.userId;

        const foods = await prisma.food.findMany({
            where: {
                AND: [
                    search
                        ? {
                            name: {
                                contains: search,
                                mode: "insensitive",
                            },
                        }
                        : {},
                    {
                        OR: [
                            { userId: null },
                            { userId },
                        ],
                    },
                ],
            },
            orderBy: {
                name: "asc",
            },
            take: 30,
        });

        return res.json(foods);
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: "Failed to search foods",
        });
    }
});

/*
|--------------------------------------------------------------------------
| POST /api/food-logs
|--------------------------------------------------------------------------
| Create a food log.
|--------------------------------------------------------------------------
*/

const createLogSchema = z.object({
    mealType: mealTypeEnum,
    date: z.string().optional(),
    notes: z.string().max(500).optional(),
    items: z
        .array(
            z.object({
                foodId: z.string().min(1),
                grams: z.number().positive(),
            })
        )
        .min(1),
});

router.post("/", async (req: AuthRequest, res) => {
    try {
        const parsed = createLogSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid food log data",
            });
        }

        const userId = req.user!.userId;

        const { mealType, date, notes, items } = parsed.data;

        const foodIds = items.map((item) => item.foodId);

        const foods = await prisma.food.findMany({
            where: {
                id: {
                    in: foodIds,
                },
                OR: [
                    { userId: null },
                    { userId },
                ],
            },
        });

        if (foods.length !== foodIds.length) {
            return res.status(400).json({
                error: "One or more foods could not be found",
            });
        }

        const foodMap = new Map(
            foods.map((food) => [food.id, food])
        );

        const calculatedItems = items.map((item) => {
            const food = foodMap.get(item.foodId)!;

            const multiplier =
                item.grams / food.servingGrams;

            return {
                foodId: food.id,
                quantity: item.grams,
                unit: "g",
                grams: item.grams,
                calories: Number(
                    (food.calories * multiplier).toFixed(2)
                ),
                protein: Number(
                    (food.protein * multiplier).toFixed(2)
                ),
            };
        });

        const log = await prisma.foodLog.create({
            data: {
                userId,
                date: date ? new Date(date) : new Date(),
                mealType,
                notes: notes || null,
                items: {
                    create: calculatedItems,
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

        return res.status(201).json(log);
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: "Failed to create food log",
        });
    }
});

/*
|--------------------------------------------------------------------------
| DELETE /api/food-logs/:id
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const logId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;

        const log = await prisma.foodLog.findFirst({
            where: {
                id: logId,
                userId,
            },
        });

        if (!log) {
            return res.status(404).json({
                error: "Food log not found",
            });
        }

        await prisma.foodLog.delete({
            where: {
                id: logId,
            },
        });

        return res.json({
            message: "Food log deleted successfully",
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: "Failed to delete food log",
        });
    }
});

export default router;