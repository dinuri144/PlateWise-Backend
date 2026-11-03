import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
    requireAuth,
    AuthRequest,
} from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const EXPIRY_WARNING_DAYS = 7;

// Validate date-only strings without timezone conversion.
const expiryDateSchema = z
    .string()
    .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Expiry date must use YYYY-MM-DD format."
    )
    .refine((value) => {
        const [year, month, day] = value.split("-").map(Number);

        const date = new Date(
            Date.UTC(year, month - 1, day)
        );

        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        );
    }, "Please enter a valid expiry date.");

function getSriLankaTodayUTC(): number {
    const dateParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const year = Number(
        dateParts.find((part) => part.type === "year")?.value
    );

    const month = Number(
        dateParts.find((part) => part.type === "month")?.value
    );

    const day = Number(
        dateParts.find((part) => part.type === "day")?.value
    );

    return Date.UTC(year, month - 1, day);
}

function getStoredExpiryDay(expiryDate: Date): number {
    const date = new Date(expiryDate);

    return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
    );
}

function parseExpiryDate(
    expiryDate: string | null | undefined
): Date | null {
    if (!expiryDate) {
        return null;
    }

    // Store date-only values at UTC midnight.
    return new Date(`${expiryDate}T00:00:00.000Z`);
}

// GET - Dashboard pantry summary

router.get("/summary", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const today = getSriLankaTodayUTC();

        const sevenDaysLater =
            today + EXPIRY_WARNING_DAYS * DAY_IN_MILLISECONDS;

        const [
            totalItems,
            itemsWithExpiry,
        ] = await Promise.all([
            (prisma as any).pantryItem.count({
                where: { userId },
            }),

            (prisma as any).pantryItem.findMany({
                where: {
                    userId,
                    expiryDate: {
                        not: null,
                    },
                },
                select: {
                    expiryDate: true,
                },
            }),
        ]);

        let expiringSoon = 0;
        let expiredItems = 0;

        for (const item of itemsWithExpiry) {
            if (!item.expiryDate) {
                continue;
            }

            const expiryDay = getStoredExpiryDay(
                item.expiryDate
            );

            if (expiryDay < today) {
                expiredItems++;
            } else if (expiryDay <= sevenDaysLater) {
                expiringSoon++;
            }
        }

        return res.json({
            totalItems,
            expiringSoon,
            expiredItems,
        });
    } catch (error) {
        console.error("Pantry summary error:", error);

        return res.status(500).json({
            error: "Failed to fetch pantry summary.",
        });
    }
});

// GET - Get all pantry items belonging to logged-in user

router.get("/", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const items = await (prisma as any).pantryItem.findMany({
            where: {
                userId,
            },

            include: {
                food: true,
            },

            orderBy: [
                {
                    expiryDate: "asc",
                },
                {
                    createdAt: "desc",
                },
            ],
        });

        return res.json(items);
    } catch (error) {
        console.error("Get pantry items error:", error);

        return res.status(500).json({
            error: "Failed to fetch pantry items.",
        });
    }
});

// POST - Add a pantry item

router.post("/", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;

        const schema = z.object({
            name: z.string().trim().min(1).max(100),

            category: z
                .string()
                .trim()
                .nullable()
                .optional(),

            quantity: z.number().finite().positive(),

            unit: z.string().trim().min(1).max(20).default("g"),

            expiryDate: expiryDateSchema
                .nullable()
                .optional(),

            foodId: z.string().nullable().optional(),
        });

        const data = schema.parse(req.body);

        // Check whether the selected food exists
        // and belongs to the global food list or current user.

        if (data.foodId) {
            const food = await prisma.food.findFirst({
                where: {
                    id: data.foodId,

                    OR: [
                        {
                            userId: null,
                        },
                        {
                            userId,
                        },
                    ],
                },
            });

            if (!food) {
                return res.status(404).json({
                    error: "Food not found.",
                });
            }
        }

        const item = await (prisma as any).pantryItem.create({
            data: {
                userId,

                name: data.name,

                category: data.category || null,

                quantity: data.quantity,

                unit: data.unit,

                expiryDate: parseExpiryDate(
                    data.expiryDate
                ),

                foodId: data.foodId || null,
            },

            include: {
                food: true,
            },
        });

        return res.status(201).json(item);
    } catch (error) {
        console.error("Add pantry item error:", error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Invalid pantry item details.",
                details: error.issues,
            });
        }

        return res.status(500).json({
            error: "Failed to add pantry item.",
        });
    }
});

// PUT - Update a pantry item

router.put("/:id", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        const schema = z.object({
            name: z.string().trim().min(1).max(100).optional(),

            category: z
                .string()
                .trim()
                .nullable()
                .optional(),

            quantity: z.number().finite().positive().optional(),

            unit: z.string().trim().min(1).max(20).optional(),

            expiryDate: expiryDateSchema
                .nullable()
                .optional(),
        });

        const data = schema.parse(req.body);

        // Verify ownership before updating.

        const existingItem = await (prisma as any).pantryItem.findFirst({
            where: {
                id,
                userId,
            },
        });

        if (!existingItem) {
            return res.status(404).json({
                error: "Pantry item not found.",
            });
        }

        const updateData: Record<string, unknown> = {};

        if (data.name !== undefined) {
            updateData.name = data.name;
        }

        if (data.category !== undefined) {
            updateData.category = data.category;
        }

        if (data.quantity !== undefined) {
            updateData.quantity = data.quantity;
        }

        if (data.unit !== undefined) {
            updateData.unit = data.unit;
        }

        if (data.expiryDate !== undefined) {
            updateData.expiryDate = parseExpiryDate(
                data.expiryDate
            );
        }

        const item = await (prisma as any).pantryItem.update({
            where: {
                id,
            },

            data: updateData,

            include: {
                food: true,
            },
        });

        return res.json(item);
    } catch (error) {
        console.error("Update pantry item error:", error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Invalid pantry item details.",
                details: error.issues,
            });
        }

        return res.status(500).json({
            error: "Failed to update pantry item.",
        });
    }
});

// DELETE - Delete a pantry item

router.delete("/:id", async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.params;

        // Verify ownership before deleting.

        const existingItem = await (prisma as any).pantryItem.findFirst({
            where: {
                id,
                userId,
            },
        });

        if (!existingItem) {
            return res.status(404).json({
                error: "Pantry item not found.",
            });
        }

        await (prisma as any).pantryItem.delete({
            where: {
                id,
            },
        });

        return res.json({
            message: "Pantry item deleted successfully.",
        });
    } catch (error) {
        console.error("Delete pantry item error:", error);

        return res.status(500).json({
            error: "Failed to delete pantry item.",
        });
    }
});

export default router;