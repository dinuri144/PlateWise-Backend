
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

// Normalize food names for comparison.
function normalizeName(value: string): string {
    const name = value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    // Common singular/plural variations.
    const aliases: Record<string, string> = {
        eggs: "egg",
        tomatoes: "tomato",
        potatoes: "potato",
        onions: "onion",
        carrots: "carrot",
        apples: "apple",
        bananas: "banana",
        oranges: "orange",
        lemons: "lemon",
        beans: "bean",
        chilies: "chili",
    };

    return aliases[name] ?? name;
}

// Normalize different ways of writing units.
function normalizeUnit(value: string): string {
    const unit = value
        .trim()
        .toLowerCase()
        .replace(/\./g, "");

    const aliases: Record<string, string> = {
        // Weight
        g: "g",
        gram: "g",
        grams: "g",

        kg: "kg",
        kilogram: "kg",
        kilograms: "kg",

        mg: "mg",
        milligram: "mg",
        milligrams: "mg",

        // Volume
        ml: "ml",
        milliliter: "ml",
        milliliters: "ml",
        millilitre: "ml",
        millilitres: "ml",

        l: "l",
        liter: "l",
        liters: "l",
        litre: "l",
        litres: "l",

        // Count
        pc: "pcs",
        pcs: "pcs",
        piece: "pcs",
        pieces: "pcs",
        item: "pcs",
        items: "pcs",
        unit: "pcs",
        units: "pcs",
        egg: "pcs",
        eggs: "pcs",

        // Other common units
        tsp: "tsp",
        teaspoon: "tsp",
        teaspoons: "tsp",

        tbsp: "tbsp",
        tablespoon: "tbsp",
        tablespoons: "tbsp",

        cup: "cup",
        cups: "cup",
    };

    return aliases[unit] ?? unit;
}

// Convert quantities into a common base unit.
// kg -> g, L -> ml, mg -> g.
function convertToBase(quantity: number, unit: string) {
    const normalizedUnit = normalizeUnit(unit);

    switch (normalizedUnit) {
        case "kg":
            return {
                quantity: quantity * 1000,
                unit: "g",
            };

        case "g":
            return {
                quantity,
                unit: "g",
            };

        case "mg":
            return {
                quantity: quantity / 1000,
                unit: "g",
            };

        case "l":
            return {
                quantity: quantity * 1000,
                unit: "ml",
            };

        case "ml":
            return {
                quantity,
                unit: "ml",
            };

        default:
            return {
                quantity,
                unit: normalizedUnit,
            };
    }
}

// --------------------------------------------------
// GET - Get all shopping items
// --------------------------------------------------

router.get("/", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const items = await (prisma as any).shoppingItem.findMany({
            where: { userId },
            orderBy: [
                { isPurchased: "asc" },
                { createdAt: "desc" },
            ],
        });

        res.json(items);
    } catch (error) {
        console.error("Get shopping list error:", error);

        res.status(500).json({
            error: "Failed to fetch shopping list",
        });
    }
});

// --------------------------------------------------
// POST - Add a manual shopping item
// --------------------------------------------------


