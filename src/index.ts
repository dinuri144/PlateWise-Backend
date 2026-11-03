import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import foodRoutes from "./routes/food.js";
import foodLogRoutes from "./routes/foodLog.js";
import pantryRoutes from "./routes/pantry.js";
import recipeRoutes from "./routes/recipes.js";
import shoppingListRoutes from "./routes/shoppingList.js";
import aiInsightsRoutes from "./routes/aiInsights.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


// Health check route
app.get("/api/health", async (_req, res) => {
    try {
        await prisma.user.count();
        res.json({ ok: true, db: "connected", service: "platewise-api" });
    } catch (err: any) {
        console.error("DB ERROR FULL:", err);
        res.status(500).json({
            ok: false,
            db: "error",
            message: err.message,
            code: err.code,
            meta: err.meta
        });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/food-logs", foodLogRoutes);
app.use("/api/pantry", pantryRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/shopping-list", shoppingListRoutes);
app.use("/api/ai-insights", aiInsightsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`PlateWise API → http://localhost:${PORT}`);
});