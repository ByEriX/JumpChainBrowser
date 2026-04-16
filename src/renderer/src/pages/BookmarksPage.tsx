import { useEffect, useMemo, useState } from 'react';
import { BookmarkX, ExternalLink, Download, FolderOpen, Edit2, Check, X, Bookmark, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { useBookmarksStore } from '../stores/bookmarksStore';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import type { Bookmark as BookmarkType, FileSourceRecord, FileVariantRecord } from '../../../preload/types';

interface BookmarkItemProps {
  bookmark: BookmarkType;
  onRemove: () => void;
  onUpdateNotes: (notes: string) => void;
  onDownloadSuccess: () => Promise<void>;
}

function BookmarkItem({ bookmark, onRemove, onUpdateNotes, onDownloadSuccess }: BookmarkItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(bookmark.user_notes || '');
  const [isDownloading, setIsDownloading] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);

  const variants = useMemo<FileVariantRecord[]>(() => {
    if (bookmark.variants && bookmark.variants.length > 0) {
      return bookmark.variants;
    }

    return [{
      id: bookmark.file_id,
      name: bookmark.name || '',
      version_label: null,
      drive_id: '',
      drive_name: bookmark.drive_name || '',
      source: bookmark.source || '',
      web_view_link: bookmark.web_view_link || '',
      modified_time: bookmark.created_at,
      md5_checksum: null,
      size_bytes: null,
      thumbnail_path: null,
      folder_path: null,
      nsfw: 0,
      created_at: bookmark.created_at,
      sources: [{
        id: bookmark.file_id,
        drive_id: '',
        drive_name: bookmark.drive_name || '',
        source: bookmark.source || '',
        web_view_link: bookmark.web_view_link || '',
        modified_time: bookmark.created_at,
        md5_checksum: null,
        size_bytes: null
      }]
    }];
  }, [bookmark]);

  const activeVariant = variants[selectedVariantIndex] ?? variants[0];
  const activeSource = useMemo<FileSourceRecord | null>(() => {
    if (!activeVariant) {
      return null;
    }
    if (selectedSourceId) {
      return activeVariant.sources.find((source) => source.id === selectedSourceId) ?? activeVariant.sources[0] ?? null;
    }
    return activeVariant.sources[0] ?? null;
  }, [activeVariant, selectedSourceId]);

  const activeFileId = activeSource?.id ?? activeVariant?.id ?? bookmark.file_id;
  const activeFileName = activeVariant?.name || bookmark.name || 'document.pdf';
  const activeFileLink = activeSource?.web_view_link ?? activeVariant?.web_view_link ?? bookmark.web_view_link ?? '';
  const totalVariants = bookmark.variant_count ?? variants.length;
  const totalSources =
    bookmark.source_count ??
    variants.reduce((count, variant) => count + variant.sources.length, 0);

  useEffect(() => {
    let cancelled = false;

    window.electronAPI.getThumbnail(activeFileId).then((result) => {
      if (cancelled) return;

      if (result.path && result.path.length > 0) {
        setThumbnailUrl(result.path);
      } else {
        setThumbnailUrl(null);
      }
    }).catch((error) => {
      if (cancelled) return;
      console.error('Failed to load bookmark thumbnail:', error);
      setThumbnailUrl(null);
    });

    window.electronAPI.hasLocalCopy(activeFileId).then((result) => {
      if (cancelled) return;
      if (result.exists && result.path) {
        setDownloadedPath(result.path);
      } else {
        setDownloadedPath(null);
      }
    }).catch(() => {
      if (cancelled) return;
      setDownloadedPath(null);
    });

    return () => {
      cancelled = true;
    };
  }, [activeFileId]);

  useEffect(() => {
    setSelectedVariantIndex(0);
    setSelectedSourceId(null);
    setShowVariants(false);
  }, [bookmark.file_id]);

  const handleSaveNotes = () => {
    onUpdateNotes(notes);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setNotes(bookmark.user_notes || '');
    setIsEditing(false);
  };

  const handleDownload = async () => {
    if (downloadedPath) {
      await window.electronAPI.openFile(downloadedPath);
      return;
    }

    setIsDownloading(true);
    try {
      const path = await window.electronAPI.downloadFile(activeFileId, activeFileName);
      setDownloadedPath(path);
      await onDownloadSuccess();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenExternal = async () => {
    if (activeFileLink) {
      await window.electronAPI.openExternal(activeFileLink);
    }
  };

  const getSourceColor = (source?: string) => {
    switch (source) {
      case 'QQ': return 'bg-purple-500/20 text-purple-400';
      case 'SB': return 'bg-blue-500/20 text-blue-400';
      case 'Reddit': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="w-16 h-24 shrink-0 rounded-md border border-gray-700 bg-gray-900 overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={bookmark.name || 'Bookmarked file thumbnail'}
              className="w-full h-full object-cover"
              onError={() => setThumbnailUrl(null)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
              PDF
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            {activeSource?.source && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(activeSource.source)}`}>
                {activeSource.source}
              </span>
            )}
            {downloadedPath && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                Downloaded
              </span>
            )}
            {activeVariant?.version_label && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-500/20 text-primary-300">
                {activeVariant.version_label.toUpperCase()}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-gray-100 mb-1 truncate" title={activeFileName}>
            {activeFileName.replace('.pdf', '')}
          </h3>
          
          {/* Drive & Date */}
          <p className="text-sm text-gray-500 mb-3">
            {bookmark.drive_name} • Bookmarked {formatDate(bookmark.created_at)}
          </p>

          {(totalVariants > 1 || totalSources > 1) && (
            <button
              onClick={() => setShowVariants((current) => !current)}
              className="mb-3 w-full max-w-md flex items-center justify-between px-2 py-1.5 rounded bg-gray-700 text-xs text-gray-300 hover:bg-gray-600 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Layers size={13} />
                {totalVariants} version{totalVariants === 1 ? '' : 's'} · {totalSources} source{totalSources === 1 ? '' : 's'}
              </span>
              {showVariants ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {showVariants && (
            <div className="mb-3 space-y-2 max-h-56 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/60 p-2">
              {variants.map((variant, variantIndex) => {
                const isSelectedVariant = variant.id === activeVariant?.id;
                return (
                  <div
                    key={`${variant.id}-${variantIndex}`}
                    className={`rounded-lg border p-2 ${
                      isSelectedVariant ? 'border-primary-500 bg-primary-500/10' : 'border-gray-700 bg-gray-900/60'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedVariantIndex(variantIndex);
                        setSelectedSourceId(null);
                      }}
                      className="w-full text-left"
                    >
                      <p className="text-xs font-medium text-gray-100 truncate">{variant.name.replace('.pdf', '')}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {variant.version_label ? variant.version_label.toUpperCase() : 'No version label'}
                      </p>
                    </button>

                    {isSelectedVariant && variant.sources.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {variant.sources.map((source) => {
                          const isActiveSource = source.id === activeSource?.id;
                          return (
                            <button
                              key={source.id}
                              onClick={() => setSelectedSourceId(source.id)}
                              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                                isActiveSource
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                              title={source.drive_name}
                            >
                              {source.source}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add personal notes..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
              <button
                onClick={handleSaveNotes}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check size={16} />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {bookmark.user_notes ? (
                <p className="text-sm text-gray-400 italic">"{bookmark.user_notes}"</p>
              ) : (
                <p className="text-sm text-gray-600">No notes</p>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-500 hover:text-gray-300"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleOpenExternal}
            className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            title="Open in Browser"
          >
            <ExternalLink size={18} />
          </button>
          
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`p-2 rounded-lg transition-colors ${
              downloadedPath
                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={downloadedPath ? 'Open Local Copy' : 'Download'}
          >
            {isDownloading ? (
              <div className="w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={18} />
            )}
          </button>
          
          <button
            onClick={onRemove}
            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            title="Remove Bookmark"
          >
            <BookmarkX size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  const { bookmarks, isLoading, loadBookmarks, removeBookmark, updateNotes } = useBookmarksStore();

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleOpenFolder = async () => {
    await window.electronAPI.openDownloadFolder();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Bookmarks</h1>
          <p className="text-sm text-gray-500 mt-1">
            {bookmarks.length} saved jump{bookmarks.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <FolderOpen size={18} />
          Open Downloads
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner message="Loading bookmarks..." />
      ) : bookmarks.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={48} />}
          title="No Bookmarks Yet"
          description="Bookmark your favorite jumps to save them here for quick access."
        />
      ) : (
        <div className="space-y-4">
          {bookmarks.map(bookmark => (
            <BookmarkItem
              key={bookmark.id}
              bookmark={bookmark}
              onRemove={() => removeBookmark(bookmark.file_id)}
              onUpdateNotes={(notes) => updateNotes(bookmark.file_id, notes)}
              onDownloadSuccess={loadBookmarks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
