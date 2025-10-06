import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePokemon } from '../contexts/PokemonContext';
import { PokemonCard } from '../types/pokemon';
import { fetchPokemonById, fetchPokemonIndexList, PokeApiListItem } from '../services/api';
import './DetailView.css';

// 缓存已加载的卡片数据
const cardCache = new Map<string, PokemonCard>();

const DetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cards: allCards } = usePokemon();
  
  const [card, setCard] = useState<PokemonCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pokemonIndex, setPokemonIndex] = useState<PokeApiListItem[]>([]);
  const [indexLoading, setIndexLoading] = useState(true);

  useEffect(() => {
    const loadCard = async () => {
      if (!id) return;
      
      // 检查缓存
      if (cardCache.has(id)) {
        setCard(cardCache.get(id)!);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const cardData = await fetchPokemonById(id);
        setCard(cardData);
        // 缓存数据
        cardCache.set(id, cardData);
      } catch (err) {
        setError('Failed to load card details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadCard();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const loadIndex = async () => {
      try {
        setIndexLoading(true);
        const index = await fetchPokemonIndexList();
        if (!cancelled) setPokemonIndex(index);
      } catch (err) {
        if (!cancelled) console.error('Failed to load Pokémon index for navigation', err);
      } finally {
        if (!cancelled) setIndexLoading(false);
      }
    };
    loadIndex();
    return () => { cancelled = true; };
  }, []);

  const currentIndex = useMemo(() => {
    if (!card) return -1;
    return allCards.findIndex((entry) => entry.id === card.id);
  }, [allCards, card]);

  const effectiveNumericId = useMemo(() => {
    if (!card) return null;
    const parsed = Number(card.id);
    if (!Number.isNaN(parsed)) return parsed;
    const dexId = card.dexId?.[0];
    return typeof dexId === 'number' ? dexId : null;
  }, [card]);

  const getIdFromUrl = useCallback((url: string): number | null => {
    const segments = url.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    const numeric = Number(last);
    return Number.isNaN(numeric) ? null : numeric;
  }, []);

  const indexPosition = useMemo(() => {
    if (!card || pokemonIndex.length === 0) return -1;

    if (typeof effectiveNumericId === 'number' && !Number.isNaN(effectiveNumericId)) {
      const byId = pokemonIndex.findIndex((entry) => {
        const entryId = getIdFromUrl(entry.url);
        return entryId !== null && entryId === effectiveNumericId;
      });
      if (byId !== -1) return byId;
    }
    const lowerName = card.name.toLowerCase();
    return pokemonIndex.findIndex((entry) => entry.name.toLowerCase() === lowerName);
  }, [card, pokemonIndex, getIdFromUrl, effectiveNumericId]);

  const prevTargetId = useMemo(() => {
    if (!card) return null;
    if (currentIndex > 0) return allCards[currentIndex - 1].id;
    if (currentIndex === -1 && indexPosition > 0) {
      const prevEntry = pokemonIndex[indexPosition - 1];
      const prevId = getIdFromUrl(prevEntry.url);
      return prevId !== null ? prevId.toString() : null;
    }
    if (typeof effectiveNumericId === 'number' && effectiveNumericId > 1) {
      return (effectiveNumericId - 1).toString();
    }
    return null;
  }, [card, allCards, currentIndex, effectiveNumericId, getIdFromUrl, indexPosition, pokemonIndex]);

  const nextTargetId = useMemo(() => {
    if (!card) return null;
    if (currentIndex >= 0 && currentIndex < allCards.length - 1) return allCards[currentIndex + 1].id;
    if (currentIndex === -1 && indexPosition !== -1 && indexPosition < pokemonIndex.length - 1) {
      const nextEntry = pokemonIndex[indexPosition + 1];
      const nextId = getIdFromUrl(nextEntry.url);
      return nextId !== null ? nextId.toString() : null;
    }
    if (typeof effectiveNumericId === 'number') {
      const lastEntryId = pokemonIndex.length > 0
        ? getIdFromUrl(pokemonIndex[pokemonIndex.length - 1].url)
        : null;
      const upperBound = lastEntryId !== null ? lastEntryId : Number.POSITIVE_INFINITY;
      if (effectiveNumericId + 1 <= upperBound) return (effectiveNumericId + 1).toString();
    }
    return null;
  }, [card, allCards, currentIndex, effectiveNumericId, getIdFromUrl, indexPosition, pokemonIndex]);

  const isPrevDisabled = !prevTargetId || (currentIndex >= 0 ? false : indexLoading);
  const isNextDisabled = !nextTargetId || (currentIndex >= 0 ? false : indexLoading);

  const handleNavigate = (targetId: string) => {
    navigate(`/card/${targetId}`);
  };

  if (loading) {
    return <div className="dv-loading">Loading card details...</div>;
  }

  if (error || !card) {
    return (
      <div className="dv-error">
        <h2>Card not found</h2>
        <p>{error || 'The card you are looking for does not exist.'}</p>
        <Link to="/list" className="dv-back-link">Back to Search</Link>
      </div>
    );
  }

  return (
    <div className="dv-view">
      <header className="dv-header">
        <Link to="/list" className="dv-back-link">← Back to Search</Link>
        <Link to="/gallery" className="dv-gallery-link">Gallery View</Link>
      </header>

      <div className="dv-card">
        <div className="dv-card-main">

          <div className='dv-left'>
          <div className="dv-card-image">
            {card.images?.large ? (
              <img src={card.images?.large} alt={card.name} />
            ) : (
              <div className="dv-no-image">
                <span>No Image Available</span>
              </div>
            )}
          </div>
          {card.types && card.types.length > 0 && (
            <div className="dv-type-row">
              {card.types.map((type, index) => (
                <span
                  key={index}
                  className="dv-type-pill"
                  data-type={type.toLowerCase()}
                >
                  {type}
                </span>
              ))}
            </div>
          )}
        </div>
          <div className="dv-card-info">
            <h1>{card.name}</h1>

            <div className="dv-nav">
              <button
                className="dv-nav-button"
                onClick={() => prevTargetId && handleNavigate(prevTargetId)}
                disabled={isPrevDisabled}
              >
                ← Previous
              </button>
              {card.dexId?.[0] && (
                <span className="dv-nav-status">#{card.dexId[0].toString().padStart(3, '0')}</span>
              )}
              <button
                className="dv-nav-button"
                onClick={() => nextTargetId && handleNavigate(nextTargetId)}
                disabled={isNextDisabled}
              >
                Next →
              </button>
            </div>
            
            <div className="dv-basic-info">
              <div className="dv-info-row">
                <span className="dv-label">Set:</span>
                <span className="dv-value">{card.set.name}</span>
              </div>
              <div className="dv-info-row">
                <span className="dv-label">Rarity:</span>
                <span className="dv-value">{card.rarity || 'Unknown'}</span>
              </div>

              <div className="dv-info-row">
                <span className="dv-label">Height:</span>
                <span className="dv-value">{card.height}</span>
              </div>
              <div className="dv-info-row">
                <span className="dv-label">Weight:</span>
                <span className="dv-value">{card.weight}</span>
              </div>
              {card.hp && (
                <div className="dv-info-row">
                  <span className="dv-label">HP:</span>
                  <span className="dv-value">{card.hp}</span>
                </div>
              )}
              {card.attack && (
                <div className="dv-info-row">
                  <span className="dv-label">Attack:</span>
                  <span className="dv-value">{card.attack}</span>
                </div>
              )}
              {card.defense && (
                <div className="dv-info-row">
                  <span className="dv-label">Defense:</span>
                  <span className="dv-value">{card.defense}</span>
                </div>
              )}
              {card.specialAttack && (
                <div className="dv-info-row">
                  <span className="dv-label">Special Attack:</span>
                  <span className="dv-value">{card.specialAttack}</span>
                </div>
              )}
              {card.specialDefense && (
                <div className="dv-info-row">
                  <span className="dv-label">Special Defense:</span>
                  <span className="dv-value">{card.specialDefense}</span>
                </div>
              )}
              {card.speed && (
                <div className="dv-info-row">
                  <span className="dv-label">Speed:</span>
                  <span className="dv-value">{card.speed}</span>
                </div>
              )}
              {card.abilitiesSummary && (
                <div className="dv-info-row">
                  <span className="dv-label">Abilities:</span>
                  <span className="dv-value">{card.abilitiesSummary}</span>
                </div>
              )}
             {card.attacks && card.attacks.length > 0 && (
                <div className="dv-info-row">
                  <span className="dv-label">Attacks:</span>
                  <span className="dv-value">{card.attacks.map(a => a.name).join(', ')}</span>
                </div>
              )}
            </div>

            

          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailView;