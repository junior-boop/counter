import { Categorie, CategorieModel, TypeActivite } from "./db";
import { generateUUID } from "./uuid";

export async function createTable() {
  return await CategorieModel.createTable();
}

export async function getall(): Promise<Categorie[]> {
  return await CategorieModel.findAll();
}

export async function getByType(type: TypeActivite): Promise<Categorie[]> {
  return await CategorieModel.findAll({ where: { type } });
}

export async function created(data: Omit<Categorie, "id">): Promise<Categorie> {
  return await CategorieModel.create({ id: generateUUID(), ...data });
}

export async function updated(data: Categorie): Promise<Categorie | null> {
  const { id, ...rest } = data;
  return await CategorieModel.update(id, rest);
}

export async function deleted(id: string): Promise<boolean> {
  return await CategorieModel.delete(id);
}
