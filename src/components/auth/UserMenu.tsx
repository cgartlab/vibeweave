import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    window.location.href = '/';
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url || null;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <a
          href="/login"
          className="rounded-lg px-4 py-2 text-sm font-medium text-vw-text-secondary transition-colors hover:text-vw-text"
        >
          Sign In
        </a>
        <a
          href="/login?tab=register"
          className="rounded-lg bg-vw-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vw-accent-hover"
        >
          Get Started
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-vw-bg-card"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-vw-border"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vw-accent text-xs font-bold text-white ring-2 ring-vw-border">
            {initials}
          </div>
        )}
        <span className="hidden text-sm font-medium text-vw-text sm:inline-block">
          {displayName}
        </span>
        <svg
          className={`h-4 w-4 text-vw-text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-vw-border bg-vw-bg-card p-2 shadow-xl">
            <div className="border-b border-vw-border px-3 py-2">
              <p className="truncate text-sm font-medium text-vw-text">
                {displayName}
              </p>
              <p className="truncate text-xs text-vw-text-muted">{user.email}</p>
            </div>

            <div className="py-1">
              <a
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-vw-text-secondary transition-colors hover:bg-vw-bg-input hover:text-vw-text"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </a>
              <a
                href="/settings"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-vw-text-secondary transition-colors hover:bg-vw-bg-input hover:text-vw-text"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </a>
            </div>

            <div className="border-t border-vw-border pt-1">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
