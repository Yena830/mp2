import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PokemonCard, SortProperty, SortOrder, FilterOptions } from '../types/pokemon';
import { fetchAllPokemon, fetchTypes, fetchGenerations, fetchRarities, searchPokemon } from '../services/api';
import './MainView.css';

type ViewMode = 'search' | 'gallery';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_RANK = RARITY_ORDER.reduce<Record<string, number>>((acc, rarity, index) => {
  acc[rarity] = index;
  return acc;
}, {});

const GENERATION_ORDER = [
  'generation i',
  'generation ii',
  'generation iii',
  'generation iv',
  'generation v',
  'generation vi',
  'generation vii',
  'generation viii',
  'generation ix'
];
const GENERATION_RANK = GENERATION_ORDER.reduce<Record<string, number>>((acc, generation, index) => {
  acc[generation] = index;
  return acc;
}, {});

const MainView: React.FC = () => {
  const GALLERY_PAGE_SIZE = 100;
  const SEARCH_DEBOUNCE_MS = 1000;

  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  
  // Search view states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortProperty, setSortProperty] = useState<SortProperty>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Gallery view states
  const [filters, setFilters] = useState<FilterOptions>({
    sets: [],
    series: [],
    types: [],
    rarities: [],
    subtypes: [],
    hpRange: { min: 0, max: 1000 }
  });
  const [galleryPage, setGalleryPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Available filter options
  const [availableGenerations, setAvailableGenerations] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableRarities, setAvailableRarities] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 并行加载所有数据
        const [cardsData, typesData, generationsData, raritiesData] = await Promise.all([
          fetchAllPokemon(),
          fetchTypes(),
          fetchGenerations(),
          fetchRarities()
        ]);
        
        setCards(cardsData);
        setAvailableTypes(typesData);
        setAvailableGenerations(generationsData);
        setAvailableRarities(raritiesData);
      } catch (err) {
        setError('Failed to load Pokémon cards. Please check your internet connection and try again.');
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    setGalleryPage(1);
    setOpenDropdown(null);
  }, [
    filters.sets,
    filters.series,
    filters.types,
    filters.rarities,
    filters.subtypes,
    filters.hpRange.min,
    filters.hpRange.max,
  ]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setHasSearched(false);
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    setHasSearched(true);
    setSearchLoading(true);
    setSearchError(null);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchPokemon(trimmedQuery)
        .then((results) => {
          if (!cancelled) {
            setSearchResults(results);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchError('Failed to load search results. Please try again.');
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const toggleDropdown = (key: string) => {
    setOpenDropdown(prev => (prev === key ? null : key));
  };

  const handleSingleSelect = (filterKey: 'series' | 'rarities', value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value ? [value] : [],
    }));
    setOpenDropdown(null);
  };

  const handleTypeToggle = (type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(item => item !== type)
        : [...prev.types, type],
    }));
  };

  const handleClearTypes = () => {
    setFilters(prev => ({
      ...prev,
      types: [],
    }));
  };

  
//   const availableSupertypes = useMemo(() => {
//     const supertypes = new Set<string>();

//     cards.forEach(card => {
//       if (card.supertype) supertypes.add(card.supertype);
//     });

