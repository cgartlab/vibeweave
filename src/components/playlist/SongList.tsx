import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SongItem, { type Song } from './SongItem';

interface SongListProps {
  songs: Song[];
  onReorder: (songIds: string[]) => void;
  onLockToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Wrapper that makes each SongItem sortable via useSortable */
function SortableSongItem({
  song,
  index,
  onLockToggle,
  onDelete,
}: {
  song: Song;
  index: number;
  onLockToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SongItem
        song={song}
        index={index}
        onLockToggle={onLockToggle}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={{
          ref: setActivatorNodeRef,
          ...listeners,
        }}
      />
    </div>
  );
}

export default function SongList({ songs, onReorder, onLockToggle, onDelete }: SongListProps) {
  const [localSongs, setLocalSongs] = useState<Song[]>(songs);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync with external songs prop
  useEffect(() => {
    setLocalSongs(songs);
  }, [songs]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      setLocalSongs((prevSongs) => {
        const oldIndex = prevSongs.findIndex((s) => s.id === active.id);
        const newIndex = prevSongs.findIndex((s) => s.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return prevSongs;

        const reordered = arrayMove(prevSongs, oldIndex, newIndex);

        // Debounce the onReorder callback (300ms)
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          onReorder(reordered.map((s) => s.id));
        }, 300);

        return reordered;
      });
    },
    [onReorder]
  );

  const songIds = localSongs.map((s) => s.id);

  if (localSongs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-vw-border py-16">
        <svg
          className="mb-4 h-12 w-12 text-vw-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <p className="text-sm font-medium text-vw-text-secondary">No songs yet</p>
        <p className="mt-1 text-xs text-vw-text-muted">
          Import a playlist to get started
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={songIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {localSongs.map((song, index) => (
            <SortableSongItem
              key={song.id}
              song={song}
              index={index}
              onLockToggle={onLockToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
