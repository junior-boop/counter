import { ModelFactory, SimpleORM, DatabaseRow } from "../../SimpleORM";

export type TypeActivite = "bar" | "restaurant";

export interface Categorie extends DatabaseRow {
  id?: number;
  nom: string;
  type: TypeActivite;
}

export interface Produit extends DatabaseRow {
  id?: number;
  nom: string;
  prix: number;
  quantite_par_lot?: number | null;
  categorie_id: number;
}

const orm = new SimpleORM("vms-counter.db");
const factory = new ModelFactory(orm);

export const CategorieModel = factory.createModel<Categorie>("categories", {
  id: "INTEGER PRIMARY KEY AUTOINCREMENT",
  nom: "TEXT NOT NULL",
  type: "TEXT NOT NULL",
});

export const ProduitModel = factory.createModel<Produit>("produits", {
  id: "INTEGER PRIMARY KEY AUTOINCREMENT",
  nom: "TEXT NOT NULL",
  prix: "REAL NOT NULL",
  quantite_par_lot: "INTEGER",
  categorie_id: "INTEGER NOT NULL",
});

export async function initDatabase() {
  await CategorieModel.createTable();
  await ProduitModel.createTable();
}
