import { DatabaseRow, ModelFactory, SimpleORM } from "../../SimpleORM";

export type TypeActivite = "bar" | "restaurant";

export interface Categorie extends DatabaseRow {
  id: string;
  nom: string;
  type: TypeActivite;
}

export interface Produit extends DatabaseRow {
  id: string;
  nom: string;
  prix: number;
  quantite_par_lot?: number | null;
  categorie_id: string;
}

const orm = new SimpleORM("vms-counter.db");
const factory = new ModelFactory(orm);

export const CategorieModel = factory.createModel<Categorie>("categories", {
  id: "TEXT PRIMARY KEY",
  nom: "TEXT NOT NULL",
  type: "TEXT NOT NULL",
});

export const ProduitModel = factory.createModel<Produit>("produits", {
  id: "TEXT PRIMARY KEY",
  nom: "TEXT NOT NULL",
  prix: "REAL NOT NULL",
  quantite_par_lot: "INTEGER",
  categorie_id: "TEXT NOT NULL",
});
