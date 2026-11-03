
import { GoogleGenAI } from "@google/genai";

/* ----------------------------------
   Input Data Interface
---------------------------------- */

export interface NutritionAIInput {
    profile: {
        age: number | null;
        currentWeight: number | null;
        goalType: string | null;
        targetWeight: number | null;
        calorieTarget: number | null;
        proteinTarget: number | null;
        weeklyBudget: number | null;
        allergies: string[];
        dietaryPreferences: string[];
    };

    summary: {
        averageCalories: number;
        averageProtein: number;
        loggedDays: number;
    };

    dailyData: {
        day: string;
        calories: number;
        protein: number;
    }[];

    mealBreakdown: {
        BREAKFAST: number;
        LUNCH: number;
        DINNER: number;
        SNACK: number;
    };
}

/* ----------------------------------
   AI Response Interface
---------------------------------- */

export interface NutritionAIResult {
    weeklyOverview: string;
    strengths: string[];
    areasToImprove: string[];
    recommendations: string[];
    sriLankanFoodSuggestions: string[];
    nextWeekPlan: string[];
    disclaimer: string;
}

/* ----------------------------------
   Delay Helper
---------------------------------- */

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/* ----------------------------------
   Gemini API with Timeout and Retry
---------------------------------- */

async function generateWithRetry(
    ai: GoogleGenAI,
    prompt: string
) {
    const maxAttempts = 3;
    const timeoutMs = 120000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            console.log(
                `Gemini API request: Attempt ${attempt}/${maxAttempts}`
            );

            const response = await Promise.race([
                ai.models.generateContent({
                    model: "gemini-3.8-flash",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        temperature: 0.4,
                        maxOutputTokens: 1200,
                    },
                }),

                new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error("GEMINI_REQUEST_TIMEOUT"));
                    }, timeoutMs);
                }),
            ]);

            console.log("Gemini AI response received successfully.");

            return response;

        } catch (error: any) {
            const status = error?.status ?? error?.code;

            // Handle timeout
            if (error?.message === "GEMINI_REQUEST_TIMEOUT") {
                console.error("Gemini API request timed out.");

                throw new Error(
                    "Gemini took too long to respond. Please try again."
                );
            }

            console.error(
                `Gemini API attempt ${attempt} failed:`,
                status || error?.message
            );

            // Retry only temporary service-unavailable errors
            if (Number(status) !== 503 || attempt === maxAttempts) {
                throw error;
            }

            const waitTime = attempt * 5000;

            console.log(
                `Gemini is temporarily unavailable. Retrying in ${waitTime / 1000} seconds...`
            );

            await delay(waitTime);

        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    throw new Error(
        "Gemini service is temporarily unavailable. Please try again later."
    );
}

/* ----------------------------------
   Generate Nutrition Insights
---------------------------------- */

export async function generateNutritionInsights(
    input: NutritionAIInput
): Promise<NutritionAIResult> {

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured in .env");
    }

    const ai = new GoogleGenAI({
        apiKey,
    });

    /* ----------------------------------
       Gemini Prompt
    ---------------------------------- */

    const prompt = `
You are PlateWise, a friendly and responsible nutrition wellness assistant.

Analyze the user's actual nutrition data and provide practical,
personalized general wellness guidance.

USER NUTRITION DATA:

${JSON.stringify(input, null, 2)}

IMPORTANT RULES:

1. Base your analysis only on the supplied data.
2. Do not invent missing measurements or food logs.
3. Consider the user's goal, allergies and dietary preferences.
4. Suggest affordable and familiar Sri Lankan foods where appropriate.
5. Respect all listed allergies and dietary preferences.
6. Do not recommend extreme diets, starvation or unsafe weight changes.
7. Do not diagnose diseases or prescribe medical treatment.
8. If there are not enough logged days, clearly mention this limitation.
9. Do not claim a goal was achieved unless the supplied data supports it.
10. Use simple, encouraging English.
11. Keep recommendations practical and specific.
12. Do not assume eating more calories or protein is always better.
13. Do not make unsupported health claims.
14. If information is missing, explain that it is unavailable.

Return ONLY valid JSON using exactly this structure:

{
    "weeklyOverview": "A short overview of the user's nutrition this week.",

    "strengths": [
        "A positive nutrition habit based on the data."
    ],

    "areasToImprove": [
        "An area that could be improved based on the data."
    ],

    "recommendations": [
        "A practical personalized recommendation."
    ],

    "sriLankanFoodSuggestions": [
        "An affordable Sri Lankan food suggestion."
    ],

    "nextWeekPlan": [
        "A realistic action for next week."
    ],

    "disclaimer": "A short reminder that this is general wellness guidance and not professional medical advice."
}

Make sure the response is valid JSON.
`;

    /* ----------------------------------
       Generate AI Response
    ---------------------------------- */

    const response = await generateWithRetry(ai, prompt);

    const responseText = response.text;

    if (!responseText) {
        throw new Error("Gemini returned an empty response.");
    }

    /* ----------------------------------
       Parse JSON Response
    ---------------------------------- */

    let parsed: any;

    try {
        parsed = JSON.parse(responseText);
    } catch {
        console.error("Gemini returned invalid JSON:", responseText);

        throw new Error("Gemini returned an invalid JSON response.");
    }

    /* ----------------------------------
       Validate Response Structure
    ---------------------------------- */

    if (
        typeof parsed.weeklyOverview !== "string" ||
        !Array.isArray(parsed.strengths) ||
        !Array.isArray(parsed.areasToImprove) ||
        !Array.isArray(parsed.recommendations) ||
        !Array.isArray(parsed.sriLankanFoodSuggestions) ||
        !Array.isArray(parsed.nextWeekPlan) ||
        typeof parsed.disclaimer !== "string"
    ) {
        throw new Error("Gemini returned an invalid response format.");
    }

    const listFields = [
        "strengths",
        "areasToImprove",
        "recommendations",
        "sriLankanFoodSuggestions",
        "nextWeekPlan",
    ];

    for (const field of listFields) {
        if (
            !parsed[field].every(
                (item: unknown) => typeof item === "string"
            )
        ) {
            throw new Error(`Invalid AI response field: ${field}`);
        }
    }

    return parsed as NutritionAIResult;
}
