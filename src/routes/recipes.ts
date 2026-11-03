
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);


function normalizeFoodName(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function ingredientMatches(first: string, second: string) {
    const a = normalizeFoodName(first);
    const b = normalizeFoodName(second);

    return a === b || a.includes(b) || b.includes(a);
}

// GET /api/recipes/recommendations
// Personalized recipes based on profile, allergies and pantry items.
router.get("/recommendations", async (req: AuthRequest, res) => {
    try {
        const userId =
            (req as any).user?.userId ??
            (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                error: "User authentication information not found",
            });
        }

        // 1. Get user's profile
        const profile = await (prisma as any).profile.findUnique({
            where: { userId },
        });

        if (!profile) {
            return res.status(404).json({
                error: "User profile not found",
            });
        }

        // 2. Get user's pantry items
        const pantryItems = await (prisma as any).pantryItem.findMany({
            where: { userId },
            select: {
                name: true,
                quantity: true,
                expiryDate: true,
            },
        });

        // 3. Get active recipes with ingredients
        const recipes = await (prisma as any).recipe.findMany({
            where: { isActive: true },
            include: { ingredients: true },
        });

        const allergies: string[] = (profile.allergies ?? [])
            .map(normalizeFoodName)
            .filter(Boolean);

        const preferences: string[] = (
            profile.dietaryPreferences ?? []
        ).map(normalizeFoodName);

        const availableIngredients: string[] = pantryItems
            .filter((item: any) => item.quantity > 0)
            .map((item: any) => item.name);

        // 4. Filter and score recipes
        const recommendations = recipes
            .map((recipe: any) => {
                const ingredientNames: string[] =
                    recipe.ingredients.map(
                        (ingredient: any) => ingredient.ingredientName
                    );

                // Check explicit allergens and ingredient names
                const recipeAllergens: string[] = [
                    ...(recipe.allergens ?? []),
                    ...ingredientNames,
                ];

                const hasAllergy = allergies.some((allergy) =>
                    recipeAllergens.some((item) =>
                        ingredientMatches(allergy, item)
                    )
                );

                // Exclude recipes that contain known allergens
                if (hasAllergy) {
                    return null;
                }

                // Dietary preferences must be supported by recipe tags
                const recipeTags: string[] = (
                    recipe.dietaryTags ?? []
                ).map(normalizeFoodName);

                const matchesPreferences = preferences.every(
                    (preference) => recipeTags.includes(preference)
                );

                if (!matchesPreferences) {
                    return null;
                }

                // Find ingredients available in the user's pantry
                const matchedIngredients = ingredientNames.filter(
                    (ingredient) =>
                        availableIngredients.some((pantryName) =>
                            ingredientMatches(ingredient, pantryName)
                        )
                );

                const totalIngredients = ingredientNames.filter(
                    (_ingredient: string, index: number) =>
                        !recipe.ingredients[index].isOptional
                ).length;

                const pantryMatchPercentage =
                    totalIngredients > 0
                        ? Math.round(
                            (matchedIngredients.filter((ingredient) =>
                                recipe.ingredients.some(
                                    (item: any) =>
                                        item.ingredientName === ingredient &&
                                        !item.isOptional
                                )
                            ).length /
                                totalIngredients) *
                            100
                        )
                        : 0;

                // Nutrition suitability score
                let nutritionScore = 0;

                const calorieTarget = profile.calorieTarget ?? 0;
                const proteinTarget = profile.proteinTarget ?? 0;

                // Approximate one meal as one-third of daily targets.
                const mealCalorieTarget = calorieTarget / 3;
                const mealProteinTarget = proteinTarget / 3;

                if (mealCalorieTarget > 0) {
                    const calorieDifference = Math.abs(
                        recipe.caloriesPerServing - mealCalorieTarget
                    );

                    nutritionScore += Math.max(
                        0,
                        20 - (calorieDifference / mealCalorieTarget) * 20
                    );
                }

                if (mealProteinTarget > 0) {
                    const proteinDifference = Math.abs(
                        recipe.proteinPerServing - mealProteinTarget
                    );

                    nutritionScore += Math.max(
                        0,
                        20 - (proteinDifference / mealProteinTarget) * 20
                    );
                }

                // Pantry matching score
                const pantryScore = pantryMatchPercentage * 0.4;

                // Goal-based adjustment
                let goalScore = 0;

                if (
                    profile.goalType === "gain" &&
                    proteinTarget > 0 &&
                    recipe.proteinPerServing >= mealProteinTarget
                ) {
                    goalScore = 10;
                } else if (
                    profile.goalType === "lose" &&
                    mealCalorieTarget > 0 &&
                    recipe.caloriesPerServing <= mealCalorieTarget
                ) {
                    goalScore = 10;
                } else if (profile.goalType === "maintain") {
                    goalScore = 10;
                }

                const matchScore = Math.min(
                    100,
                    Math.round(
                        pantryScore + nutritionScore + goalScore
                    )
                );

                const matchReasons: string[] = [];

                if (matchedIngredients.length > 0) {
                    matchReasons.push(
                        `${matchedIngredients.length} pantry ingredients available`
                    );
                }

                if (
                    proteinTarget > 0 &&
                    recipe.proteinPerServing >= mealProteinTarget
                ) {
                    matchReasons.push("Good protein contribution");
                }

                if (profile.goalType) {
                    matchReasons.push(
                        `Considered your ${profile.goalType} goal`
                    );
                }

                if (preferences.length > 0) {
                    matchReasons.push(
                        "Matches your dietary preferences"
                    );
                }

                return {
                    ...recipe,
                    matchScore,
                    matchedIngredients,
                    pantryMatchPercentage,
                    matchReasons,
                };
            })
            .filter(Boolean)
            .sort(
                (a: any, b: any) => b.matchScore - a.matchScore
            );

        return res.json({
            count: recommendations.length,
            recommendations,
            profileSummary: {
                goalType: profile.goalType,
                calorieTarget: profile.calorieTarget,
                proteinTarget: profile.proteinTarget,
                allergies: profile.allergies ?? [],
                dietaryPreferences: profile.dietaryPreferences ?? [],
            },
        });
    } catch (error) {
        console.error("RECIPE RECOMMENDATIONS ERROR:", error);

        return res.status(500).json({
            error: "Failed to generate recipe recommendations",
        });
    }
});

// GET /api/recipes
// Optional filters: ?mealType=BREAKFAST and ?search=rice
router.get("/", async (req: AuthRequest, res) => {
    try {
        const validMealTypes = [
            "BREAKFAST",
            "LUNCH",
            "DINNER",
            "SNACK",
        ] as const;

        const mealType =
            typeof req.query.mealType === "string"
                ? req.query.mealType.toUpperCase()
                : undefined;

        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim()
                : "";

        if (
            mealType &&
            !validMealTypes.includes(
                mealType as (typeof validMealTypes)[number]
            )
        ) {
            return res.status(400).json({
                error: "Invalid meal type",
            });
        }

        const recipes = await (prisma as any).recipe.findMany({
            where: {
                isActive: true,
                ...(mealType
                    ? {
                        mealType:
                            mealType as (typeof validMealTypes)[number],
                    }
                    : {}),
                ...(search
                    ? {
                        name: {
                            contains: search,
                            mode: "insensitive",
                        },
                    }
                    : {}),
            },
            include: {
                ingredients: true,
            },
            orderBy: {
                name: "asc",
            },
        });

        return res.json({
            count: recipes.length,
            recipes,
        });
    } catch (error) {
        console.error("GET RECIPES ERROR:", error);

        return res.status(500).json({
            error: "Failed to load recipes",
        });
    }
});

export default router;
