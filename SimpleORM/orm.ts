// types.ts
import * as SQLite from "expo-sqlite";

/** Valeurs liables aux paramètres SQL d'expo-sqlite. */
export type SQLValue = string | number | boolean | null | Uint8Array;

export interface QueryResult {
  lastID?: number;
  changes: number;
}

// Les rows renvoyées par SQLite ont un schéma dynamique : on garde `any` ici
// (les types concrets sont définis dans les modèles, qui étendent DatabaseRow).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DatabaseRow {
  [key: string]: any;
}

export interface WhereConditions {
  [key: string]: SQLValue;
}

export interface OrderByOptions {
  column: string;
  direction?: "ASC" | "DESC";
}

export interface IncludeOptions {
  model: string;
  foreignKey: string;
  localKey?: string;
  as?: string;
}

export interface QueryOptions {
  where?: WhereConditions;
  orderBy?: OrderByOptions | OrderByOptions[];
  limit?: number;
  offset?: number;
  include?: IncludeOptions | IncludeOptions[];
}

export interface TableSchema {
  [columnName: string]: string;
}

export type ModelKeys<T> = {
  [K in keyof T]: K;
};

export type ModelTypes<T> = {
  [K in keyof T]: T[K] extends string
    ? "string"
    : T[K] extends number
    ? "number"
    : T[K] extends boolean
    ? "boolean"
    : T[K] extends Date
    ? "date"
    : "any";
};

export interface ModelWithMeta<T extends DatabaseRow> {
  keys: ModelKeys<T>;
  types: ModelTypes<T>;
  tableName: string;
}

export interface QueryBuilder<T extends DatabaseRow> {
  where(conditions: WhereConditions): QueryBuilder<T>;
  orderBy(column: string, direction?: "ASC" | "DESC"): QueryBuilder<T>;
  limit(limit: number): QueryBuilder<T>;
  offset(offset: number): QueryBuilder<T>;
  include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T>;
  findAll(): Promise<T[]>;
  findOne(): Promise<T | null>;
  count(): Promise<number>;
}

export interface ModelInstance<T extends DatabaseRow> extends Partial<T> {
  save(): Promise<T>;
  delete(): Promise<boolean>;
}

export interface ModelClass<T extends DatabaseRow> extends ModelWithMeta<T> {
  new (data?: Partial<T>): ModelInstance<T>;
  createTable(): Promise<QueryResult>;
  create(data: Partial<T>): Promise<T>;
  createMany(dataArray: Partial<T>[]): Promise<T[]>;
  findAll(options?: QueryOptions): Promise<T[]>;
  findById(
    id: string | number,
    options?: { include?: IncludeOptions | IncludeOptions[] }
  ): Promise<T | null>;
  findOne(options: QueryOptions): Promise<T | null>;
  update(id: string | number, data: Partial<T>): Promise<T | null>;
  updateWhere(conditions: WhereConditions, data: Partial<T>): Promise<number>;
  delete(id: string | number): Promise<boolean>;
  deleteWhere(conditions: WhereConditions): Promise<number>;
  exists(conditions: WhereConditions): Promise<boolean>;
  upsert(data: Partial<T>): Promise<T>;
  upsertWithCoalesce(data: Partial<T>): Promise<T>;
  where(conditions: WhereConditions): QueryBuilder<T>;
  orderBy(column: string, direction?: "ASC" | "DESC"): QueryBuilder<T>;
  limit(limit: number): QueryBuilder<T>;
  offset(offset: number): QueryBuilder<T>;
  include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T>;
  orm: SimpleORM;
}

type text = "TEXT";
type primaryKey = "PRIMARY KEY";
type notNull = "NOT NULL";
type real = "REAL";
type integer = "INTEGER" | "INT";
type blob = "BLOB";
type Null = "NULL";
type foreignKey = "FOREIGN KEY";
type Default = "DEFAULT" | "DEFAULT";
type time = "TIME";
type timestamp = "TIMESTAMP";
type current = "CURRENT_TIMESTAMP";
type datetime = "DATETIME";

type TextWithSuffix =
  | text
  | primaryKey
  | notNull
  | real
  | integer
  | blob
  | Null
  | foreignKey
  | Default
  | "UNIQUE"
  | `${text | integer | real | blob} ${
      | primaryKey
      | foreignKey
      | notNull
      | Null
      | "UNIQUE"
      | "AUTOINCREMENT"}`
  | `${text | integer | real} ${primaryKey | foreignKey | notNull | Null} ${
      | notNull
      | Null
      | Default
      | "UNIQUE"
      | "AUTOINCREMENT"}`
  | `${datetime | time | timestamp}`
  | `${datetime | time | timestamp} ${notNull | null}`
  | `${datetime | time | timestamp} ${notNull | null | Default} ${current}`
  | `${datetime | time | timestamp} ${notNull | null} ${
      | current
      | Default} ${current}`;