router.post("/", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const schema = z.object({
            name: z.string().trim().min(1).max(100),
            quantity: z.number().positive().nullable().optional(),
            unit: z.string().trim().min(1).max(30).default("item"),
        });

        const data = schema.parse(req.body);

        const normalizeName = (value: string) =>
            value.trim().toLowerCase().replace(/\s+/g, " ");

        const normalizeUnit = (value: string) => {
            const unit = value.trim().toLowerCase();

            const aliases: Record<string, string> = {
                gram: "g",
                grams: "g",
                kilogram: "kg",
                kilograms: "kg",
                millilitre: "ml",
                millilitres: "ml",
                milliliter: "ml",
                milliliters: "ml",
                litre: "l",
                litres: "l",
                liter: "l",
                liters: "l",
                pieces: "pcs",
                piece: "pcs",
                pc: "pcs",
                packs: "pack",
            };

            return aliases[unit] || unit;
        };

        // Convert pantry quantity into the requested shopping unit
        const convertQuantity = (
            quantity: number,
            fromUnit: string,
            toUnit: string
        ): number | null => {
            const from = normalizeUnit(fromUnit);
            const to = normalizeUnit(toUnit);

            if (from === to) return quantity;

            // Weight conversions
            if (from === "g" && to === "kg") return quantity / 1000;
            if (from === "kg" && to === "g") return quantity * 1000;

            // Volume conversions
            if (from === "ml" && to === "l") return quantity / 1000;
            if (from === "l" && to === "ml") return quantity * 1000;

            return null;
        };

        let finalQuantity = data.quantity ?? null;

        if (finalQuantity !== null) {
            const pantryItems = await (prisma as any).pantryItem.findMany({
                where: { userId },
            });

            const matchingPantryItems = pantryItems.filter(
                (item: any) =>
                    normalizeName(item.name) === normalizeName(data.name)
            );

            let availableQuantity = 0;

            for (const pantryItem of matchingPantryItems) {
                const converted = convertQuantity(
                    pantryItem.quantity,
                    pantryItem.unit,
                    data.unit
                );

                if (converted !== null) {
                    availableQuantity += converted;
                }
            }

            finalQuantity = Math.max(
                finalQuantity - availableQuantity,
                0
            );

            // The requested quantity is already available in the pantry
            if (finalQuantity <= 0) {
                return res.status(200).json({
                    alreadyAvailable: true,
                    message: `${data.name} is already available in your pantry.`,
                    item: null,
                });
            }
        }

        const item = await (prisma as any).shoppingItem.create({
            data: {
                userId,
                name: data.name,
                quantity: finalQuantity,
                unit: data.unit,
                source: "MANUAL",
                isPurchased: false,
                recipeNames: [],
            },
        });

        res.status(201).json({
            alreadyAvailable: false,
            message: "Shopping item added successfully.",
            item,
        });

    } catch (error) {
        console.error("Add shopping item error:", error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Invalid shopping item details",
                details: error.issues,
            });
        }

        res.status(500).json({
            error: "Failed to add shopping item",
        });
    }
});


// --------------------------------------------------
// PUT - Update a shopping item
// --------------------------------------------------

router.put("/:id", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        const schema = z.object({
            name: z.string().trim().min(1).max(100).optional(),
            quantity: z.number().positive().nullable().optional(),
            unit: z.string().trim().min(1).max(30).optional(),
            isPurchased: z.boolean().optional(),
        }).refine(
            (data) => Object.keys(data).length > 0,
            {
                message: "At least one field must be provided",
            }
        );

        const data = schema.parse(req.body);

        const existingItem = await (prisma as any).shoppingItem.findFirst({
            where: { id, userId },
        });

        if (!existingItem) {
            return res.status(404).json({
                error: "Shopping item not found",
            });
        }

        const item = await (prisma as any).shoppingItem.update({
            where: { id },
            data,
        });

        res.json(item);
    } catch (error) {
        console.error("Update shopping item error:", error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Invalid shopping item details",
                details: error.issues,
            });
        }

        res.status(500).json({
            error: "Failed to update shopping item",
        });
    }
});

// --------------------------------------------------
// DELETE - Delete a shopping item
// --------------------------------------------------

router.delete("/:id", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        const existingItem = await (prisma as any).shoppingItem.findFirst({
            where: { id, userId },
        });

        if (!existingItem) {
            return res.status(404).json({
                error: "Shopping item not found",
            });
        }

        await (prisma as any).shoppingItem.delete({
            where: { id },
        });

        res.json({
            message: "Shopping item deleted successfully",
        });
    } catch (error) {
        console.error("Delete shopping item error:", error);

        res.status(500).json({
            error: "Failed to delete shopping item",
        });
    }
});

// --------------------------------------------------
// POST - Generate shopping list from selected recipes
// --------------------------------------------------

