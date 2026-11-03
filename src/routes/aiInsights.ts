
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { generateNutritionInsights } from "../services/geminiService.js";

const router = Router();

router.use(requireAuth);

router.post("/weekly", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        // Get the last 7 calendar days, including today.
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 6);

        const endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        const [profile, logs] = await Promise.all([
            prisma.profile.findUnique({
                where: { userId },
                select: {
                    age: true,
                    currentWeight: true,
                    goalType: true,
                    targetWeight: true,
                    calorieTarget: true,
                    proteinTarget: true,
                    weeklyBudget: true,
                    allergies: true,
                    dietaryPreferences: true,
                },
            }),

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
        ]);

        if (!profile) {
            return res.status(404).json({
                error: "User profile not found",
            });
        }

        // Create seven daily entries, including days without food logs.
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

        const loggedDays = dailyData.filter(
            (day) => day.calories > 0 || day.protein > 0
        ).length;

        const aiResult = await generateNutritionInsights({
            profile,
            summary: {
                averageCalories: Number((totalCalories / 7).toFixed(1)),
                averageProtein: Number((totalProtein / 7).toFixed(1)),
                loggedDays,
            },
            dailyData: dailyData.map((day) => ({
                day: day.day,
                calories: Number(day.calories.toFixed(1)),
                protein: Number(day.protein.toFixed(1)),
            })),
            mealBreakdown,
        });

        return res.json({
            success: true,
            period: {
                startDate,
                endDate,
                days: 7,
            },
            insights: aiResult,
        });
    } catch (error) {
        console.error("AI weekly insights error:", error);

        return res.status(500).json({
            error: "Unable to generate AI nutrition insights. Please try again.",
        });
    }
});

export default router;
