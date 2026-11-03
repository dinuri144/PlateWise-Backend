import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { isOnboardingComplete } from "../lib/onboarding.js";

const router = Router();

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function signToken(userId: string, email: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    return jwt.sign({ userId, email }, secret, { expiresIn: "7d" });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid email or password (min 6 chars)" });
        }

        const { email, password } = parsed.data;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, passwordHash },
            select: { id: true, email: true, createdAt: true },
        });

        const token = signToken(user.id, user.email);
        return res.status(201).json({
            message: "Registered successfully",
            user,
            profile: null,
            onboardingComplete: false,
            token,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Registration failed" });
    }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const profile = await prisma.profile.findUnique({
            where: { userId: user.id },
        });

        const token = signToken(user.id, user.email);
        return res.json({
            message: "Login successful",
            user: { id: user.id, email: user.email, createdAt: user.createdAt },
            profile,
            onboardingComplete: isOnboardingComplete(profile),
            token,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Login failed" });
    }
});

// GET /api/auth/me (protected route)
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { id: true, email: true, createdAt: true, profile: true },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { profile, ...userFields } = user;
        return res.json({
            user: userFields,
            profile,
            onboardingComplete: isOnboardingComplete(profile),
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to load user" });
    }
});

export default router;