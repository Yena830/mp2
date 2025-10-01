import axios from 'axios';
import { PokemonCard, Attack } from '../types/pokemon';

const API_BASE_URL = 'https://pokeapi.co/api/v2';

export interface PokeApiListItem {
  name: string;
  url: string;
}

interface PokeApiListResponse {
  results: PokeApiListItem[];
  count: number;
}

interface PokeApiStat {
  base_stat: number;
  stat: {
    name: string;
  };
}

interface PokeApiTypeSlot {
  slot: number;
  type: {
    name: string;
  };
}

interface PokeApiAbility {
  ability: {
    name: string;
    url: string;
  };
  is_hidden: boolean;
}

interface PokeApiMoveVersionDetail {
  level_learned_at: number;
  move_learn_method: {
    name: string;
    url: string;
  };
  version_group: {
    name: string;
    url: string;
  };
}

interface PokeApiMove {
  move: {
    name: string;
    url: string;
  };
  version_group_details: PokeApiMoveVersionDetail[];
}

interface PokeApiSprites {
  front_default: string | null;
  other?: {
    ['official-artwork']?: {
      front_default: string | null;
    };
  };
}

interface PokeApiPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: PokeApiSprites;
  stats: PokeApiStat[];
  types: PokeApiTypeSlot[];
  abilities: PokeApiAbility[];
  moves: PokeApiMove[];
  species: {
    name: string;
    url: string;
  };
}

interface GenerationRange {
  id: string;
  displayName: string;
  setCode: string;
  maxDex: number;
}

const pokemonCache = new Map<string, PokemonCard>();
let allPokemonCache: PokemonCard[] | null = null;
let allPokemonPromise: Promise<PokemonCard[]> | null = null;
let pokemonIndexCache: PokeApiListItem[] | null = null;
let pokemonIndexPromise: Promise<PokeApiListItem[]> | null = null;

// 控制预加载的宝可梦数量。设置得太大会拖慢首次加载。
const MAX_POKEMON = 1000;
const DETAIL_CONCURRENCY = 6;
const POKEMON_INDEX_LIMIT = 5000;

const GENERATION_RANGES: GenerationRange[] = [
  { id: 'generation-i', displayName: 'Generation I', setCode: 'GEN1', maxDex: 151 },
  { id: 'generation-ii', displayName: 'Generation II', setCode: 'GEN2', maxDex: 251 },
  { id: 'generation-iii', displayName: 'Generation III', setCode: 'GEN3', maxDex: 386 },
  { id: 'generation-iv', displayName: 'Generation IV', setCode: 'GEN4', maxDex: 493 },
  { id: 'generation-v', displayName: 'Generation V', setCode: 'GEN5', maxDex: 649 },
  { id: 'generation-vi', displayName: 'Generation VI', setCode: 'GEN6', maxDex: 721 },
  { id: 'generation-vii', displayName: 'Generation VII', setCode: 'GEN7', maxDex: 809 },
  { id: 'generation-viii', displayName: 'Generation VIII', setCode: 'GEN8', maxDex: 905 },
  { id: 'generation-ix', displayName: 'Generation IX', setCode: 'GEN9', maxDex: Number.MAX_SAFE_INTEGER },
];

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const toTitleCase = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const sumStats = (stats: PokeApiStat[]): number =>
  stats.reduce((total, stat) => total + stat.base_stat, 0);

const getStat = (stats: PokeApiStat[], name: string): number =>
  stats.find((stat) => stat.stat.name === name)?.base_stat ?? 0;

const getGenerationByDexId = (dexId: number): GenerationRange => {
  return (
    GENERATION_RANGES.find((range) => dexId <= range.maxDex) ??
    GENERATION_RANGES[GENERATION_RANGES.length - 1]
  );
};

const getRarityFromStats = (stats: PokeApiStat[]): string => {
  const total = sumStats(stats);

  if (total >= 600) return 'Legendary';
  if (total >= 520) return 'Epic';
  if (total >= 450) return 'Rare';
  if (total >= 380) return 'Uncommon';
  return 'Common';
};

const cachePokemonCard = (card: PokemonCard, ...keys: (string | number | undefined)[]): void => {
  keys
    .map((key) => (key !== undefined ? key.toString().toLowerCase() : ''))
    .filter((key) => key.length > 0)
    .forEach((key) => pokemonCache.set(key, card));
};

/** ---------- 新增：通用“去空值”工具，删除空字符串/空数组/null/undefined/空对象 ---------- **/
const isEmptyValue = (v: any): boolean =>
  v == null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const stripEmpty = <T extends Record<string, any>>(obj: T): T => {
  Object.keys(obj).forEach((k) => {
    const v = (obj as any)[k];

    if (Array.isArray(v)) {
      (obj as any)[k] = v
        .map((item) => (item && typeof item === 'object' ? stripEmpty(item) : item))
        .filter((item) => !isEmptyValue(item));
      if ((obj as any)[k].length === 0) delete (obj as any)[k];
    } else if (v && typeof v === 'object') {
      stripEmpty(v);
      if (isEmptyValue(v)) delete (obj as any)[k];
    } else if (isEmptyValue(v)) {
      delete (obj as any)[k];
    }
  });
  return obj;
};
/** -------------------------------------------------------------------------- **/

const mapPokemonToCard = (pokemon: PokeApiPokemon): PokemonCard => {
  const generation = getGenerationByDexId(pokemon.id);
  const types = (pokemon.types ?? []).map((typeSlot) => toTitleCase(typeSlot.type.name));

  // 统一使用官方立绘作为主图（更清晰），前置再做兜底
  const officialArt =
    pokemon.sprites.other?.['official-artwork']?.front_default ||
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;
  const smallSprite = pokemon.sprites.front_default || officialArt;

  const hp = getStat(pokemon.stats, 'hp');
  const atk = getStat(pokemon.stats, 'attack');
  const def = getStat(pokemon.stats, 'defense');
  const spAtk = getStat(pokemon.stats, 'special-attack');
  const spDef = getStat(pokemon.stats, 'special-defense');
  const spd = getStat(pokemon.stats, 'speed');
  const retreatCost = Math.max(types.length, 1);

  const abilities = (pokemon.abilities ?? [])
    .filter((entry) => entry?.ability?.name)
    .map((entry) => ({
      name: toTitleCase(entry.ability.name),
      hidden: !!entry.is_hidden,
    }));

  const abilitySummary = abilities.length
    ? abilities.map((a) => (a.hidden ? `${a.name} (Hidden)` : a.name)).join(', ')
    : undefined;

  const baseStats = (pokemon.stats ?? []).map((stat) => ({
    name: toTitleCase(stat.stat.name.replace(/[-_]/g, ' ')),
    value: stat.base_stat,
  }));

  const statsSummary =
    baseStats.length > 0 ? baseStats.map((stat) => `${stat.name} ${stat.value}`).join(' • ') : undefined;

  // 顶部 moves（过滤空名字，并去重）
  const topMoves = (pokemon.moves ?? [])
    .filter((m) => m?.move?.name)
    .slice(0, 6)
    .map((move) => {
      const detail =
        move.version_group_details?.find((entry) => entry.level_learned_at > 0) ??
        move.version_group_details?.[0];

      return {
        name: toTitleCase(move.move.name),
        levelLearnedAt: detail?.level_learned_at || undefined,
        learnMethod: detail?.move_learn_method?.name
          ? toTitleCase(detail.move_learn_method.name.replace(/-/g, ' '))
          : undefined,
        versionGroup: detail?.version_group?.name
          ? toTitleCase(detail.version_group.name.replace(/-/g, ' '))
          : undefined,
      };
    });

  const uniqueTopMoves = Array.from(new Map(topMoves.map((m) => [m.name, m])).values());
  const moveNames = uniqueTopMoves.length ? uniqueTopMoves.map((m) => m.name).join(', ') : undefined;

  const heightMeters = pokemon.height ? pokemon.height / 10 : null;
  const weightKilograms = pokemon.weight ? pokemon.weight / 10 : null;
  const formattedHeight = heightMeters !== null ? `${heightMeters.toFixed(1)} m` : undefined;
  const formattedWeight = weightKilograms !== null ? `${weightKilograms.toFixed(1)} kg` : undefined;

  const infoText: string[] = [];
  if (abilitySummary) infoText.push(`Abilities: ${abilitySummary}`);
  if (formattedHeight) infoText.push(`Height: ${formattedHeight}`);
  if (formattedWeight) infoText.push(`Weight: ${formattedWeight}`);
  if (statsSummary) infoText.push(`Base Stats: ${statsSummary}`);
  if (moveNames) infoText.push(`Moves: ${moveNames}`);

  const attackCostTypes = types.length > 0 ? types.slice(0, Math.min(types.length, 2)) : ['Colorless'];

  // 生成 0~3 个攻击（若无有效 move 则为空数组，后续 stripEmpty 会删掉）
  const attacks: Attack[] = (pokemon.moves ?? [])
    .filter((m) => m?.move?.name)
    .slice(0, 3)
    .map((move) => {
      const detail =
        move.version_group_details?.find((entry) => entry.level_learned_at > 0) ??
        move.version_group_details?.[0];
      const notes: string[] = [];
      if (detail) {
        if (detail.move_learn_method?.name) {
          notes.push(toTitleCase(detail.move_learn_method.name.replace(/-/g, ' ')));
        }
        if (detail.level_learned_at > 0) {
          notes.push(`Lv ${detail.level_learned_at}`);
        }
        if (detail.version_group?.name) {
          notes.push(toTitleCase(detail.version_group.name.replace(/-/g, ' ')));
        }
      }

      const atk: Attack = {
        name: toTitleCase(move.move.name),
        cost: attackCostTypes.length > 0 ? [...attackCostTypes] : ['Colorless'],
        convertedEnergyCost: Math.max(1, attackCostTypes.length),
      };

      if (notes.length > 0) {
        atk.text = notes.join(' • ');
      }

      return atk;
    })
    .filter((a) => !!a?.name);

  // 组装卡片；很多字段是可选的，空就不写（stripEmpty 会负责删除）
  const card: PokemonCard = {
    id: String(pokemon.id),
    localId: String(pokemon.id),
    name: toTitleCase(pokemon.name),
    image: smallSprite,
    imageHiRes: officialArt,
    rarity: getRarityFromStats(pokemon.stats),
    set: {
      id: generation.id,
      name: generation.displayName,
      logo: '',
    },
    serie: {
      id: generation.id,
      name: generation.displayName,
    },
    category: 'Pokemon',
    dexId: [pokemon.id],
    types,
    subtypes: [],

    // 以下基础数值：若为 0 则不写入（string 化前判断）
    ...(hp ? { hp: String(hp) } : {}),
    ...(atk ? { attack: String(atk) } : {}),
    ...(def ? { defense: String(def) } : {}),
    ...(spAtk ? { specialAttack: String(spAtk) } : {}),
    ...(spDef ? { specialDefense: String(spDef) } : {}),
    ...(spd ? { speed: String(spd) } : {}),

    retreatCost: String(retreatCost),
    convertedRetreatCost: retreatCost,

    number: String(pokemon.id),
    series: generation.displayName,
    setCode: generation.setCode,

    // 仅当存在内容时才写
    ...(infoText.length ? { text: infoText } : {}),
    ...(attacks.length ? { attacks } : {}),

    // 这些常常为空，让 stripEmpty 删除掉
    weaknesses: [],
    resistances: [],
    evolvesFrom: undefined,
    evolvesTo: [],
    nationalPokedexNumbers: [pokemon.id],

    legal: {
      standard: true,
      expanded: true,
    },
    regulationMark: '',
    images: {
      small: smallSprite,
      large: officialArt,
    },
    ...(formattedHeight ? { height: formattedHeight } : {}),
    ...(formattedWeight ? { weight: formattedWeight } : {}),
    ...(abilitySummary ? { abilitiesSummary: abilitySummary } : {}),
    ...(statsSummary ? { baseStatsSummary: statsSummary } : {}),
    ...(moveNames ? { movesSummary: moveNames } : {}),
    ...(abilities.length ? { abilities } : {}),
    ...(baseStats.length ? { baseStats } : {}),
    ...(uniqueTopMoves.length ? { topMoves: uniqueTopMoves } : {}),
  };

  // 核心：删除空白/空数组/空字符串/undefined 的字段
  return stripEmpty(card) as PokemonCard;
};

