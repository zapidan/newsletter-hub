import { User } from "@supabase/supabase-js";
import { userApi } from "../api/userApi";

type EmailAliasResult = {
  email: string;
  error?: string;
};

/**
 * Generates a unique email alias for a user
 * Format: username-xxxx where xxxx is a random 6-character string
 */
export async function generateEmailAlias(
  email: string,
): Promise<EmailAliasResult> {
  try {
    return await userApi.generateEmailAlias(email);
  } catch (error) {
    console.error("Error generating email alias:", error);
    return { email: "", error: "Failed to generate email alias" };
  }
}

/**
 * Gets or creates an email alias for a user
 */
export async function getUserEmailAlias(): Promise<string> {
  try {
    return await userApi.getEmailAlias();
  } catch (error) {
    console.error("Error in getUserEmailAlias:", error);
    throw error;
  }
}

/**
 * Updates a user's email alias
 */
export async function updateEmailAlias(
  newAlias: string,
): Promise<EmailAliasResult> {
  try {
    return await userApi.updateEmailAlias(newAlias);
  } catch (error) {
    console.error("Error in updateEmailAlias:", error);
    return { email: "", error: "Internal server error" };
  }
}
