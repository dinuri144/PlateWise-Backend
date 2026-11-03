import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthPayload = {
    userId: string;
    email: string;
};

export interface AuthRequest extends Request {
    user?: AuthPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ error: "JWT_SECRET not configured" });
        }

        const payload = jwt.verify(token, secret) as AuthPayload;
        req.user = { userId: payload.userId, email: payload.email };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}