import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Layers,
  Loader2
} from 'lucide-react';
import { useBookmarksStore } from '../stores/bookmarksStore';
import type { FileRecord, FileSourceRecord, FileVariantRecord } from '../../../preload/types';

interface FileCardProps {
  file: FileRecord;
}

export default function FileCard({ file }: FileCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);
  const [showVariants, setShowVariants] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarksStore();

  const variants = useMemo<FileVariantRecord[]>(() => {
    if (file.variants && file.variants.length > 0) {
      return file.variants;
    }
    return [{
      id: file.id,
      name: file.name,
      version_label: file.version,
      drive_id: file.drive_id,
      drive_name: file.drive_name,
      source: file.source,
      web_view_link: file.web_view_link,
      modified_time: file.modified_time,
      md5_checksum: file.md5_checksum,
      size_bytes: file.size_bytes,
      thumbnail_path: file.thumbnail_path,
      folder_path: file.folder_path,
      nsfw: file.nsfw,
      created_at: file.created_at,
      sources: [{
        id: file.id,
        drive_id: file.drive_id,
        drive_name: file.drive_name,
        source: file.source,
        web_view_link: file.web_view_link,
        modified_time: file.modified_time,
        md5_checksum: file.md5_checksum,
        size_bytes: file.size_bytes
      }]
    }];
  }, [file]);

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

  const activeFileId = activeSource?.id ?? activeVariant?.id ?? file.id;
  const activeFileName = activeVariant?.name ?? file.name;
  const activeFileLink = activeSource?.web_view_link ?? activeVariant?.web_view_link ?? file.web_view_link;
  const bookmarked = isBookmarked(activeFileId);

  useEffect(() => {
    setSelectedVariantIndex(0);
    setSelectedSourceId(null);
    setDownloadedPath(null);
  }, [file.id]);

  useEffect(() => {
    let cancelled = false;

    // Load thumbnail
    window.electronAPI.getThumbnail(activeFileId).then((result) => {
      if (cancelled) return;

      // Only set if we got a non-empty path
      if (result.path && result.path.length > 0) {
        setThumbnailUrl(result.path);
      } else {
        setThumbnailUrl(null);
      }
    }).catch((error) => {
      if (cancelled) return;
      console.error('Failed to load thumbnail:', error);
      setThumbnailUrl(null);
    });

    // Check for local copy
    window.electronAPI.hasLocalCopy(activeFileId).then((result) => {
      if (cancelled) return;
      if (result.exists && result.path) {
        setDownloadedPath(result.path);
      } else {
        setDownloadedPath(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeFileId]);

  const handleBookmark = async () => {
    if (bookmarked) {
      await removeBookmark(activeFileId);
    } else {
      await addBookmark(activeFileId);
    }
  };

  const handleDownload = async () => {
    if (downloadedPath) {
      // Open existing file
      await window.electronAPI.openFile(downloadedPath);
      return;
    }

    setIsDownloading(true);
    try {
      const path = await window.electronAPI.downloadFile(activeFileId, activeFileName);
      setDownloadedPath(path);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenExternal = async () => {
    await window.electronAPI.openExternal(activeFileLink);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSourceColor = (source?: string) => {
    switch (source) {
      case 'QQ': return 'bg-purple-500/20 text-purple-400';
      case 'SB': return 'bg-blue-500/20 text-blue-400';
      case 'Reddit': return 'bg-orange-500/20 text-orange-400';
      case '4chan': return 'bg-emerald-500/20 text-emerald-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden card-hover group">
      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-gray-900 relative overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
              alt={activeFileName}
            className="w-full h-full object-cover"
            onError={() => setThumbnailUrl(null)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <div className="text-center p-4">
              <div className="text-4xl mb-2">📄</div>
              <span className="text-xs">No Preview</span>
            </div>
          </div>
        )}

        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={handleBookmark}
            className={`p-3 rounded-full transition-colors ${
              bookmarked
                ? 'bg-primary-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
          >
            <Bookmark size={20} className={bookmarked ? 'fill-current' : ''} />
          </button>
          
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`p-3 rounded-full transition-colors ${
              downloadedPath
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={downloadedPath ? 'Open Local Copy' : 'Download'}
          >
            {isDownloading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : downloadedPath ? (
              <Check size={20} />
            ) : (
              <Download size={20} />
            )}
          </button>
          
          <button
            onClick={handleOpenExternal}
            className="p-3 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Open in Browser"
          >
            <ExternalLink size={20} />
          </button>
        </div>

        {/* Source Badge */}
        {activeSource?.source && (
          <span className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${getSourceColor(activeSource.source)}`}>
            {activeSource.source}
          </span>
        )}

        {/* Downloaded Badge */}
        {downloadedPath && (
          <span className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
            Downloaded
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm text-gray-100 line-clamp-2 mb-1" title={activeFileName}>
          {activeFileName.replace('.pdf', '')}
        </h3>

        {activeVariant?.version_label && (
          <p className="text-xs text-primary-400 mb-2">{activeVariant.version_label.toUpperCase()}</p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="truncate" title={activeSource?.drive_name || activeVariant?.drive_name || file.drive_name}>
            {activeSource?.drive_name || activeVariant?.drive_name || file.drive_name}
          </span>
          <span>{formatDate(activeVariant?.modified_time ?? file.modified_time)}</span>
        </div>

        {(file.variant_count > 1 || file.source_count > 1) && (
          <button
            onClick={() => setShowVariants((current) => !current)}
            className="mt-3 w-full flex items-center justify-between px-2 py-1.5 rounded bg-gray-700 text-xs text-gray-300 hover:bg-gray-600 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Layers size={13} />
              {file.variant_count} version{file.variant_count === 1 ? '' : 's'} · {file.source_count} source{file.source_count === 1 ? '' : 's'}
            </span>
            {showVariants ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {showVariants && (
        <div className="px-4 pb-4 border-t border-gray-700">
          <div className="pt-3 space-y-2 max-h-56 overflow-y-auto">
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
                      {variant.version_label ? variant.version_label.toUpperCase() : 'No version label'} · {formatDate(variant.modified_time)}
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
        </div>
      )}
    </div>
  );
}
