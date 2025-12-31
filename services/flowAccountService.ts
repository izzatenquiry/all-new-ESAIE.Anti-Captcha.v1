import { supabase, type Database } from './supabaseClient';

type FlowAccountRow = Database['public']['Tables']['ultra_ai_email_pool']['Row'];
type FlowAccountInsert = Database['public']['Tables']['ultra_ai_email_pool']['Insert'];
type FlowAccountUpdate = Database['public']['Tables']['ultra_ai_email_pool']['Update'];

export interface FlowAccount {
  id: number;
  email: string;
  password: string;
  code: string;
  current_users_count: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'An unknown error occurred';
};

/**
 * Get all flow accounts
 */
export const getAllFlowAccounts = async (): Promise<FlowAccount[]> => {
  try {
    const { data, error } = await supabase
      .from('ultra_ai_email_pool')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching flow accounts:', error);
      return [];
    }

    return (data || []) as FlowAccount[];
  } catch (error) {
    console.error('Exception fetching flow accounts:', getErrorMessage(error));
    return [];
  }
};

/**
 * Add a new flow account
 */
export const addFlowAccount = async (
  email: string,
  password: string,
  code: string
): Promise<{ success: true; account: FlowAccount } | { success: false; message: string }> => {
  try {
    // Check if code already exists
    const { data: existing } = await supabase
      .from('ultra_ai_email_pool')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return { success: false, message: `Code ${code} already exists` };
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('ultra_ai_email_pool')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (existingEmail) {
      return { success: false, message: 'Email already exists in pool' };
    }

    const newAccount: FlowAccountInsert = {
      email: email.trim().toLowerCase(),
      password: password,
      code: code,
      current_users_count: 0,
      status: 'active',
    };

    const { data, error } = await supabase
      .from('ultra_ai_email_pool')
      .insert(newAccount)
      .select()
      .single();

    if (error || !data) {
      return { success: false, message: getErrorMessage(error) };
    }

    return { success: true, account: data as FlowAccount };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
};

/**
 * Update flow account
 */
export const updateFlowAccount = async (
  id: number,
  updates: Partial<Pick<FlowAccount, 'email' | 'password' | 'status'>>
): Promise<{ success: true; account: FlowAccount } | { success: false; message: string }> => {
  try {
    const updateData: FlowAccountUpdate = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('ultra_ai_email_pool')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return { success: false, message: getErrorMessage(error) };
    }

    return { success: true, account: data as FlowAccount };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
};

/**
 * Remove flow account (set status to inactive)
 */
export const removeFlowAccount = async (
  id: number
): Promise<{ success: boolean; message?: string }> => {
  try {
    const { error } = await supabase
      .from('ultra_ai_email_pool')
      .update({ 
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: getErrorMessage(error) };
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
};

/**
 * Get flow account by code
 */
export const getFlowAccountByCode = async (
  code: string
): Promise<{ success: true; account: FlowAccount } | { success: false; message: string }> => {
  try {
    const { data, error } = await supabase
      .from('ultra_ai_email_pool')
      .select('*')
      .eq('code', code)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return { success: false, message: 'Flow account not found' };
    }

    return { success: true, account: data as FlowAccount };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
};

/**
 * Get email and password from email_code
 * Email code is now the same as flow account code (E1, E2, E3, etc.)
 */
export const getEmailPasswordFromCode = async (
  emailCode: string
): Promise<{ success: true; account: FlowAccount } | { success: false; message: string }> => {
  try {
    if (!emailCode || emailCode.length < 2) {
      return { success: false, message: 'Invalid email code' };
    }

    // Email code is now the same as flow account code (E1, E2, E3, etc.)
    // No need to extract base code anymore
    const baseCode = emailCode;
    
    const { data, error } = await supabase
      .from('ultra_ai_email_pool')
      .select('email, password')
      .eq('code', baseCode)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return { success: false, message: 'Flow account not found for this code' };
    }

    return {
      success: true,
      account: data as FlowAccount
    };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
};

/**
 * Assign email code to user (E1, E2, E3, etc.)
 * If flowAccountCode is provided, assign to that specific account
 * Otherwise, find the first available account with space
 */
export const assignEmailCodeToUser = async (
  userId: string,
  flowAccountCode?: string
): Promise<{ success: true; emailCode: string; email: string; password: string } | { success: false; message: string }> => {
  try {
    let availableEmail: FlowAccount | null = null;

    if (flowAccountCode) {
      // Manual assign: use the specified flow account
      const { data, error } = await supabase
        .from('ultra_ai_email_pool')
        .select('*')
        .eq('code', flowAccountCode)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return { success: false, message: `Flow account ${flowAccountCode} not found or inactive` };
      }

      if (data.current_users_count >= 10) {
        return { success: false, message: `Flow account ${flowAccountCode} is full (10/10 users)` };
      }

      availableEmail = data as FlowAccount;
    } else {
      // Auto assign: find first available account
      const { data, error: findError } = await supabase
        .from('ultra_ai_email_pool')
        .select('*')
        .eq('status', 'active')
        .lt('current_users_count', 10)
        .order('current_users_count', { ascending: true })
        .order('code', { ascending: true })
        .limit(1)
        .single();

      if (findError || !data) {
        return { success: false, message: 'No available flow account. Please add more accounts.' };
      }

      availableEmail = data as FlowAccount;
    }

    if (!availableEmail) {
      return { success: false, message: 'No available flow account found.' };
    }

    // Always use base code directly (E1, E2, E3, etc.) - same as flow account code
    // Limit is enforced by current_users_count in flow account (max 10)
    const nextCode = availableEmail.code;

    // Update user's email_code
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_code: nextCode })
      .eq('id', userId);

    if (updateError) {
      return { success: false, message: getErrorMessage(updateError) };
    }

    // Increment current_users_count in email pool
    const { error: incrementError } = await supabase
      .from('ultra_ai_email_pool')
      .update({ 
        current_users_count: availableEmail.current_users_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', availableEmail.id);

    if (incrementError) {
      console.error('Failed to increment user count:', incrementError);
      // Don't fail the assignment if increment fails
    }

    return {
      success: true,
      emailCode: nextCode,
      email: availableEmail.email,
      password: availableEmail.password
    };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
};

/**
 * Reset email code from user (clear email_code and decrement user count)
 */
export const resetEmailCodeFromUser = async (
  userId: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    // Get user's current email_code
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email_code')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, message: 'User not found' };
    }

    if (!user.email_code) {
      return { success: false, message: 'User does not have an email code assigned' };
    }

    // Email code is now the same as flow account code (E1, E2, E3, etc.)
    const baseCode = user.email_code;

    // Find the flow account
    const { data: flowAccount } = await supabase
      .from('ultra_ai_email_pool')
      .select('*')
      .eq('code', baseCode)
      .eq('status', 'active')
      .single();

    // Clear email_code from user
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_code: null })
      .eq('id', userId);

    if (updateError) {
      return { success: false, message: getErrorMessage(updateError) };
    }

    // Decrement user count if flow account exists
    if (flowAccount && flowAccount.current_users_count > 0) {
      const { error: decrementError } = await supabase
        .from('ultra_ai_email_pool')
        .update({ 
          current_users_count: flowAccount.current_users_count - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', flowAccount.id);

      if (decrementError) {
        console.error('Failed to decrement user count:', decrementError);
        // Don't fail the reset if decrement fails
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
};