type Schema<T extends TableSchema> = {
  [K in keyof T]: TextWithSuffix;
};

// SimpleORM.ts
export class SimpleORM {
  private db: SQLite.SQLiteDatabase;

  constructor(dbName: string) {
    this.db = SQLite.openDatabaseSync(dbName);
  }

  async query<T = DatabaseRow>(sql: string, params: SQLValue[] = []): Promise<T[]> {
    try {
      const result = await this.db.getAllAsync<T>(sql, params);
      return result || [];
    } catch (err) {
      throw err;
    }
  }

  async run(sql: string, params: SQLValue[] = []): Promise<QueryResult> {
    try {
      const result = await this.db.runAsync(sql, params);
      return {
        lastID: result.lastInsertRowId,
        changes: result.changes,
      };
    } catch (err) {
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }

  getDatabase(): SQLite.SQLiteDatabase {
    return this.db;
  }

  // Nouvelles méthodes utilitaires pour simplifier les appels
  async createTable(
    tableName: string,
    schema: TableSchema
  ): Promise<QueryResult> {
    const columnDefs = Object.entries(schema)
      .map(([name, type]) => `${name} ${type}`)
      .join(", ");

    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`;
    return this.run(sql);
  }

  async create<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>
  ): Promise<T> {
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    const result = await this.run(sql, values);

    return { id: result.lastID, ...data } as T;
  }

  async createMany<T extends DatabaseRow>(
    tableName: string,
    dataArray: Partial<T>[]
  ): Promise<T[]> {
    const results: T[] = [];
    for (const data of dataArray) {
      const result = await this.create<T>(tableName, data);
      results.push(result);
    }
    return results;
  }

  async findAll<T extends DatabaseRow>(
    tableName: string,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const { where = {}, orderBy, limit, offset, include } = options;

    let sql = `SELECT * FROM ${tableName}`;
    let params: SQLValue[] = [];

    if (Object.keys(where).length > 0) {
      const whereClause = Object.keys(where)
        .map((key) => `${key} = ?`)
        .join(" AND ");
      sql += ` WHERE ${whereClause}`;
      params = Object.values(where);
    }

    if (orderBy) {
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      const orderClauses = orderByArray
        .map((order) => `${order.column} ${order.direction || "ASC"}`)
        .join(", ");
      sql += ` ORDER BY ${orderClauses}`;
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

    let results = await this.query<T>(sql, params);
    if (include && results.length > 0) {
      results = await this.handleIncludes<T>(tableName, results, include);
    }

    return results;
  }

  async findById<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    options: { include?: IncludeOptions | IncludeOptions[] } = {}
  ): Promise<T | null> {
    const { include } = options;

    const sql = `SELECT * FROM ${tableName} WHERE id = ?`;
    const rows = await this.query<T>(sql, [id]);
    let result = rows[0] || null;

    if (result && include) {
      const results = await this.handleIncludes<T>(
        tableName,
        [result],
        include
      );
      result = results[0];
    }

    return result;
  }

  async findOne<T extends DatabaseRow>(
    tableName: string,
    options: QueryOptions
  ): Promise<T | null> {
    const { where = {}, orderBy, include } = options;

    const whereClause = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    let sql = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
    const params = Object.values(where);

    if (orderBy) {
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      const orderClauses = orderByArray
        .map((order) => `${order.column} ${order.direction || "ASC"}`)
        .join(", ");
      sql += ` ORDER BY ${orderClauses}`;
    }

    sql += " LIMIT 1";

    const rows = await this.query<T>(sql, params);
    let result = rows[0] || null;

    if (result && include) {
      const results = await this.handleIncludes<T>(
        tableName,
        [result],
        include
      );
      result = results[0];
    }

    return result;
  }

  async update<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    data: Partial<T>
  ): Promise<T | null> {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(", ");
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
    const params = [...Object.values(data), id];

    await this.run(sql, params);
    return await this.findById<T>(tableName, id);
  }

  async updateWhere<T extends DatabaseRow>(
    tableName: string,
    conditions: WhereConditions,
    data: Partial<T>
  ): Promise<number> {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(", ");
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(conditions)];

    const result = await this.run(sql, params);
    return result.changes;
  }

  async delete(tableName: string, id: string | number): Promise<boolean> {
    const sql = `DELETE FROM ${tableName} WHERE id = ?`;
    const result = await this.run(sql, [id]);
    return result.changes > 0;
  }

  async deleteWhere(
    tableName: string,
    conditions: WhereConditions
  ): Promise<number> {
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;
    const params = Object.values(conditions);

    const result = await this.run(sql, params);
    return result.changes;
  }

  async exists(
    tableName: string,
    conditions: WhereConditions
  ): Promise<boolean> {
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    const sql = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`;
    const params = Object.values(conditions);

    const result = await this.query<{ count: number }>(sql, params);
    return (result[0]?.count || 0) > 0;
  }

  async count(
    tableName: string,
    conditions: WhereConditions = {}
  ): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    let params: SQLValue[] = [];

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key) => `${key} = ?`)
        .join(" AND ");
      sql += ` WHERE ${whereClause}`;
      params = Object.values(conditions);
    }

    const result = await this.query<{ count: number }>(sql, params);
    return result[0]?.count || 0;
  }

  async upsert<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>
  ): Promise<T> {
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const sql = `INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    const result = await this.run(sql, values);

    return { id: result.lastID || (data as any).id, ...data } as T;
  }

  async upsertWithCoalesce<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>
  ): Promise<T> {
    const { id, ...updateData } = data as any;

    if (!id) {
      return this.create<T>(tableName, data);
    }

    const exists = await this.findById<T>(tableName, id);

    if (exists) {
      return this.update<T>(tableName, id, updateData) as Promise<T>;
    } else {
      return this.create<T>(tableName, data);
    }
  }

  async handleIncludes<T extends DatabaseRow>(
    tableName: string,
    results: T[],
    include: IncludeOptions | IncludeOptions[]
  ): Promise<T[]> {
    const includeArray = Array.isArray(include) ? include : [include];

    for (const includeOption of includeArray) {
      const {
        model: includeTable,
        foreignKey,
        localKey = "id",
        as,
      } = includeOption;
      const relationName = as || includeTable;

      const ids = [
        ...new Set(
          results.map((row) => (row as any)[localKey]).filter(Boolean)
        ),
      ];

      if (ids.length === 0) continue;

      const placeholders = ids.map(() => "?").join(", ");
      const relatedSql = `SELECT * FROM ${includeTable} WHERE ${foreignKey} IN (${placeholders})`;
      const relatedData = await this.query(relatedSql, ids);

      const relatedMap = new Map();
      relatedData.forEach((item) => {
        const key = (item as any)[foreignKey];
        if (!relatedMap.has(key)) {
          relatedMap.set(key, []);
        }
        relatedMap.get(key).push(item);
      });

      results.forEach((row) => {
        const localId = (row as any)[localKey];
        (row as any)[relationName] = relatedMap.get(localId) || [];
      });
    }

    return results;
  }
}

// Classe ModelFactory
export class ModelFactory {
  private orm: SimpleORM;

  constructor(orm: SimpleORM) {
    this.orm = orm;
  }

  createModel<T extends DatabaseRow>(
    tableName: string,
    schema: Schema<T>,
    sampleData?: T
  ): ModelClass<T> {
    const orm = this.orm;

    const generateMetadata = (): {
      keys: ModelKeys<T>;
      types: ModelTypes<T>;
    } => {
      const keys: Record<string, string> = {};
      const types: Record<string, string> = {};

      if (sampleData) {
        for (const [key, value] of Object.entries(sampleData)) {
          keys[key] = key;
          types[key] =
            value instanceof Date
              ? "date"
              : typeof value === "boolean"
              ? "boolean"
              : typeof value;
        }
      } else {
        for (const [key, type] of Object.entries(schema)) {
          keys[key] = key;
          types[key] = type.toLowerCase().includes("int")
            ? "number"
            : type.toLowerCase().includes("text")
            ? "string"
            : type.toLowerCase().includes("bool")
            ? "boolean"
            : type.toLowerCase().includes("date")
            ? "date"
            : "any";
        }
      }

      return {
        keys: keys as unknown as ModelKeys<T>,
        types: types as unknown as ModelTypes<T>,
      };
    };

    const metadata = generateMetadata();

    class QueryBuilderImpl implements QueryBuilder<T> {
      private conditions: WhereConditions = {};
      private orderByOptions: OrderByOptions[] = [];
      private limitValue?: number;
      private offsetValue?: number;
      private includeOptions: IncludeOptions[] = [];

      constructor(private tableName: string, private orm: SimpleORM) {}

      where(conditions: WhereConditions): QueryBuilder<T> {
        this.conditions = { ...this.conditions, ...conditions };
        return this;
      }

      orderBy(
        column: string,
        direction: "ASC" | "DESC" = "ASC"
      ): QueryBuilder<T> {
        this.orderByOptions.push({ column, direction });
        return this;
      }

      limit(limit: number): QueryBuilder<T> {
        this.limitValue = limit;
        return this;
      }

      offset(offset: number): QueryBuilder<T> {
        this.offsetValue = offset;
        return this;
      }

      include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T> {
        this.includeOptions = this.includeOptions.concat(
          Array.isArray(options) ? options : [options]
        );
        return this;
      }

      async findAll(): Promise<T[]> {
        return this.orm.findAll<T>(this.tableName, {
          where: this.conditions,
          orderBy: this.orderByOptions,
          limit: this.limitValue,
          offset: this.offsetValue,
          include: this.includeOptions,
        });
      }

      async findOne(): Promise<T | null> {
        return this.orm.findOne<T>(this.tableName, {
          where: this.conditions,
          orderBy: this.orderByOptions,
          include: this.includeOptions,
        });
      }

      async count(): Promise<number> {
        return this.orm.count(this.tableName, this.conditions);
      }
    }

    class GeneratedModel implements ModelInstance<T> {
      // Index signature requise car `Object.assign(this, data)` copie des champs dynamiques.
      // `unknown` force le narrowing côté consommateur (vs `any` qui le contourne).
      [key: string]: unknown;
      private data: Partial<T>;

      constructor(data: Partial<T> = {}) {
        this.data = data;
        Object.assign(this, data);
      }

      async save(): Promise<T> {
        if (this.data.id) {
          const updated = await orm.update<T>(
            tableName,
            this.data.id as string | number,
            this.data
          );
          if (updated) {
            Object.assign(this, updated);
            return updated;
          }
          throw new Error("Failed to update record");
        } else {
          const created = await orm.create<T>(tableName, this.data);
          Object.assign(this, created);
          return created;
        }
      }

      async delete(): Promise<boolean> {
        if (!this.data.id) {
          throw new Error("Cannot delete unsaved record");
        }
        return orm.delete(tableName, this.data.id as string | number);
      }

      static async createTable(): Promise<QueryResult> {
        return orm.createTable(tableName, schema);
      }

      static async createMany(dataArray: Partial<T>[]): Promise<T[]> {
        return orm.createMany<T>(tableName, dataArray);
      }

      static async create(data: Partial<T>): Promise<T> {
        return orm.create<T>(tableName, data);
      }

      static async findAll(options?: QueryOptions): Promise<T[]> {
        return orm.findAll<T>(tableName, options);
      }

      static async findById(
        id: string | number,
        options?: { include?: IncludeOptions | IncludeOptions[] }
      ): Promise<T | null> {
        return orm.findById<T>(tableName, id, options);
      }

      static async findOne(options: QueryOptions): Promise<T | null> {
        return orm.findOne<T>(tableName, options);
      }

      static async update(
        id: string | number,
        data: Partial<T>
      ): Promise<T | null> {
        return orm.update<T>(tableName, id, data);
      }

      static async delete(id: string | number): Promise<boolean> {
        return orm.delete(tableName, id);
      }

      static async exists(conditions: WhereConditions): Promise<boolean> {
        return orm.exists(tableName, conditions);
      }

      static where(conditions: WhereConditions): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).where(conditions);
      }

      static orderBy(
        column: string,
        direction?: "ASC" | "DESC"
      ): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).orderBy(column, direction);
      }

      static limit(limit: number): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).limit(limit);
      }

      static offset(offset: number): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).offset(offset);
      }

      static include(
        options: IncludeOptions | IncludeOptions[]
      ): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).include(options);
      }

      static async updateWhere(
        conditions: WhereConditions,
        data: Partial<T>
      ): Promise<number> {
        return orm.updateWhere<T>(tableName, conditions, data);
      }

      static async deleteWhere(conditions: WhereConditions): Promise<number> {
        return orm.deleteWhere(tableName, conditions);
      }

      static async upsert(data: Partial<T>): Promise<T> {
        return orm.upsert<T>(tableName, data);
      }

      static async upsertWithCoalesce(data: Partial<T>): Promise<T> {
        return orm.upsertWithCoalesce<T>(tableName, data);
      }
    }

    Object.assign(GeneratedModel, {
      ...metadata,
      tableName,
      orm,
    });

    return GeneratedModel as any as ModelClass<T>;
  }
}
