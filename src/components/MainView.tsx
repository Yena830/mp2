import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePokemon } from '../contexts/PokemonContext';
import { PokemonCard, SortProperty, SortOrder, FilterOptions } from '../types/pokemon';
import { searchPokemon } from '../services/api';
import './MainView.css';

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
  const SEARCH_DEBOUNCE_MS = 1000;

  const { cards, loading, error, availableGenerations, availableTypes, availableRarities } = usePokemon();
  
  // Search view states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortProperty, setSortProperty] = useState<SortProperty>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<FilterOptions>({
    sets: [],
    series: [],
    types: [],
    rarities: [],
    subtypes: [],
    hpRange: { min: 0, max: 1000 }
  });

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

  const handleSingleSelect = (filterKey: 'series' | 'rarities', value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value ? [value] : [],
    }));
  };

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

    const hp = parseInt(card.hp || '0', 10) || 0;
    const matchesHp = hp >= filters.hpRange.min && hp <= filters.hpRange.max;

    return matchesSeries && matchesType && matchesRarity && matchesHp;
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

  const clearFilters = () => {
    setFilters({
      sets: [],
      series: [],
      types: [],
      rarities: [],
      subtypes: [],
      hpRange: { min: 0, max: 1000 }
    });
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

  return (
    <div className="main-view">
      <header className="main-header">
        <h1>Pokédex</h1>
        <div className="view-toggle">
          <button className="toggle-btn active">
            Search View
          </button>
          <Link to="/gallery" className="toggle-btn">
            Gallery View
          </Link>
        </div>
      </header>

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
          <div className="search-placeholder minimal">
            <div className="placeholder-pikachu">
              <img src="/mp2/pikachu.png" alt="Pikachu" />
            </div>
            <h2>🔥 Let's Go!</h2>
            <p>Type to search and discover amazing Pokémon</p>
          </div>
        )}

        {hasActiveQuery && !searchLoading && searchDisplayCards.length === 0 && !searchError && (
          <div className="no-results">
            <h3>No Pokémon found</h3>
            <p>Try a different name or check your spelling.</p>
          </div>
        )}
      </div>

      {/* 搜索结果和卡牌列表 */}
      <div className="results-info">
        {hasActiveQuery
          ? (searchLoading
            ? `Searching for "${trimmedQuery}"...`
            : searchTotalCount > 0
              ? `Found ${searchTotalCount} Pokémon for "${trimmedQuery}"`
              : `No Pokémon found for "${trimmedQuery}"`)
          : 'Type to search the Pokédex'}
      </div>

      <div className="card-grid list-grid">
        {searchDisplayCards.map((card) => {
          const primaryDex = card.dexId?.[0];
          const formattedDex = primaryDex !== undefined
            ? `#${primaryDex.toString().padStart(3, '0')}`
            : null;

          return (
            <Link
              key={card.id}
              to={`/card/${card.id}`}
              className={`card-item list-card rarity-${card.rarity?.toLowerCase() || 'common'}`}
            >
              <div className="card-left">
                <div className="card-image">
                  {card.image ? (
                    <img src={card.image} alt={card.name} />
                  ) : (
                    <div className="no-image">No Image</div>
                  )}
                </div>
                {formattedDex && <span className="card-number">{formattedDex}</span>}
              </div>
              <div className="card-info">
                <div className="card-title">
                  <h3>{card.name}</h3>
                </div>
                <div className="card-subtitle">
                  <span className="card-set">{card.set.name}</span>
                </div>
                <div className="card-meta">
                  {card.types?.map((type) => (
                    <span key={type} className="card-chip type-chip" data-type={type.toLowerCase()} >{type}</span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {searchDisplayCards.length === 0 && hasActiveQuery && (
        <div className="no-results">
          <h3>No cards match your criteria</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      )}

      {searchLoading && (
        <div className="loading inline-loading">
          <div className="loading-spinner"></div>
          <p>Searching...</p>
        </div>
      )}
    </div>
  );
};

export default MainView;