type ProfileLike = {
    heightCm: number | null;
    currentWeight: number | null;
    goalType: string | null;
    targetWeight: number | null;
    calorieTarget: number | null;
    proteinTarget: number | null;
} | null;

const VALID_GOALS = new Set(["gain", "lose", "maintain"]);

export function isOnboardingComplete(profile: ProfileLike): boolean {
    if (!profile) return false;
    if (profile.heightCm == null) return false;
    if (profile.currentWeight == null) return false;
    if (profile.goalType == null || !VALID_GOALS.has(profile.goalType)) return false;
    if (profile.targetWeight == null) return false;
    if (profile.calorieTarget == null) return false;
    if (profile.proteinTarget == null) return false;
    return true;
}