router.post("/generate", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const schema = z.object({
            recipeIds: z.array(z.string().min(1)).min(1),
        });

        const { recipeIds } = schema.parse(req.body);

        // 1. Get selected recipes.
        const recipes = await (prisma as any).recipe.findMany({
            where: {
                id: { in: recipeIds },
                isActive: true,
                OR: [
                    { userId: null },
                    { userId },
                ],
            },
            include: {
                ingredients: true,
            },
        });

        if (recipes.length === 0) {
            return res.status(404).json({
                error: "No valid recipes found",
            });
        }

        // 2. Get user's pantry items.
        const pantryItems = await (prisma as any).pantryItem.findMany({
            where: { userId },
        });

        // 3. Combine recipe ingredients.
        // Quantities are stored in normalized base units.
        const ingredientMap = new Map<
            string,
            {
                name: string;
                unit: string;
                quantity: number;
                recipeNames: Set<string>;
            }
        >();

        for (const recipe of recipes) {
            for (const ingredient of recipe.ingredients) {
                if (ingredient.isOptional) {
                    continue;
                }

                const name = normalizeName(ingredient.ingredientName);

                const converted = convertToBase(
                    ingredient.quantity,
                    ingredient.unit
                );

                const unit = converted.unit;
                const key = `${name}::${unit}`;

                const existing = ingredientMap.get(key);

                if (existing) {
                    existing.quantity += converted.quantity;
                    existing.recipeNames.add(recipe.name);
                } else {
                    ingredientMap.set(key, {
                        name: ingredient.ingredientName.trim(),
                        unit,
                        quantity: converted.quantity,
                        recipeNames: new Set([recipe.name]),
                    });
                }
            }
        }

        // 4. Get existing recipe-generated shopping items.
        // Manual shopping items are not overwritten.
        const existingRecipeItems =
            await (prisma as any).shoppingItem.findMany({
                where: {
                    userId,
                    source: "RECIPE",
                },
            });

        const generatedItems = [];
        const skippedItems = [];

        // 5. Compare recipe requirements with pantry quantities.
        for (const ingredient of ingredientMap.values()) {
            const matchingPantryItems = pantryItems.filter(
                (pantryItem: any) => {
                    const pantryName = normalizeName(pantryItem.name);

                    const pantryUnit = convertToBase(
                        pantryItem.quantity,
                        pantryItem.unit
                    ).unit;

                    return (
                        pantryName === normalizeName(ingredient.name) &&
                        pantryUnit === ingredient.unit
                    );
                }
            );

            // Calculate total available pantry quantity.
            const availableQuantity = matchingPantryItems.reduce(
                (total: number, item: any) => {
                    const converted = convertToBase(
                        item.quantity,
                        item.unit
                    );

                    return total + converted.quantity;
                },
                0
            );

            // Calculate only the missing quantity.
            const missingQuantity = Math.max(
                ingredient.quantity - availableQuantity,
                0
            );

            // If pantry has enough, skip this ingredient.
            if (missingQuantity <= 0) {
                skippedItems.push({
                    name: ingredient.name,
                    reason: "Already available in pantry",
                });

                continue;
            }

            const recipeNames = Array.from(ingredient.recipeNames);

            // 6. Find an existing generated item with same name and unit.
            const existingItem = existingRecipeItems.find(
                (item: any) =>
                    normalizeName(item.name) ===
                    normalizeName(ingredient.name) &&
                    convertToBase(
                        item.quantity ?? 0,
                        item.unit
                    ).unit === ingredient.unit
            );

            let item;

            if (existingItem) {
                // Update quantity instead of adding it again.
                // This prevents duplicate quantities when Generate
                // is clicked multiple times.
                item = await (prisma as any).shoppingItem.update({
                    where: { id: existingItem.id },
                    data: {
                        quantity: missingQuantity,
                        unit: ingredient.unit,
                        isPurchased: false,
                        source: "RECIPE",
                        recipeNames: Array.from(
                            new Set([
                                ...existingItem.recipeNames,
                                ...recipeNames,
                            ])
                        ),
                    },
                });
            } else {
                // Create a new generated shopping item.
                item = await (prisma as any).shoppingItem.create({
                    data: {
                        userId,
                        name: ingredient.name,
                        quantity: missingQuantity,
                        unit: ingredient.unit,
                        isPurchased: false,
                        source: "RECIPE",
                        recipeNames,
                    },
                });
            }

            generatedItems.push(item);
        }

        // 7. Send response.
        res.json({
            message: "Shopping list generated successfully",

            selectedRecipes: recipes.map(
                (recipe: any) => recipe.name
            ),

            generatedCount: generatedItems.length,
            skippedCount: skippedItems.length,

            generatedItems,
            skippedItems,
        });
    } catch (error) {
        console.error("Generate shopping list error:", error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Invalid recipe selection",
                details: error.issues,
            });
        }

        res.status(500).json({
            error: "Failed to generate shopping list",
        });
    }
});

export default router;
