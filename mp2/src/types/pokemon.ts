export interface PokemonCard {
  id: string;
  localId: string;
  name: string;
  image: string;
  imageHiRes?: string;
  rarity?: string;
  set: {
    id: string;
    name: string;
    logo?: string;
  };
  serie: {
    id: string;
    name: string;
  };
  category: string;
  dexId?: number[];
  types?: string[];
  subtypes?: string[];
  level?: string;
  hp?: string;
  attack?: string;
  defense?: string;
  specialAttack?: string;
  specialDefense?: string;
  speed?: string;
  retreatCost?: string;
  convertedRetreatCost?: number;
  number?: string;
  artist?: string;
  series?: string;
  setCode?: string;
  text?: string[];
  attacks?: Attack[];
  weaknesses?: Weakness[];
  resistances?: Resistance[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  nationalPokedexNumbers?: number[];
  legal?: {
    standard?: boolean;
    expanded?: boolean;
  };
  regulationMark?: string;
  images?: {
    small?: string;
    large?: string;
  };
  height?: string;
  weight?: string;
  abilitiesSummary?: string;
  baseStatsSummary?: string;
  movesSummary?: string;
  abilities?: PokemonAbility[];
  baseStats?: PokemonStat[];
  topMoves?: PokemonMoveSummary[];
}


export interface PokemonAbility {
  name: string;
  hidden: boolean;
}

export interface PokemonStat {
  name: string;
  value: number;
}

export interface PokemonMoveSummary {
  name: string;
  levelLearnedAt?: number;
  learnMethod?: string;
  versionGroup?: string;
}

export interface Attack {
  name: string;
  cost: string[];
  convertedEnergyCost: number;
  damage?: string;
  text?: string;
}

export interface Weakness {
  type: string;
  value: string;
}

export interface Resistance {
  type: string;
  value: string;
}

export interface PokemonSet {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  releaseDate?: string;
  total?: number;
  legal?: {
    standard?: boolean;
    expanded?: boolean;
  };
  ptcgoCode?: string;
  serie: {
    id: string;
    name: string;
  };
}

export interface PokemonSerie {
  id: string;
  name: string;
  logo?: string;
}

export interface PokemonApiResponse {
  data: PokemonCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export interface PokemonSetResponse {
  data: PokemonSet[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export interface PokemonSerieResponse {
  data: PokemonSerie[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export type SortProperty = 'name' | 'hp' |'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed' | 'rarity' | 'set' | 'dexId';
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  sets: string[];
  series: string[];
  types: string[];
  rarities: string[];
  subtypes: string[];
  hpRange: { min: number; max: number };
}

export interface SearchParams {
  q?: string;
  set?: string;
  serie?: string;
  type?: string;
  rarity?: string;
  subtype?: string;
  page?: number;
  pageSize?: number;
}
