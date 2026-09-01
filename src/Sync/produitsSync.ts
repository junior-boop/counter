import * as Categories from "../Database/categories";
import * as Produits from "../Database/produits";
import { api } from "../lib/api";
import { getDeviceToken } from "./deviceToken";
import { ServerCategorie, ServerProduit } from "./serverTypes";

interface ProduitsDeviceResponse {
  categories: ServerCategorie[];
  produits: ServerProduit[];
}

const UNE_HEURE_MS = 60 * 60 * 1000;

let syncEnCours: Promise<void> | null = null;
let dernierSyncAt: number | null = null;

export async function synchroniserProduits(serverId?: string | null): Promise<void> {
  if (!serverId) return;
  if (syncEnCours) return syncEnCours;
  if (dernierSyncAt && Date.now() - dernierSyncAt < UNE_HEURE_MS) return;

  syncEnCours = executerSynchronisation().finally(() => {
    syncEnCours = null;
  });
  return syncEnCours;
}

async function executerSynchronisation(): Promise<void> {
  dernierSyncAt = Date.now();
  try {
    const deviceToken = await getDeviceToken();
    if (!deviceToken) return;

    const { categories: categoriesDistantes, produits: produitsDistants } = await api.get<ProduitsDeviceResponse>(
      "/device/produits",
      deviceToken
    );

    const categoriesLocales = await Categories.getall();
    const idCategorieLocaleParServeur = new Map<string, string>();

    for (const categorie of categoriesDistantes) {
      const existante = categoriesLocales.find((c) => c.server_categorie_id === categorie.id);
      if (!existante) {
        const creee = await Categories.created({
          nom: categorie.nom,
          type: categorie.type,
          server_categorie_id: categorie.id,
        });
        idCategorieLocaleParServeur.set(categorie.id, creee.id);
        continue;
      }
      idCategorieLocaleParServeur.set(categorie.id, existante.id);
      await Categories.updated({ ...existante, nom: categorie.nom, type: categorie.type });
    }

    const produitsLocaux = await Produits.getall();
    const idsCategoriesDistantes = new Set(categoriesDistantes.map((c) => c.id));
    const idsProduitsDistants = new Set(produitsDistants.map((p) => p.id));

    for (const produit of produitsDistants) {
      const categorie_id = idCategorieLocaleParServeur.get(produit.categorie_id);
      if (!categorie_id) continue;

      const existant = produitsLocaux.find((p) => p.server_produit_id === produit.id);
      if (!existant) {
        await Produits.created({
          nom: produit.nom,
          prix: produit.prix,
          quantite_par_lot: produit.quantite_par_lot,
          categorie_id,
          server_produit_id: produit.id,
        });
        continue;
      }
      await Produits.updated({
        ...existant,
        nom: produit.nom,
        prix: produit.prix,
        quantite_par_lot: produit.quantite_par_lot,
        categorie_id,
      });
    }

    for (const local of produitsLocaux) {
      if (local.server_produit_id && !idsProduitsDistants.has(local.server_produit_id)) {
        await Produits.deleted(local.id);
      }
    }
    for (const local of categoriesLocales) {
      if (local.server_categorie_id && !idsCategoriesDistantes.has(local.server_categorie_id)) {
        await Categories.deleted(local.id);
      }
    }
  } catch {
    // best-effort, jamais bloquant
  }
}
