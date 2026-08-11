// Types et interfaces de base
interface BaseEntity {
  id: string;
}

interface SortOptions<T> {
  field: keyof T;
  direction: "asc" | "desc";
}

interface QueryOptions<T> {
  page?: number;
  limit?: number;
  sort?: SortOptions<T>;
}

interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StatsResult {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
}

type PredicateFunction<T> = (item: T) => boolean;
type UpdateData<T> = Partial<Omit<T, "id">>;

// Tableau vide partagé : évite d'allouer un [] à chaque findBy sans résultat.
// Gelé pour que personne ne le remplisse par accident — il est partagé par
// *toutes* les instances.
const EMPTY: readonly never[] = Object.freeze([]);

// En dev on gèle les tableaux mis en cache : ils sont désormais partagés entre
// tous les appelants, donc un `.sort()` ou `.push()` en place corromprait le
// cache de tout le monde. Mieux vaut planter bruyamment ici qu'en production.
function protect<U>(array: U[]): U[] {
  return __DEV__ ? (Object.freeze(array) as U[]) : array;
}

export class QueryForTable<T extends BaseEntity> {
  private dataMap: Map<string, T>;
  private lastQuery: T[] | null = null;
  // Snapshot de findAll() : la Map ne change pas entre deux mutations, inutile
  // de réallouer le tableau à chaque lecture (findAll était appelé en boucle
  // pendant le rendu via where/findBy).
  private allCache: T[] | null = null;
  // Index secondaires construits à la demande : propriété -> valeur -> lignes.
  // Rend findBy O(1) après le premier appel au lieu d'un scan complet.
  private indexes = new Map<keyof T, Map<unknown, T[]>>();

  constructor(array: T[] = []) {
    this.dataMap = new Map(array.map((item) => [item.id, item]));
  }

  // Invalide le cache après toute mutation
  private invalidate(): void {
    this.lastQuery = null;
    this.allCache = null;
    this.indexes.clear();
  }

  // ---------- Lecture ----------

  findAll(): T[] {
    if (!this.allCache) {
      this.allCache = protect(Array.from(this.dataMap.values()));
    }
    this.lastQuery = this.allCache;
    return this.allCache;
  }

  getLastQuery(): T[] | null {
    // Copie défensive : empêche la mutation externe du cache
    return this.lastQuery ? [...this.lastQuery] : null;
  }

  findById(id: string): T | undefined {
    return this.dataMap.get(id);
  }

  findByIds(ids: string[]): T[] {
    return ids
      .map((id) => this.dataMap.get(id))
      .filter((item): item is T => item !== undefined);
  }

  where(predicate: PredicateFunction<T>): T[] {
    return this.findAll().filter(predicate);
  }

  // Indexé : le premier appel sur une propriété construit le seau complet,
  // les suivants sont de simples lookups. Le tableau retourné est partagé —
  // copiez-le (`[...res]` / `.slice()`) avant tout tri ou mutation en place.
  findBy<K extends keyof T>(property: K, value: T[K]): T[] {
    let index = this.indexes.get(property);
    if (!index) {
      index = new Map<unknown, T[]>();
      for (const item of this.dataMap.values()) {
        const key = item[property];
        const bucket = index.get(key);
        if (bucket) {
          bucket.push(item);
        } else {
          index.set(key, [item]);
        }
      }
      for (const [key, bucket] of index) index.set(key, protect(bucket));
      this.indexes.set(property, index);
    }
    return index.get(value) ?? (EMPTY as unknown as T[]);
  }

  // Recherche avec regex.
  // NOTE : évite le flag /g — regex.test() est stateful avec (lastIndex).
  // On le neutralise ici en réinitialisant lastIndex avant chaque test.
  search(property: keyof T, regex: RegExp): T[] {
    return this.where((item) => {
      const value = item[property];
      if (typeof value !== "string") return false;
      regex.lastIndex = 0;
      return regex.test(value);
    });
  }

