import { supabase } from './supabase/client';
import type { User, Session } from '@supabase/supabase-js';

/**
 * Get the current authenticated session.
 * Returns null if no active session exists.
 */
export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error.message);
    return null;
  }

  return session;
}

/**
 * Get the current authenticated user.
 * Returns null if no user is logged in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Error getting current user:', error.message);
    return null;
  }

  return user;
}

/**
 * Sign out the current user.
 * Returns true if sign out was successful, false otherwise.
 */
export async function signOut(): Promise<boolean> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error.message);
    return false;
  }

  return true;
}

/**
 * Check if the current user is authenticated.
 * Returns true if a valid session exists.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Subscribe to authentication state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => subscription.unsubscribe();
}

/**
 * Higher-order function for protecting routes that require authentication.
 * Can be used in Astro middleware or page frontmatter.
 *
 * @example
 * // In an Astro page frontmatter:
 * const session = await withAuth(Astro.request);
 * if (!session) return Astro.redirect('/login');
 */
export async function withAuth(request: Request): Promise<Session | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return session;
}

/**
 * Get the user's profile from the user_profiles table.
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error.message);
    return null;
  }

  return data;
}

/**
 * Update the user's profile in the user_profiles table.
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    display_name?: string;
    avatar_url?: string;
    preferred_platform?: string;
  }
) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user profile:', error.message);
    return null;
  }

  return data;
}
