import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define types for claimable balances
export interface ClaimableBalance {
  id: number;
  created_at: string;
  user_address: string;
  balance_id: string;
  claimed: boolean;
  amount?: string;
  asset_type?: string;
}

// API functions for claimable balances
export const claimableBalancesApi = {
  /**
   * Get all claimable balances for a user
   * @param userAddress - The user's public key
   * @returns Array of claimable balances
   */
  async getUserClaimableBalances(userAddress: string): Promise<ClaimableBalance[]> {
    try {

      const { data, error } = await supabase
        .from('claimable_balances')
        .select('*')
        .eq('user_address', userAddress)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching claimable balances:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getUserClaimableBalances:', error);
      throw error;
    }
  },
  
  /**
   * Add a new claimable balance to the database
   * @param userAddress - The user's public key
   * @param balanceId - The Stellar claimable balance ID
   * @param amount - The amount of the claimable balance
   * @returns The newly created claimable balance
   */
  async addClaimableBalance(
    userAddress: string,
    balanceId: string,
    amount?: string,
  ): Promise<ClaimableBalance> {
    try {
      const { data, error } = await supabase
        .from('claimable_balances')
        .insert([
          {
            user_address: userAddress,
            balance_id: balanceId,
            amount,
            claimed: false
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error('Error adding claimable balance:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error in addClaimableBalance:', error);
      throw error;
    }
  },
  
  /**
   * Mark a claimable balance as claimed
   * @param balanceId - The database ID of the claimable balance
   * @returns The updated claimable balance
   */
  async markBalanceAsClaimed(balanceId: string): Promise<ClaimableBalance> {
    try {
      const { data, error } = await supabase
        .from('claimable_balances')
        .update({ claimed: true })
        .eq('balance_id', balanceId)
        .select()
        .single();
      
      if (error) {
        console.error('Error marking balance as claimed:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error in markBalanceAsClaimed:', error);
      throw error;
    }
  },
  
  /**
   * Get a specific claimable balance by its ID
   * @param balanceId - The database ID of the claimable balance
   * @returns The claimable balance
   */
  async getClaimableBalanceById(balanceId: number): Promise<ClaimableBalance | null> {
    try {
      const { data, error } = await supabase
        .from('claimable_balances')
        .select('*')
        .eq('balance_id', balanceId)
        .single();
      
      if (error) {
        console.error('Error fetching claimable balance:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error in getClaimableBalanceById:', error);
      throw error;
    }
  }
};
