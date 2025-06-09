import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

type EmailAliasResult = {
  email: string;
  error?: string;
};

/**
 * Generates a unique email alias for a user
 * Format: username-xxxx where xxxx is a random 6-character string
 */
export async function generateEmailAlias(userId: string, email: string): Promise<EmailAliasResult> {
  try {
    // Extract the username part before @ and clean it
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const emailAlias = `${username}@newsletterhub.com`;
    
    // Save to the database
    const { error } = await supabase
      .from('users')
      .update({ email_alias: emailAlias })
      .eq('id', userId);
    
    if (error) {
      console.error('Error saving email alias:', error);
      return { email: '', error: 'Failed to save email alias' };
    }
    
    return { email: emailAlias };
  } catch (error) {
    console.error('Error generating email alias:', error);
    return { email: '', error: 'Failed to generate email alias' };
  }
}

/**
 * Gets or creates an email alias for a user
 */
export async function getUserEmailAlias(user: User): Promise<string> {
  try {
    // First check if user already has an email alias
    const { data: userData } = await supabase
      .from('users')
      .select('email_alias')
      .eq('id', user.id)
      .single();
    
    // If we got the user data and they have an alias, return it
    if (userData?.email_alias) {
      return userData.email_alias;
    }
    
    // If no alias exists, generate a new one
    if (!user.email) {
      throw new Error('User email not found');
    }
    const { email, error: genError } = await generateEmailAlias(user.id, user.email);
    
    if (genError || !email) {
      throw new Error(genError || 'Failed to generate email alias');
    }
    
    return email;
  } catch (error) {
    console.error('Error in getUserEmailAlias:', error);
    throw error;
  }
}

/**
 * Updates a user's email alias
 */
export async function updateEmailAlias(userId: string, newAlias: string): Promise<EmailAliasResult> {
  try {
    // Validate the new alias format
    if (!newAlias.endsWith('@newsletterhub.com')) {
      return { email: '', error: 'Invalid email alias format' };
    }
    
    // Check if the alias is already taken
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email_alias', newAlias)
      .neq('id', userId)
      .single();
    
    if (data) {
      return { email: '', error: 'This email alias is already taken' };
    }
    
    // Update the user's email alias
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_alias: newAlias })
      .eq('id', userId);
    

    if (updateError) {
      console.error('Error updating user with email alias:', updateError);
      return { email: '', error: 'Error saving email alias' };
    }

    return { email: `${newAlias}@newsletterhub.com` };
  } catch (error) {
    console.error('Error in getUserEmailAlias:', error);
    return { email: '', error: 'Internal server error' };
  }
}
