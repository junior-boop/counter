import { Produit, ProduitModel } from "./db";
import { generateUUID } from "./uuid";

export async function createTable() {
  return await ProduitModel.createTable();
}

export async function getall(): Promise<Produit[]> {
  return await ProduitModel.findAll();
}

export async function getByCategorie(categorie_id: string): Promise<Produit[]> {
  return await ProduitModel.findAll({ where: { categorie_id } });
}

export async function created(data: Omit<Produit, "id">): Promise<Produit> {
  return await ProduitModel.create({ id: generateUUID(), ...data });
}

export async function updated(data: Produit): Promise<Produit | null> {
  const { id, ...rest } = data;
  return await ProduitModel.update(id, rest);
}

export async function deleted(id: string): Promise<boolean> {
  return await ProduitModel.delete(id);
}
