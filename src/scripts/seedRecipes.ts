
import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const recipeClient = (prisma as any).recipe;

const RECIPE_BOOK =
    "A Recipe Book of Traditional Sri Lankan Food (Adikari & Lakmali, 2016)";

const RECIPE_BOOK_URL =
    "https://doi.org/10.1016/j.profoo.2016.02.012";

const recipes = [
    {
        name: "Kiribath (Sri Lankan Milk Rice)",
        description:
            "Traditional Sri Lankan milk rice prepared with rice, coconut milk and water.",
        mealType: "BREAKFAST" as const,
        cuisine: "Sri Lankan",
        servings: 15,
        prepTimeMinutes: 40,
        servingSizeGrams: 55,
        caloriesPerServing: 105.4,
        proteinPerServing: 1.3,
        carbsPerServing: 10.5,
        fatPerServing: 6.7,
        instructions:
            "Wash the rice and cook it with water until soft. Add thick coconut milk and salt. Stir gently until the mixture becomes creamy. Spread the cooked rice on a flat tray, allow it to cool slightly and cut into pieces.",
        nutritionSource: RECIPE_BOOK,
        nutritionVerified: true,
        sourceName: RECIPE_BOOK,
        sourceUrl: RECIPE_BOOK_URL,
        dietaryTags: ["vegetarian", "gluten-free"],
        allergens: ["coconut"],
        ingredients: [
            { ingredientName: "White Rice", quantity: 500, unit: "g" },
            { ingredientName: "Thick Coconut Milk", quantity: 280, unit: "ml" },
            { ingredientName: "Water", quantity: 420, unit: "ml" },
            { ingredientName: "Salt", quantity: 2, unit: "g" },
        ],
    },
    {
        name: "Sri Lankan String Hoppers",
        description:
            "Steamed rice flour nests traditionally served with curry and coconut sambol.",
        mealType: "BREAKFAST" as const,
        cuisine: "Sri Lankan",
        servings: 2,
        prepTimeMinutes: 30,
        servingSizeGrams: null,
        caloriesPerServing: 220,
        proteinPerServing: 4,
        carbsPerServing: 48,
        fatPerServing: 1,
        instructions:
            "Place roasted rice flour in a bowl. Gradually add warm water and salt to make a soft dough. Fill a string hopper press with the dough and press into small circular nests on string hopper mats. Steam until cooked. Serve with dhal curry or coconut sambol.",
        nutritionSource: "Initial estimate - not yet verified",
        nutritionVerified: false,
        sourceName: "Original preparation based on traditional Sri Lankan method",
        sourceUrl: "https://www.srilanka.travel/culinary-tourism/food-range.php",
        dietaryTags: ["vegetarian"],
        allergens: [],
        ingredients: [
            { ingredientName: "Roasted Rice Flour", quantity: 250, unit: "g" },
            { ingredientName: "Water", quantity: 180, unit: "ml" },
            { ingredientName: "Salt", quantity: 2, unit: "g" },
        ],
    },
    {
        name: "Sri Lankan Pittu",
        description:
            "A traditional steamed food made with rice flour and grated coconut.",
        mealType: "BREAKFAST" as const,
        cuisine: "Sri Lankan",
        servings: 5,
        prepTimeMinutes: 30,
        servingSizeGrams: 15,
        caloriesPerServing: 55,
        proteinPerServing: 0.9,
        carbsPerServing: 8.3,
        fatPerServing: 2.2,
        instructions:
            "Mix rice flour with grated coconut and a pinch of salt. Sprinkle water gradually and mix until the flour forms small crumbs. Place the mixture into a pittu steamer in layers and steam until fully cooked. Serve with curry or coconut milk.",
        nutritionSource: RECIPE_BOOK,
        nutritionVerified: true,
        sourceName: RECIPE_BOOK,
        sourceUrl: RECIPE_BOOK_URL,
        dietaryTags: ["vegetarian"],
        allergens: ["coconut"],
        ingredients: [
            { ingredientName: "Rice Flour", quantity: 250, unit: "g" },
            { ingredientName: "Grated Coconut", quantity: 150, unit: "g" },
            { ingredientName: "Thick Coconut Milk", quantity: 70, unit: "ml" },
            { ingredientName: "Salt", quantity: 2, unit: "g" },
        ],
    },
    {
        name: "Polos Curry (Young Jackfruit Curry)",
        description:
            "A traditional Sri Lankan curry made with tender young jackfruit and spices.",
        mealType: "LUNCH" as const,
        cuisine: "Sri Lankan",
        servings: 1,
        prepTimeMinutes: 50,
        servingSizeGrams: 100,
        caloriesPerServing: 191.9,
        proteinPerServing: 2.7,
        carbsPerServing: 7.9,
        fatPerServing: 16.7,
        instructions:
            "Cut the tender jackfruit into small pieces. Mix with chilli powder, curry powder, turmeric, cinnamon, garlic, curry leaves and salt. Add thin coconut milk and cook until the jackfruit becomes tender. Add thick coconut milk and simmer until the curry thickens.",
        nutritionSource: RECIPE_BOOK,
        nutritionVerified: true,
        sourceName: RECIPE_BOOK,
        sourceUrl: RECIPE_BOOK_URL,
        dietaryTags: ["vegan", "vegetarian", "gluten-free"],
        allergens: ["coconut"],
        ingredients: [
            { ingredientName: "Tender Jackfruit (Polos)", quantity: 250, unit: "g" },
            { ingredientName: "Sliced Coconut", quantity: 14, unit: "g" },
            { ingredientName: "Red Onion", quantity: 9, unit: "g" },
            { ingredientName: "Chilli Powder", quantity: 9, unit: "g" },
            { ingredientName: "Curry Powder", quantity: 5, unit: "g" },
            { ingredientName: "Thick Coconut Milk", quantity: 350, unit: "ml" },
            { ingredientName: "Thin Coconut Milk", quantity: 240, unit: "ml" },
            { ingredientName: "Coconut Oil", quantity: 5, unit: "ml" },
            { ingredientName: "Curry Leaves", quantity: 1, unit: "g" },
            { ingredientName: "Cinnamon", quantity: 1, unit: "g" },
            { ingredientName: "Garcinia", quantity: 2, unit: "g" },
        ],
    },
    {
        name: "Hath Maluwa (Seven Vegetable Curry)",
        description:
            "A traditional Sri Lankan curry combining vegetables, legumes, coconut milk and spices.",
        mealType: "LUNCH" as const,
        cuisine: "Sri Lankan",
        servings: 1,
        prepTimeMinutes: 40,
        servingSizeGrams: 100,
        caloriesPerServing: 147.3,
        proteinPerServing: 3.8,
        carbsPerServing: 7.8,
        fatPerServing: 11.2,
        instructions:
            "Prepare and cut the vegetables into small pieces. Add pumpkin, kiriala, kangkung, mukunuwenna, cowpea and jackfruit seeds to a pot. Add coconut milk, onion, garlic, green chilli and spices. Cook gently until the vegetables and legumes are tender. Adjust salt and serve.",
        nutritionSource: RECIPE_BOOK,
        nutritionVerified: true,
        sourceName: RECIPE_BOOK,
        sourceUrl: RECIPE_BOOK_URL,
        dietaryTags: ["vegetarian", "gluten-free"],
        allergens: ["cashew", "coconut"],
        ingredients: [
            { ingredientName: "Pumpkin", quantity: 50, unit: "g" },
            { ingredientName: "Kiriala", quantity: 50, unit: "g" },
            { ingredientName: "Kangkung", quantity: 50, unit: "g" },
            { ingredientName: "Mukunuwenna", quantity: 50, unit: "g" },
            { ingredientName: "Cowpea", quantity: 50, unit: "g" },
            { ingredientName: "Cashew", quantity: 12, unit: "g" },
            { ingredientName: "Jackfruit Seeds", quantity: 25, unit: "g" },
            { ingredientName: "Coconut Milk", quantity: 140, unit: "ml" },
            { ingredientName: "Red Onion", quantity: 3, unit: "g" },
            { ingredientName: "Green Chilli", quantity: 5, unit: "g" },
            { ingredientName: "Garlic", quantity: 1, unit: "g" },
            { ingredientName: "Curry Leaves", quantity: 1, unit: "g" },
        ],
    },
    {
        name: "Gotukola Mallum",
        description:
            "A Sri Lankan leafy green dish prepared with gotukola, grated coconut and spices.",
        mealType: "LUNCH" as const,
        cuisine: "Sri Lankan",
        servings: 1,
        prepTimeMinutes: 15,
        servingSizeGrams: 50,
        caloriesPerServing: 70,
        proteinPerServing: 2.5,
        carbsPerServing: 5,
        fatPerServing: 4.5,
        instructions:
            "Wash gotukola thoroughly and chop it finely. Mix with grated coconut, chopped red onion, green chilli and a little salt. Add lime juice and mix well. Serve fresh as a side dish.",
        nutritionSource: "Initial estimate - not yet verified",
        nutritionVerified: false,
        sourceName: "Original preparation based on traditional Sri Lankan mallum",
        sourceUrl: RECIPE_BOOK_URL,
        dietaryTags: ["vegan", "vegetarian", "gluten-free"],
        allergens: ["coconut"],
        ingredients: [
            { ingredientName: "Gotukola", quantity: 50, unit: "g" },
            { ingredientName: "Grated Coconut", quantity: 25, unit: "g" },
            { ingredientName: "Red Onion", quantity: 9, unit: "g" },
            { ingredientName: "Green Chilli", quantity: 5, unit: "g" },
            { ingredientName: "Lime Juice", quantity: 5, unit: "ml" },
        ],
    },
    {
        name: "Kola Kenda (Sri Lankan Herbal Porridge)",
        description:
            "A traditional herbal porridge made with green leaves, red rice and coconut milk.",
        mealType: "BREAKFAST" as const,
        cuisine: "Sri Lankan",
        servings: 3,
        prepTimeMinutes: 15,
        servingSizeGrams: 240,
        caloriesPerServing: 139,
        proteinPerServing: 2.8,
        carbsPerServing: 12.7,
        fatPerServing: 8.7,
        instructions:
            "Wash the red rice and cook it with water until soft. Wash the edible green leaves, blend them with water and strain the juice. Add coconut milk to the cooked rice and stir. Add the strained green leaf juice and salt. Heat gently and serve warm.",
        nutritionSource: "Nestlé Sri Lanka - Kola Kenda recipe",
        nutritionVerified: true,
        sourceName: "Nestlé Sri Lanka",
        sourceUrl: "https://www.nestle.lk/en/cooking/recipes/breakfast-recipes/kola-kenda",
        dietaryTags: ["vegetarian", "gluten-free"],
        allergens: ["coconut"],
        ingredients: [
            { ingredientName: "Edible Green Leaves", quantity: 2, unit: "cups" },
            { ingredientName: "Coconut Milk", quantity: 360, unit: "ml" },
            { ingredientName: "Water", quantity: 240, unit: "ml" },
            { ingredientName: "Red Rice", quantity: 2, unit: "tbsp" },
            { ingredientName: "Salt", quantity: 2, unit: "g" },
        ],
    },
];

async function main() {
    for (const recipe of recipes) {
        const { ingredients, ...recipeData } = recipe;

        const existing = await recipeClient.findFirst({
            where: {
                name: recipe.name,
                userId: null,
            },
        });

        if (existing) {
            await recipeClient.update({
                where: { id: existing.id },
                data: {
                    ...recipeData,
                    ingredients: {
                        deleteMany: {},
                        create: ingredients,
                    },
                },
            });

            console.log(`Updated recipe: ${recipe.name}`);
        } else {
            await recipeClient.create({
                data: {
                    ...recipeData,
                    ingredients: {
                        create: ingredients,
                    },
                },
            });

            console.log(`Added recipe: ${recipe.name}`);
        }
    }

    console.log("Sri Lankan recipe seeding completed!");
}

main()
    .catch((error) => {
        console.error("Recipe seeding failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