  // Tri stable, gère string / number / Date / undefined
  orderBy<K extends keyof T>(
    property: K,
    direction: "asc" | "desc" = "asc"
  ): T[] {
    const modifier = direction === "asc" ? 1 : -1;
    // Copie : ne mute jamais le cache interne
    return [...this.findAll()].sort((a, b) => {
      const va = a[property];
      const vb = b[property];

      if (va === vb) return 0;
      if (va === undefined || va === null) return 1; // les vides en dernier
      if (vb === undefined || vb === null) return -1;

      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * modifier;
      }
      return (va > vb ? 1 : -1) * modifier;
    });
  }

  limit(count: number): T[] {
    return this.findAll().slice(0, Math.max(0, count));
  }

  paginate(page: number, itemsPerPage: number): PaginationResult<T> {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.floor(itemsPerPage));
    const total = this.count();
    const totalPages = Math.ceil(total / safeLimit);
    const start = (safePage - 1) * safeLimit;
    const data = this.findAll().slice(start, start + safeLimit);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  groupBy<K extends keyof T>(property: K): Map<T[K], T[]> {
    const groups = new Map<T[K], T[]>();
    for (const item of this.findAll()) {
      const key = item[property];
      const group = groups.get(key);
      if (group) {
        group.push(item);
      } else {
        groups.set(key, [item]);
      }
    }
    return groups;
  }

  findDuplicates(property: keyof T): T[] {
    const duplicates: T[] = [];
    for (const group of this.groupBy(property).values()) {
      if (group.length > 1) duplicates.push(...group);
    }
    return duplicates;
  }

  every(predicate: PredicateFunction<T>): boolean {
    return this.findAll().every(predicate);
  }

  some(predicate: PredicateFunction<T>): boolean {
    return this.findAll().some(predicate);
  }

  // ---------- Agrégations ----------

  sum(property: keyof T): number {
    return this.stats(property).sum;
  }

  stats(property: keyof T): StatsResult {
    const numbers = this.findAll()
      .map((item) => item[property])
      .filter((value): value is Extract<T[keyof T], number> =>
        typeof value === "number" && !Number.isNaN(value)
      );

    if (numbers.length === 0) {
      return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
    }

    // Une seule passe : évite le double reduce et le spread
    // Math.min(...arr) qui peut dépasser la pile sur de gros tableaux
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const n of numbers) {
      if (n < min) min = n;
      if (n > max) max = n;
      sum += n;
    }

    return {
      min,
      max,
      avg: sum / numbers.length,
      sum,
      count: numbers.length,
    };
  }

  // ---------- Écriture ----------

  add(item: T): T[] {
    this.dataMap.set(item.id, { ...item });
    this.invalidate();
    return this.findAll();
  }

  addMany(items: T[]): void {
    for (const item of items) {
      this.dataMap.set(item.id, { ...item });
    }
    this.invalidate();
  }

  // Retourne true si c'était un ajout, false si une mise à jour
  upsert(item: T): boolean {
    const existing = this.dataMap.get(item.id);
    if (existing) {
      this.dataMap.set(item.id, { ...existing, ...item });
    } else {
      this.dataMap.set(item.id, { ...item });
    }
    this.invalidate();
    return existing === undefined;
  }

  update(id: string, data: UpdateData<T>): boolean {
    const item = this.dataMap.get(id);
    if (!item) return false;
    this.dataMap.set(id, { ...item, ...data });
    this.invalidate();
    return true;
  }

  updateMany(predicate: PredicateFunction<T>, data: UpdateData<T>): number {
    let count = 0;
    for (const item of this.where(predicate)) {
      if (this.update(item.id, data)) count++;
    }
    return count;
  }

  // Retourne true si l'élément existait et a été supprimé
  // (l'ancienne version retournait un tableau — toujours truthy,
  // ce qui faussait le compteur de deleteMany)
  delete(id: string): boolean {
    const deleted = this.dataMap.delete(id);
    if (deleted) this.invalidate();
    return deleted;
  }

  deleteMany(predicate: PredicateFunction<T>): number {
    let count = 0;
    for (const item of this.where(predicate)) {
      if (this.delete(item.id)) count++;
    }
    return count;
  }

  clear(): void {
    this.dataMap.clear();
    this.invalidate();
  }

  // ---------- Accès collection ----------

  count(): number {
    return this.dataMap.size;
  }

  has(id: string): boolean {
    return this.dataMap.has(id);
  }

  keys(): string[] {
    return Array.from(this.dataMap.keys());
  }

  values(): T[] {
    return Array.from(this.dataMap.values());
  }

  entries(): [string, T][] {
    return Array.from(this.dataMap.entries());
  }

  forEach(
    callback: (value: T, key: string, map: ReadonlyMap<string, T>) => void
  ): void {
    this.dataMap.forEach(callback);
  }

  toMap(): Map<string, T> {
    return new Map(this.dataMap);
  }

  // Lecture seule : empêche les modifications directes non tracées
  // qui contourneraient l'invalidation du cache
  getMap(): ReadonlyMap<string, T> {
    return this.dataMap;
  }

  // ---------- Transformation ----------

  filter(predicate: PredicateFunction<T>): QueryForTable<T> {
    return new QueryForTable(this.where(predicate));
  }

  map<U extends BaseEntity>(
    callback: (item: T, index: number, array: T[]) => U
  ): QueryForTable<U> {
    return new QueryForTable(this.findAll().map(callback));
  }

  reduce<U>(
    callback: (
      accumulator: U,
      currentValue: T,
      currentIndex: number,
      array: T[]
    ) => U,
    initialValue: U
  ): U {
    return this.findAll().reduce(callback, initialValue);
  }

  // En cas d'ids identiques, les éléments de `other` écrasent ceux-ci
  merge(other: QueryForTable<T>): QueryForTable<T> {
    return new QueryForTable([...this.findAll(), ...other.findAll()]);
  }

  // ---------- Aléatoire ----------

  // Fisher-Yates : distribution uniforme
  // (sort(() => Math.random() - 0.5) est biaisé)
  sample(size: number): T[] {
    const all = this.findAll();
    // Copie systématique : findAll() renvoie désormais le cache partagé
    if (size >= all.length) return [...all];

    const shuffled = [...all];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, size);
  }

  random(): T | undefined {
    const all = this.findAll();
    if (all.length === 0) return undefined;
    return all[Math.floor(Math.random() * all.length)];
  }
}

// Types exportés pour utilisation externe
export type {
  BaseEntity,
  PaginationResult,
  PredicateFunction,
  QueryOptions,
  SortOptions,
  StatsResult,
  UpdateData
};
