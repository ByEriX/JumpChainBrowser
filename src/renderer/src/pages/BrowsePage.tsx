import { useEffect, useState, useCallback } from 'react';
import { useFilesStore } from '../stores/filesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useBookmarksStore } from '../stores/bookmarksStore';
import FileCard from '../components/FileCard';
import SearchBar from '../components/SearchBar';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import {
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

const ITEMS_PER_PAGE = 50;

type SortField = 'name' | 'date' | 'source';
type SortOrder = 'asc' | 'desc';

export default function BrowsePage() {
  const { files, isLoading, loadFiles, totalCount, syncDrives, isSyncing, error, clearError } =
    useFilesStore();
  const { allowedSources, nsfwEnabled, setLastSync } = useSettingsStore();
  const { loadBookmarks, bookmarks } = useBookmarksStore();

  const [search, setSearch] = useState('');
  const [selectedSources, setSelectedSources] =
    useState<string[]>(allowedSources);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showSorting, setShowSorting] = useState(false);

  // New filter states
  const [nsfwOnly, setNsfwOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  // Sorting states
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Sync selectedSources with allowedSources from settings
  useEffect(() => {
    setSelectedSources(allowedSources);
  }, [allowedSources]);

  const loadData = useCallback(async () => {
    await loadBookmarks();

    // Get bookmarked IDs after loading bookmarks
    const currentBookmarks = useBookmarksStore.getState().bookmarks;
    const bookmarkedIds = currentBookmarks.map((b) => b.file_id);

    await loadFiles({
      sources: selectedSources,
      nsfw: nsfwEnabled,
      nsfwOnly,
      bookmarkedOnly,
      bookmarkedIds: bookmarkedOnly ? bookmarkedIds : undefined,
      search: search || undefined,
      sortBy,
      sortOrder,
      limit: ITEMS_PER_PAGE,
      offset: page * ITEMS_PER_PAGE,
    });
  }, [
    loadFiles,
    loadBookmarks,
    selectedSources,
    nsfwEnabled,
    nsfwOnly,
    bookmarkedOnly,
    search,
    sortBy,
    sortOrder,
    page,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, selectedSources, nsfwOnly, bookmarkedOnly, sortBy, sortOrder]);

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const sources = ['4chan', 'QQ', 'SB', 'Reddit'];
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
    if (totalPages === 0 && page !== 0) {
      setPage(0);
    }
  }, [page, totalPages]);

  const sortOptions: { value: SortField; label: string }[] = [
    { value: 'name', label: 'Alphabetical' },
    { value: 'date', label: 'Date Modified' },
    { value: 'source', label: 'Source' },
  ];

  const activeFilterCount =
    (selectedSources.length !== allowedSources.length ? 1 : 0) +
    (nsfwOnly ? 1 : 0) +
    (bookmarkedOnly ? 1 : 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse All Jumps</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount.toLocaleString()} files indexed
          </p>
        </div>

        <button
          onClick={async () => {
            if (isSyncing) {
              await useFilesStore.getState().cancelSync();
              return;
            }
            const result = await syncDrives(allowedSources, nsfwEnabled);
            if (result.success) {
              setLastSync(new Date().toISOString());
              await loadData();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isSyncing
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Cancel' : 'Sync'}
        </button>
      </div>

      {/* Search and Filters */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-red-300 whitespace-pre-wrap">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-red-200 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name..."
            />
          </div>

          <button
            onClick={() => {
              setShowFilters(!showFilters);
              if (!showFilters) setShowSorting(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Filter size={18} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-primary-500 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setShowSorting(!showSorting);
              if (!showSorting) setShowFilters(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showSorting
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <ArrowUpDown size={18} />
            Sort
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
            {/* Source Filters */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Source Drives
              </h3>
              <div className="flex flex-wrap gap-2">
                {sources.map((source) => (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedSources.includes(source)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Filters */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">
                Additional Filters
              </h3>
              <div className="flex flex-wrap gap-2">
                {/* NSFW Filter - only show if NSFW is enabled in settings */}
                {nsfwEnabled && (
                  <button
                    onClick={() => setNsfwOnly(!nsfwOnly)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      nsfwOnly
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    NSFW Only
                  </button>
                )}

                {/* Bookmarked Filter */}
                <button
                  onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    bookmarkedOnly
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  Bookmarked Only
                </button>
              </div>
            </div>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setSelectedSources(allowedSources);
                  setNsfwOnly(false);
                  setBookmarkedOnly(false);
                }}
                className="text-sm text-gray-400 hover:text-gray-300 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Sorting Panel */}
        {showSorting && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Sort By
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        sortBy === option.value
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Order</h3>
                <button
                  onClick={toggleSortOrder}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  {sortOrder === 'asc' ? (
                    <>
                      <ArrowUp size={16} />
                      Ascending
                    </>
                  ) : (
                    <>
                      <ArrowDown size={16} />
                      Descending
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner message="Loading files..." />
      ) : files.length === 0 ? (
        <EmptyState
          icon={<Search size={48} />}
          title="No Files Found"
          description={
            search
              ? `No files matching "${search}"`
              : bookmarkedOnly
                ? 'No bookmarked files found. Try bookmarking some jumps first.'
                : 'No files available. Try syncing to fetch the latest files.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {files.map((file) => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="px-4 py-2 text-gray-400">
                Page {page + 1} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}