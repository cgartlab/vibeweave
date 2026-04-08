import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';

type TagType = 'emotion' | 'vibe';

interface Tag {
  id: string;
  user_id: string;
  tag_name: string;
  tag_type: TagType;
  color: string;
  created_at: string;
}

interface TagManagerProps {
  userId: string;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#78716c',
];

const TAG_TYPE_CONFIG: Record<TagType, { label: string; badgeBg: string; badgeText: string }> = {
  emotion: {
    label: '情绪',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
  },
  vibe: {
    label: '氛围',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400',
  },
};

export default function TagManager({ userId }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagType, setNewTagType] = useState<TagType>('emotion');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editType, setEditType] = useState<TagType>('emotion');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchTags = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('custom_tags')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTags(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载标签失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;

    setCreating(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('custom_tags')
        .insert({
          user_id: userId,
          tag_name: name,
          tag_type: newTagType,
          color: newTagColor,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setTags(prev => [data, ...prev]);
      setNewTagName('');
      setNewTagColor(PRESET_COLORS[0]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建标签失败';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (tagId: string) => {
    const name = editName.trim();
    if (!name) return;

    try {
      const { error: updateError } = await supabase
        .from('custom_tags')
        .update({
          tag_name: name,
          tag_type: editType,
          color: editColor,
        })
        .eq('id', tagId);

      if (updateError) throw updateError;

      setTags(prev =>
        prev.map(t =>
          t.id === tagId
            ? { ...t, tag_name: name, tag_type: editType, color: editColor }
            : t
        )
      );
      setEditingId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '更新标签失败';
      setError(message);
    }
  };

  const handleDelete = async (tagId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('custom_tags')
        .delete()
        .eq('id', tagId);

      if (deleteError) throw deleteError;

      setTags(prev => prev.filter(t => t.id !== tagId));
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除标签失败';
      setError(message);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.tag_name);
    setEditColor(tag.color);
    setEditType(tag.tag_type);
    setDeleteConfirmId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="h-5 w-5 animate-spin text-[var(--vw-accent)]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Create new tag form */}
      <div className="rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] p-4 space-y-3">
        <h3 className="text-sm font-medium text-[var(--vw-text)]">创建新标签</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="标签名称"
            maxLength={20}
            className="flex-1 rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg-input)] px-3 py-2 text-sm text-[var(--vw-text)] placeholder-[var(--vw-text-muted)] outline-none transition-colors focus:border-[var(--vw-accent)]"
          />
          <select
            value={newTagType}
            onChange={e => setNewTagType(e.target.value as TagType)}
            className="rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg-input)] px-3 py-2 text-sm text-[var(--vw-text)] outline-none transition-colors focus:border-[var(--vw-accent)]"
          >
            <option value="emotion">情绪</option>
            <option value="vibe">氛围</option>
          </select>
        </div>

        {/* Color picker */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setNewTagColor(color)}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                newTagColor === color ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              aria-label={`选择颜色 ${color}`}
            />
          ))}
        </div>

        {/* Preview and create button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: newTagColor }}
            >
              {newTagName || '预览'}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_TYPE_CONFIG[newTagType].badgeBg} ${TAG_TYPE_CONFIG[newTagType].badgeText}`}>
              {TAG_TYPE_CONFIG[newTagType].label}
            </span>
          </div>
          <button
            onClick={handleCreate}
            disabled={!newTagName.trim() || creating}
            className="rounded-lg bg-[var(--vw-accent)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--vw-accent-hover)] disabled:pointer-events-none disabled:opacity-40"
          >
            {creating ? '创建中...' : '创建'}
          </button>
        </div>
      </div>

      {/* Existing tags list */}
      <div className="rounded-xl border border-[var(--vw-border)] bg-[var(--vw-bg-card)] overflow-hidden">
        <div className="border-b border-[var(--vw-border)] px-4 py-2.5">
          <h3 className="text-sm font-medium text-[var(--vw-text)]">
            我的标签 ({tags.length})
          </h3>
        </div>

        {tags.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg className="mx-auto mb-2 h-8 w-8 text-[var(--vw-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            <p className="text-sm text-[var(--vw-text-muted)]">暂无自定义标签</p>
            <p className="mt-1 text-xs text-[var(--vw-text-muted)]">创建标签来更好地组织你的音乐</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--vw-border)]/50">
            {tags.map(tag => {
              const typeConfig = TAG_TYPE_CONFIG[tag.tag_type];
              const isEditing = editingId === tag.id;
              const isConfirmingDelete = deleteConfirmId === tag.id;

              return (
                <div key={tag.id} className="px-4 py-3">
                  {isEditing ? (
                    /* Edit mode */
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleUpdate(tag.id)}
                          maxLength={20}
                          className="flex-1 rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg-input)] px-3 py-1.5 text-sm text-[var(--vw-text)] outline-none focus:border-[var(--vw-accent)]"
                          autoFocus
                        />
                        <select
                          value={editType}
                          onChange={e => setEditType(e.target.value as TagType)}
                          className="rounded-lg border border-[var(--vw-border)] bg-[var(--vw-bg-input)] px-2 py-1.5 text-sm text-[var(--vw-text)] outline-none focus:border-[var(--vw-accent)]"
                        >
                          <option value="emotion">情绪</option>
                          <option value="vibe">氛围</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
                              editColor === color ? 'border-white scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(tag.id)}
                          className="rounded-md bg-[var(--vw-accent)] px-3 py-1 text-xs text-white hover:bg-[var(--vw-accent-hover)]"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-[var(--vw-border)] px-3 py-1 text-xs text-[var(--vw-text-secondary)] hover:bg-[var(--vw-bg-input)]"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="group flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.tag_name}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeConfig.badgeBg} ${typeConfig.badgeText}`}>
                          {typeConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEdit(tag)}
                          className="rounded-md p-1.5 text-[var(--vw-text-muted)] transition-colors hover:bg-[var(--vw-bg-input)] hover:text-[var(--vw-text-secondary)]"
                          aria-label="编辑标签"
                          title="编辑"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(tag.id)}
                              className="rounded-md bg-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/30"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded-md px-2 py-1 text-[10px] text-[var(--vw-text-muted)] hover:text-[var(--vw-text-secondary)]"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(tag.id)}
                            className="rounded-md p-1.5 text-[var(--vw-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                            aria-label="删除标签"
                            title="删除"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