//     return Array.from(supertypes).sort();
//   }, [cards]);

  const sortCards = useCallback((list: PokemonCard[]): PokemonCard[] => {
    const sorted = [...list];

    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortProperty) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'hp':
          aValue = parseInt(a.hp || '0', 10) || 0;
          bValue = parseInt(b.hp || '0', 10) || 0;
          break;
        case 'rarity':
          aValue = (() => {
            const key = a.rarity?.toLowerCase() ?? '';
            return key in RARITY_RANK ? RARITY_RANK[key] : Number.MAX_SAFE_INTEGER;
          })();
          bValue = (() => {
            const key = b.rarity?.toLowerCase() ?? '';
            return key in RARITY_RANK ? RARITY_RANK[key] : Number.MAX_SAFE_INTEGER;
          })();
          break;
        case 'set': {
          const aKey = a.set?.name?.toLowerCase() ?? '';
          const bKey = b.set?.name?.toLowerCase() ?? '';
          const aRank = aKey in GENERATION_RANK ? GENERATION_RANK[aKey] : Number.MAX_SAFE_INTEGER;
          const bRank = bKey in GENERATION_RANK ? GENERATION_RANK[bKey] : Number.MAX_SAFE_INTEGER;

          if (aRank !== bRank) {
            return sortOrder === 'asc' ? aRank - bRank : bRank - aRank;
          }

          aValue = a.set.name;
          bValue = b.set.name;
          break;
        }
        case 'dexId':
          aValue = a.dexId?.[0] || 0;
          bValue = b.dexId?.[0] || 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [sortProperty, sortOrder]);

  const trimmedQuery = searchQuery.trim();
  const hasActiveQuery = trimmedQuery.length > 0;

  const matchesFilters = useCallback((card: PokemonCard) => {
    const matchesSeries = filters.series.length === 0 ||
      filters.series.some((series) => {
        const normalizedSeries = series.toLowerCase();
        return (
          (card.set?.name?.toLowerCase() ?? '') === normalizedSeries ||
          (card.serie?.name?.toLowerCase() ?? '') === normalizedSeries
        );
      });

    const matchesType = filters.types.length === 0 ||
      filters.types.every((type) =>
        card.types?.some((cardType) => cardType.toLowerCase() === type.toLowerCase()) ?? false
      );

    const matchesRarity = filters.rarities.length === 0 ||
      filters.rarities.some((rarity) => card.rarity?.toLowerCase() === rarity.toLowerCase());

    // const matchesSupertype = filters.supertypes.length === 0 ||
    //   filters.supertypes.some((supertype) => card.supertype?.toLowerCase() === supertype.toLowerCase());

    const hp = parseInt(card.hp || '0', 10) || 0;
    const matchesHp = hp >= filters.hpRange.min && hp <= filters.hpRange.max;

    return matchesSeries && matchesType && matchesRarity &&  matchesHp;
  }, [
    filters.series,
    filters.types,
    filters.rarities,
    filters.hpRange.min,
    filters.hpRange.max,
  ]);

  const filteredSearchCards = useMemo(() => {
    if (!hasActiveQuery) {
      return [];
    }
    return searchResults.filter(matchesFilters);
  }, [hasActiveQuery, searchResults, matchesFilters]);

  const searchDisplayCards = useMemo(() => {
    return sortCards(filteredSearchCards);
  }, [filteredSearchCards, sortCards]);

  const searchTotalCount = filteredSearchCards.length;

  const generationLabel = filters.series[0] || 'All Generations';
  const rarityLabel = filters.rarities[0] || 'All Rarities';
  const typesLabel = filters.types.length === 0
    ? 'All Types'
    : `${filters.types.length} selected`;

  // 画廊视图的过滤逻辑
  const galleryFilteredCards = useMemo(() => {
    return cards.filter(matchesFilters);
  }, [cards, matchesFilters]);

  const galleryVisibleCards = useMemo(() => {
    return galleryFilteredCards.slice(0, galleryPage * GALLERY_PAGE_SIZE);
  }, [galleryFilteredCards, galleryPage]);

  const clearFilters = () => {
    setFilters({
      sets: [],
      series: [],
      types: [],
      rarities: [],
      
      subtypes: [],
      hpRange: { min: 0, max: 1000 }
    });
    setGalleryPage(1);
    setOpenDropdown(null);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <h3>Loading Pokémon Cards...</h3>
        <p>This may take a moment as we load all available cards for your search.</p>
      </div>
    );
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const currentCards = viewMode === 'search' ? searchDisplayCards : galleryVisibleCards;
  const totalCards = viewMode === 'search'
    ? searchTotalCount
    : galleryFilteredCards.length;

  return (
    <div className="main-view">
      <header className="main-header">
        <h1>Pokédex</h1>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'search' ? 'active' : ''}`}
            onClick={() => {
              setViewMode('search');
              setOpenDropdown(null);
            }}
          >
            Search View
          </button>
          <button
            className={`toggle-btn ${viewMode === 'gallery' ? 'active' : ''}`}
            onClick={() => {
              setViewMode('gallery');
              setGalleryPage(1);
              setOpenDropdown(null);
            }}
          >
            Gallery View
          </button>
        </div>
      </header>

      {viewMode === 'search' && (
        <div className="search-section">
          <div className="search-controls">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search Pokémon cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="sort-container">
              <select
                value={sortProperty}
                onChange={(e) => setSortProperty(e.target.value as SortProperty)}
                className="sort-select"
              >
                <option value="name">Name</option>
                <option value="hp">HP</option>
                <option value="rarity">Rarity</option>
                <option value="set">Set</option>
                <option value="dexId">Pokédex ID</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="sort-select"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          <div className="search-filters">
            <div className="filter-group">
              <h4>Filter by Generation</h4>
              <select
                value={filters.series[0] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters(prev => ({
                    ...prev,
                    series: value ? [value] : []
                  }));
                }}
                className="filter-select"
              >
                <option value="">All Generations</option>
                {availableGenerations.map(generation => (
                  <option key={generation} value={generation}>{generation}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <h4>Filter by Type</h4>
              <select
                value={filters.types[0] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters(prev => ({
                    ...prev,
                    types: value ? [value] : []
                  }));
                }}
                className="filter-select"
              >
                <option value="">All Types</option>
                {availableTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <h4>Filter by Rarity</h4>
              <select
                value={filters.rarities[0] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters(prev => ({
                    ...prev,
                    rarities: value ? [value] : []
                  }));
                }}
                className="filter-select"
              >
                <option value="">All Rarities</option>
                {availableRarities.map(rarity => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>
            </div>

            

          </div>

          <div className="search-actions">
            <button onClick={clearFilters} className="clear-filters">
              Clear All Filters
            </button>
          </div>

          {searchError && (
            <div className="error">{searchError}</div>
          )}

          {!hasActiveQuery && !hasSearched && (
            <div className="search-placeholder">
              Start typing to find your favorite Pokémon.
            </div>
          )}

          {hasActiveQuery && !searchLoading && searchDisplayCards.length === 0 && !searchError && (
            <div className="no-results">
              <h3>No Pokémon found</h3>
              <p>Try a different name or check your spelling.</p>
            </div>
          )}
        </div>
      )}

      {viewMode === 'gallery' && (
        <div className="filters-section">
          <div className="filters-header">
            <h3>Filter by Category</h3>
            <button onClick={clearFilters} className="clear-filters">
              Clear All Filters
            </button>
          </div>

          <div className="filter-dropdowns">
            <div className="filter-dropdown">
              <button
                type="button"
                className={`filter-dropdown-toggle ${openDropdown === 'series' ? 'open' : ''}`}
                onClick={() => toggleDropdown('series')}
              >
                <span className="filter-dropdown-label">Generation</span>
                <span className="filter-dropdown-value">{generationLabel}</span>
                <span className="filter-dropdown-icon">{openDropdown === 'series' ? '▲' : '▼'}</span>
              </button>
              {openDropdown === 'series' && (
                <div className="filter-dropdown-menu">
                  <label className="filter-option">
                    <input
                      type="radio"
                      name="generation-filter"
                      checked={filters.series.length === 0}
                      onChange={() => handleSingleSelect('series', null)}
                    />
                    <span>All Generations</span>
                  </label>
                  {availableGenerations.map((generation) => (
                    <label key={generation} className="filter-option">
                      <input
                        type="radio"
                        name="generation-filter"
                        checked={filters.series.includes(generation)}
                        onChange={() => handleSingleSelect('series', generation)}
                      />
                      <span>{generation}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="filter-dropdown">
              <button
                type="button"
                className={`filter-dropdown-toggle ${openDropdown === 'types' ? 'open' : ''}`}
                onClick={() => toggleDropdown('types')}
              >
                <span className="filter-dropdown-label">Types</span>
                <span className="filter-dropdown-value">{typesLabel}</span>
                <span className="filter-dropdown-icon">{openDropdown === 'types' ? '▲' : '▼'}</span>
              </button>
              {openDropdown === 'types' && (
                <div className="filter-dropdown-menu multi-select">
                  <button
                    type="button"
                    className="filter-dropdown-clear"
                    onClick={handleClearTypes}
                    disabled={filters.types.length === 0}
                  >
                    Clear All
                  </button>
                  {availableTypes.map((type) => (
                    <label key={type} className="filter-option">
                      <input
                        type="checkbox"
                        checked={filters.types.includes(type)}
                        onChange={() => handleTypeToggle(type)}
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="filter-dropdown">
              <button
                type="button"
                className={`filter-dropdown-toggle ${openDropdown === 'rarities' ? 'open' : ''}`}
                onClick={() => toggleDropdown('rarities')}
              >
                <span className="filter-dropdown-label">Rarity</span>
                <span className="filter-dropdown-value">{rarityLabel}</span>
                <span className="filter-dropdown-icon">{openDropdown === 'rarities' ? '▲' : '▼'}</span>
              </button>
              {openDropdown === 'rarities' && (
                <div className="filter-dropdown-menu">
                  <label className="filter-option">
                    <input
                      type="radio"
                      name="rarity-filter"
                      checked={filters.rarities.length === 0}
                      onChange={() => handleSingleSelect('rarities', null)}
                    />
                    <span>All Rarities</span>
                  </label>
                  {availableRarities.map((rarity) => (
                    <label key={rarity} className="filter-option">
                      <input
                        type="radio"
                        name="rarity-filter"
                        checked={filters.rarities.includes(rarity)}
                        onChange={() => handleSingleSelect('rarities', rarity)}
                      />
                      <span>{rarity}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 搜索结果和卡牌列表 */}
      <div className="results-info">
        {viewMode === 'search' ? (
          hasActiveQuery
            ? (searchLoading
              ? `Searching for "${trimmedQuery}"...`
              : totalCards > 0
                ? `Found ${totalCards} Pokémon for "${trimmedQuery}"`
                : `No Pokémon found for "${trimmedQuery}"`)
            : 'Type to search the Pokédex'
        ) : (
          `Showing ${currentCards.length} of ${totalCards} cards`
        )}
      </div>

      <div className={`card-grid ${viewMode === 'gallery' ? 'gallery-grid' : 'list-grid'}`}>
        {currentCards.map((card) => {
          const primaryDex = card.dexId?.[0];
          const formattedDex = primaryDex !== undefined
            ? `#${primaryDex.toString().padStart(3, '0')}`
            : null;

          if (viewMode === 'gallery') {
            return (
              <Link
                key={card.id}
                to={`/card/${card.id}`}
                className="card-item gallery-card"
              >
                <div className="card-image">
                  {card.image ? (
                    <img src={card.image} alt={card.name} />
                  ) : (
                    <div className="no-image">No Image</div>
                  )}
                </div>
                <div className="card-overlay">
                  <h3>{card.name}</h3>
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={card.id}
              to={`/card/${card.id}`}
              className={`card-item list-card rarity-${card.rarity?.toLowerCase() || 'common'}`}
            >
              <div className="card-image">
                {card.image ? (
                  <img src={card.image} alt={card.name} />
                ) : (
                  <div className="no-image">No Image</div>
                )}
              </div>
              <div className="card-info">
                <div className="card-title">
                  <h3>{card.name}</h3>
                  {formattedDex && <span className="card-number">{formattedDex}</span>}
                </div>
                <div className="card-subtitle">
                  <span className="card-set">{card.set.name}</span>
                 
                </div>
                <div className="card-meta">
                  {/* {card.rarity && <span className="card-chip rarity-chip">{card.rarity}</span>} */}
                  
                  {card.types?.map((type) => (
                    <span key={type} className="card-chip type-chip" data-type={type.toLowerCase()} >{type}</span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {currentCards.length === 0 && hasActiveQuery && (
        <div className="no-results">
          <h3>No cards match your criteria</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}

      

      {viewMode === 'search' && searchLoading && (
        <div className="loading inline-loading">
          <div className="loading-spinner"></div>
          <p>Searching...</p>
        </div>
      )}

      {viewMode === 'gallery' && galleryVisibleCards.length < galleryFilteredCards.length && (
        <div className="load-more">
          <button
            className="load-more-button"
            onClick={() => setGalleryPage((prev) => prev + 1)}
          >
            Load More Pokémon
          </button>
        </div>
      )}
    </div>
  );
};

export default MainView;
