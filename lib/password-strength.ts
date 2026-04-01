/**
 * Password strength levels
 */
export type PasswordStrength = "weak" | "fair" | "good" | "strong";

/**
 * Calculate password strength based on multiple criteria
 * 
 * Criteria:
 * - Length: 6-7 (weak), 8-11 (fair), 12-15 (good), 16+ (strong)
 * - Uppercase letters: +1 point
 * - Lowercase letters: +1 point
 * - Numbers: +1 point
 * - Special characters: +1 point
 * 
 * Score mapping:
 * - 1-2 points: Weak
 * - 3 points: Fair
 * - 4 points: Good
 * - 5+ points: Strong
 */
export function calculatePasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
  feedback: string;
} {
  let score = 0;
  const feedback: string[] = [];

  if (!password) {
    return {
      strength: "weak",
      score: 0,
      feedback: "Enter a password",
    };
  }

  // Length scoring
  if (password.length >= 6 && password.length < 8) {
    score += 1;
    feedback.push("Length is acceptable");
  } else if (password.length >= 8 && password.length < 12) {
    score += 2;
    feedback.push("Good length");
  } else if (password.length >= 12 && password.length < 16) {
    score += 2;
    feedback.push("Great length");
  } else if (password.length >= 16) {
    score += 2;
    feedback.push("Excellent length");
  } else {
    feedback.push("Too short (min 6 characters)");
  }

  // Character variety scoring
  if (/[A-Z]/.test(password)) {
    score += 1;
    feedback.push("Has uppercase letters");
  }

  if (/[a-z]/.test(password)) {
    score += 1;
    feedback.push("Has lowercase letters");
  }

  if (/[0-9]/.test(password)) {
    score += 1;
    feedback.push("Has numbers");
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
    feedback.push("Has special characters");
  }

  // Determine strength level
  let strength: PasswordStrength = "weak";
  if (score <= 2) {
    strength = "weak";
  } else if (score === 3) {
    strength = "fair";
  } else if (score === 4) {
    strength = "good";
  } else {
    strength = "strong";
  }

  return {
    strength,
    score,
    feedback: feedback.slice(0, 2).join(", "),
  };
}

/**
 * Get color for password strength level
 */
export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "#EF4444"; // red
    case "fair":
      return "#F59E0B"; // orange
    case "good":
      return "#FBBF24"; // yellow
    case "strong":
      return "#22C55E"; // green
    default:
      return "#9BA1A6"; // gray
  }
}

/**
 * Get label for password strength level
 */
export function getPasswordStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "Weak";
    case "fair":
      return "Fair";
    case "good":
      return "Good";
    case "strong":
      return "Strong";
    default:
      return "Unknown";
  }
}