const fetchPokemonDetailsBatch = async (items: PokeApiListItem[]): Promise<PokemonCard[]> => {
  if (items.length === 0) {
    return [];
  }

  const results: (PokemonCard | null)[] = new Array(items.length).fill(null);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) {
        return;
      }

      const identifier = items[currentIndex].name;

      try {
        const card = await fetchPokemonById(identifier);
        results[currentIndex] = card;
      } catch (err) {
        console.warn(`Failed to fetch pokemon details for ${identifier}`, err);
      }
    }
  };

  const workerCount = Math.min(DETAIL_CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results.filter((card): card is PokemonCard => card !== null);
};

const fetchPokemonIndex = async (): Promise<PokeApiListItem[]> => {
  if (pokemonIndexCache) {
    return pokemonIndexCache;
  }

  if (!pokemonIndexPromise) {
    pokemonIndexPromise = fetchPokemon(0, POKEMON_INDEX_LIMIT)
      .then((response) => {
        pokemonIndexCache = response.results;
        return pokemonIndexCache;
      })
      .catch((error) => {
        pokemonIndexCache = null;
        throw error;
      })
      .finally(() => {
        pokemonIndexPromise = null;
      });
  }

  return pokemonIndexPromise ?? Promise.resolve(pokemonIndexCache ?? []);
};

