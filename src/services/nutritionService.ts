export type GoalType = "gain" | "lose" | "maintain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";
export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export type NutritionPreviewInput = {
    heightCm: number;
    currentWeight: number;
    age: number;
    activityLevel: ActivityLevel;
    goalType?: GoalType;
    targetWeight?: number;
};

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
};

export function calculateBmi(weightKg: number, heightCm: number): number {
    const heightM = heightCm / 100;
    if (heightM <= 0 || weightKg <= 0) return 0;
    return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function bmiCategory(bmi: number): BmiCategory {
    if (bmi < 18.5) return "underweight";
    if (bmi < 25) return "normal";
    if (bmi < 30) return "overweight";
    return "obese";
}

export function bmiCategoryLabel(category: BmiCategory): string {
    if (category === "underweight") return "Underweight";
    if (category === "normal") return "Normal";
    if (category === "overweight") return "Overweight";
    return "Obese";
}

/** Starting suggestion only — not medical advice. */
export function suggestGoalType(bmi: number): GoalType {
    if (bmi < 18.5) return "gain";
    if (bmi < 25) return "maintain";
    return "lose";
}

/** Editable default: ±4 kg around current weight, or unchanged for maintain. */
export function suggestTargetWeight(
    currentWeight: number,
    heightCm: number,
    goalType: GoalType
): number {
    const heightM = heightCm / 100;

    const healthyMin = 18.5 * heightM * heightM;
    const healthyMax = 24.9 * heightM * heightM;

    if (goalType === "gain") {
        if (currentWeight < healthyMin) {
            return round1(Math.max(
                currentWeight + 4,
                healthyMin + 1
            ));
        }

        return round1(currentWeight + 4);
    }

    if (goalType === "lose") {
        if (currentWeight > healthyMax) {
            return round1(
                Math.max(
                    Math.min(currentWeight - 4, healthyMax),
                    30
                )
            );
        }

        return round1(
            Math.max(currentWeight - 4, 30)
        );
    }

    return round1(currentWeight);
}
/**
 * Mifflin-St Jeor without sex: average of male (+5) and female (−161) offsets.
 * TDEE from activity; simple surplus/deficit by goal. Tracking estimates only.
 */
export function estimateCalorieTarget(
    weightKg: number,
    heightCm: number,
    age: number,
    activityLevel: ActivityLevel,
    goalType: GoalType
): number {
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78;
    const tdee = bmr * ACTIVITY_MULTIPLIER[activityLevel];
    const adjustment = goalType === "gain" ? 400 : goalType === "lose" ? -400 : 0;
    return Math.max(1200, Math.round((tdee + adjustment) / 10) * 10);
}

export function estimateProteinTarget(weightKg: number, goalType: GoalType): number {
    const gramsPerKg = goalType === "maintain" ? 1.4 : 1.8;
    return Math.round(weightKg * gramsPerKg);
}

export function buildNutritionPreview(input: NutritionPreviewInput) {
    const bmi = calculateBmi(input.currentWeight, input.heightCm);
    const suggestedGoal = suggestGoalType(bmi);
    const goalType = input.goalType ?? suggestedGoal;
    const suggestedTargetWeight = suggestTargetWeight(input.currentWeight, input.heightCm, goalType);
    const targetWeight = input.targetWeight ?? suggestedTargetWeight;
    const suggestedCalories = estimateCalorieTarget(
        input.currentWeight,
        input.heightCm,
        input.age,
        input.activityLevel,
        goalType
    );
    const suggestedProtein = estimateProteinTarget(input.currentWeight, goalType);
    const category = bmiCategory(bmi);

    return {
        bmi,
        bmiCategory: category,
        bmiCategoryLabel: bmiCategoryLabel(category),
        suggestedGoal,
        goalType,
        suggestedTargetWeight,
        targetWeight,
        suggestedCalories,
        suggestedProtein,
        disclaimer:
            "These figures are simple tracking estimates for personal use, not medical advice or a diagnosis.",
    };
}

function round1(n: number): number {
    return Number(n.toFixed(1));
}
