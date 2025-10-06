import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePokemon } from '../contexts/PokemonContext';
import { PokemonCard, FilterOptions } from '../types/pokemon';
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

const GalleryView: React.FC = () => {
  const GALLERY_PAGE_SIZE = 100;

  const { cards, loading, error, availableGenerations, availableTypes, availableRarities } = usePokemon();
  
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

  const generationLabel = filters.series[0] || 'All Generations';
  const rarityLabel = filters.rarities[0] || 'All Rarities';
  const typesLabel = filters.types.length === 0
    ? 'All Types'
    : `${filters.types.length} selected`;

  return (
    <div className="main-view">
      <header className="main-header">
        <h1>Pokédex</h1>
        <div className="view-toggle">
          <Link to="/list" className="toggle-btn">
            Search View
          </Link>
          <button className="toggle-btn active">
            Gallery View
          </button>
        </div>
      </header>

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

      {/* 搜索结果和卡牌列表 */}
      <div className="results-info">
        {`Showing ${galleryVisibleCards.length} of ${galleryFilteredCards.length} cards`}
      </div>

      <div className="card-grid gallery-grid">
        {galleryVisibleCards.map((card) => {
          const primaryDex = card.dexId?.[0];
          const formattedDex = primaryDex !== undefined
            ? `#${primaryDex.toString().padStart(3, '0')}`
            : null;

          return (
            <Link
              key={card.id}
              to={`/card/${card.id}`}
              className={`card-item gallery-card rarity-${card.rarity?.toLowerCase() || 'common'}`}
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
        })}
      </div>

      {galleryVisibleCards.length < galleryFilteredCards.length && (
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

export default GalleryView;