export const fetchPokemonIndexList = async (): Promise<PokeApiListItem[]> => {
  return fetchPokemonIndex();
};

// 获取宝可梦列表
export const fetchPokemon = async (
  offset: number = 0,
  limit: number = 50,
): Promise<PokeApiListResponse> => {
  try {
    const response = await apiClient.get<PokeApiListResponse>('/pokemon', {
      params: { offset, limit },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching pokemon:', error);
    throw new Error('Failed to fetch pokemon');
  }
};

// 根据ID获取单个宝可梦详情
export const fetchPokemonById = async (id: string): Promise<PokemonCard> => {
  const key = id.toString().toLowerCase();
  const cached = pokemonCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const response = await apiClient.get<PokeApiPokemon>(`/pokemon/${key}`);
    const card = mapPokemonToCard(response.data);
    cachePokemonCard(card, id, card.id, card.localId, card.name, response.data.name);
    return card;
  } catch (error) {
    console.error('Error fetching pokemon details:', error);
    throw new Error('Failed to fetch pokemon details');
  }
};

// 搜索宝可梦
export const searchPokemon = async (query: string): Promise<PokemonCard[]> => {
  try {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    const index = await fetchPokemonIndex();
    const matched = index.filter((pokemon) => pokemon.name.includes(normalized) || String(pokemon.name) === normalized);
    const cards = await fetchPokemonDetailsBatch(matched);

    return cards.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error searching pokemon:', error);
    throw new Error('Failed to search pokemon');
  }
};

const loadAllPokemon = async (): Promise<PokemonCard[]> => {
  const index = await fetchPokemonIndex();
  const slice = index.slice(0, MAX_POKEMON);
  const cards = await fetchPokemonDetailsBatch(slice);

  cards.forEach((card) => {
    cachePokemonCard(card, card.id, card.localId, card.name);
  });

  return cards;
};

// 获取所有宝可梦（分页加载）
export const fetchAllPokemon = async (): Promise<PokemonCard[]> => {
  if (allPokemonCache) {
    return allPokemonCache;
  }

  if (!allPokemonPromise) {
    allPokemonPromise = loadAllPokemon()
      .then((cards) => {
        allPokemonCache = cards;
        return cards;
      })
      .catch((error) => {
        allPokemonCache = null;
        throw error;
      })
      .finally(() => {
        allPokemonPromise = null;
      });
  }

  return allPokemonPromise ?? Promise.resolve(allPokemonCache ?? []);
};

// 获取宝可梦类型
export const fetchTypes = async (): Promise<string[]> => {
  try {
    const response = await apiClient.get<{ results: PokeApiListItem[] }>('/type');
    return response.data.results.map((t) => toTitleCase(t.name));
  } catch (error) {
    console.error('Error fetching types:', error);
    return [];
  }
};

// 获取宝可梦世代
export const fetchGenerations = async (): Promise<string[]> => {
  try {
    const response = await apiClient.get<{ results: PokeApiListItem[] }>('/generation');
    return response.data.results.map((g) => toTitleCase(g.name));
  } catch (error) {
    console.error('Error fetching generations:', error);
    return [];
  }
};

// 获取稀有度（模拟数据）
export const fetchRarities = async (): Promise<string[]> => {
  return ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
};