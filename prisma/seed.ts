import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
    connectionString,
});

const prisma = new PrismaClient({
    adapter,
});

const foods = [
    {
        name: "Egg",
        category: "Protein",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 155,
        protein: 13,
        carbs: 1.1,
        fat: 11,
    },
    {
        name: "Chicken Breast",
        category: "Protein",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
    },
    {
        name: "Dhal",
        category: "Legumes",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 116,
        protein: 9,
        carbs: 20,
        fat: 0.4,
    },
    {
        name: "Soya Chunks",
        category: "Protein",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 345,
        protein: 52,
        carbs: 33,
        fat: 0.5,
    },
    {
        name: "Rice",
        category: "Grains",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
    },
    {
        name: "Red Rice",
        category: "Grains",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 111,
        protein: 2.6,
        carbs: 23,
        fat: 0.9,
    },
    {
        name: "Milk",
        category: "Dairy",
        servingUnit: "100ml",
        servingGrams: 100,
        calories: 61,
        protein: 3.2,
        carbs: 4.8,
        fat: 3.3,
    },
    {
        name: "Banana",
        category: "Fruits",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
    },
    {
        name: "Oats",
        category: "Grains",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 389,
        protein: 16.9,
        carbs: 66.3,
        fat: 6.9,
    },
    {
        name: "Peanuts",
        category: "Nuts",
        servingUnit: "100g",
        servingGrams: 100,
        calories: 567,
        protein: 25.8,
        carbs: 16.1,
        fat: 49.2,
    },
];

async function main() {
    const foodModel = (prisma as any).food ?? (prisma as any).foods;

    if (!foodModel) {
        throw new Error(
            "No Prisma food model found. Ensure the schema defines a Food model and run `npx prisma generate`.",
        );
    }

    for (const food of foods) {
        await foodModel.upsert({
            where: {
                id: `seed-${food.name.toLowerCase().replace(/\s+/g, "-")}`,
            },
            update: food,
            create: {
                id: `seed-${food.name.toLowerCase().replace(/\s+/g, "-")}`,
                ...food,
                isCustom: false,
                userId: null,
            },
        });
    }

    console.log(`Seeded ${foods.length} foods.`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });