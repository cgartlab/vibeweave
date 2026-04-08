import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';

interface Tag {
  id: string;
  tag_name: string;
  tag_type: 'emotion' | 'vibe';
  color: string;
}

interface SongTaggerProps {
  songId: string;
  currentTags: Tag[];
  allTags: Tag[];
}

export default function SongTagger({ songId, currentTags, allTags }: SongTaggerProps) {
  const [localTags, setLocalTags] = useState<Tag[]>(currentTags);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with props
  useEffect(() => {
    setLocalTags(currentTags);
  }, [currentTags]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter out tags already assigned
  const assignedIds = new Set(localTags.map(t => t.id));
  const availableTags = allTags.filter(
    t => !assignedIds.has(t.id) && t.tag_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssign = async (tag: Tag) => {
    // Optimistic update
    setLocalTags(prev => [...prev, tag]);
    setDropdownOpen(false);
    setSearchQuery('');
    setAssigning(true);

    try {
      const { error } = await supabase
        .from('song_tags')
        .insert({
          song_id: songId,
          tag_id: tag.id,
        });

      if (error) throw error;
    } catch {
      // Rollback on error
      setLocalTags(prev => prev.filter(t => t.id !== tag.id));
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (tagId: string) => {
    const tagToRemove = localTags.find(t => t.id === tagId);
    if (!tagToRemove) return;

    // Optimistic update
    setLocalTags(prev => prev.filter(t => t.id !== tagId));
    setRemoving(tagId);

    try {
      const { error } = await supabase
        .from('song_tags')
        .delete()
        .eq('song_id', songId)
        .eq('tag_id', tagId);

      if (error) throw error;
    } catch {
      // Rollback on error
      setLocalTags(prev => [...prev, tagToRemove]);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* Current tags as pills */}
      {localTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {localTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white transition-opacity"
              style={{
                backgroundColor: tag.color,
                opacity: removing === tag.id ? 0.5 : 1,
              }}
            >
              {tag.tag_name}
              <button
                onClick={() => handleRemove(tag.id)}
                disabled={removing === tag.id}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-white/20 disabled:pointer-events-none"
                aria-label={`移除标签 ${tag.tag_name}`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(prev => !prev)}
          disabled={assigning}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--vw-border)] px-3 py-1.5 text-xs text-[var(--vw-text-muted)] transition-colors hover:border-[var(--vw-accent)]/40 hover:text-[var(--vw-text-secondary)] disabled:pointer-events-none disabled:opacity-40"
        >
          {assigning ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
          添加标签
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-elevated)] shadow-xl shadow-black/20">
            {/* Search input */}
            <div className="border-b border-[var(--vw-border)] p-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索标签..."
                className="w-full rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg-input)] px-3 py-1.5 text-xs text-[var(--vw-text)] placeholder-[var(--vw-text-muted)] outline-none focus:border-[var(--vw-accent)]"
                autoFocus
              />
            </div>

            {/* Tag list */}
            <div className="max-h-48 overflow-y-auto p-1.5">
              {availableTags.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-[var(--vw-text-muted)]">
                    {searchQuery ? '没有匹配的标签' : '所有标签已添加'}
                  </p>
                </div>
              ) : (
                availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleAssign(tag)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--vw-bg-input)]"
                  >
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 truncate text-xs text-[var(--vw-text)]">
                      {tag.tag_name}
                    </span>
                    <span className={`text-[10px] font-medium ${
                      tag.tag_type === 'emotion' ? 'text-blue-400' : 'text-emerald-400'
                    }`}>
                      {tag.tag_type === 'emotion' ? '情绪' : '氛围'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
