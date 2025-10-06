import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PokemonCard } from '../types/pokemon';
import { fetchAllPokemon, fetchTypes, fetchGenerations, fetchRarities } from '../services/api';

interface PokemonContextType {
  cards: PokemonCard[];
  loading: boolean;
  error: string | null;
  availableGenerations: string[];
  availableTypes: string[];
  availableRarities: string[];
  refreshData: () => void;
}

const PokemonContext = createContext<PokemonContextType | undefined>(undefined);

export const usePokemon = () => {
  const context = useContext(PokemonContext);
  if (!context) {
    throw new Error('usePokemon must be used within a PokemonProvider');
  }
  return context;
};

interface PokemonProviderProps {
  children: ReactNode;
}

export const PokemonProvider: React.FC<PokemonProviderProps> = ({ children }) => {
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableGenerations, setAvailableGenerations] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableRarities, setAvailableRarities] = useState<string[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

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

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = () => {
    loadData();
  };

  return (
    <PokemonContext.Provider
      value={{
        cards,
        loading,
        error,
        availableGenerations,
        availableTypes,
        availableRarities,
        refreshData
      }}
    >
      {children}
    </PokemonContext.Provider>
  );
};