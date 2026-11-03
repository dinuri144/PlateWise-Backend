
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { isOnboardingComplete } from "../lib/onboarding.js";
import {
    buildNutritionPreview,
    calculateBmi,
    bmiCategory,
    bmiCategoryLabel,
    type ActivityLevel,
    type GoalType,
} from "../services/nutritionService.js";

const router = Router();

const activityEnum = z.enum(["sedentary", "light", "moderate", "active"]);
const goalEnum = z.enum(["gain", "lose", "maintain"]);

// Dietary preferences accepted by PlateWise
const dietaryPreferenceEnum = z.enum([
    "vegetarian",
    "vegan",
    "gluten-free",
    "dairy-free",
    "pescatarian",
]);

// Allergy names are flexible because users may have different allergies.
const allergySchema = z
    .string()
    .trim()
    .min(1)
    .max(50);

const previewSchema = z.object({
    heightCm: z.number().positive(),
    currentWeight: z.number().positive(),
    age: z.number().int().min(13).max(120),
    activityLevel: activityEnum,
    goalType: goalEnum.optional(),
    targetWeight: z.number().positive().optional(),
});

const upsertSchema = z.object({
    age: z.number().int().min(13).max(120).optional().nullable(),
    heightCm: z.number().positive().optional().nullable(),
    currentWeight: z.number().positive().optional().nullable(),
    activityLevel: activityEnum.optional().nullable(),
    goalType: goalEnum.optional().nullable(),
    targetWeight: z.number().positive().optional().nullable(),
    calorieTarget: z.number().int().min(800).max(8000).optional().nullable(),
    proteinTarget: z.number().int().min(20).max(400).optional().nullable(),
    weeklyBudget: z.number().int().min(0).optional().nullable(),

    // New fields
    allergies: z.array(allergySchema).max(30).optional(),
    dietaryPreferences: z
        .array(dietaryPreferenceEnum)
        .max(10)
        .optional(),
});

router.use(requireAuth);

function withComputed(profile: {
    heightCm: number | null;
    currentWeight: number | null;
} | null) {
    if (!profile?.heightCm || !profile?.currentWeight) {
        return {
            bmi: null as number | null,
            bmiCategory: null,
            bmiCategoryLabel: null,
        };
    }

    const bmi = calculateBmi(profile.currentWeight, profile.heightCm);
    const category = bmiCategory(bmi);

    return {
        bmi,
        bmiCategory: category,
        bmiCategoryLabel: bmiCategoryLabel(category),
    };
}

// GET /api/profile
router.get("/", async (req: AuthRequest, res) => {
    try {
        const profile = await prisma.profile.findUnique({
            where: { userId: req.user!.userId },
        });

        const computed = withComputed(profile);

        return res.json({
            profile,
            onboardingComplete: isOnboardingComplete(profile),
            ...computed,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load profile" });
    }
});

// PUT /api/profile
router.put("/", async (req: AuthRequest, res) => {
    try {
        const parsed = upsertSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid profile fields",
                details: parsed.error.flatten(),
            });
        }

        const data = parsed.data;
        const userId = req.user!.userId;

        const profile = await prisma.profile.upsert({
            where: { userId },
            create: {
                userId,
                ...data,
            },
            update: data,
        });

        const computed = withComputed(profile);

        return res.json({
            profile,
            onboardingComplete: isOnboardingComplete(profile),
            ...computed,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to save profile" });
    }
});

// POST /api/profile/preview
router.post("/preview", async (req: AuthRequest, res) => {
    try {
        const parsed = previewSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: "Invalid preview fields",
            });
        }

        const preview = buildNutritionPreview({
            ...parsed.data,
            activityLevel: parsed.data.activityLevel as ActivityLevel,
            goalType: parsed.data.goalType as GoalType | undefined,
        });

        return res.json(preview);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: "Failed to preview estimates",
        });
    }
});

export default router;
