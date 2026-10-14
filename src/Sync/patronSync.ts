import * as Categories from "../Database/categories";
import * as Produits from "../Database/produits";
import * as Utilisateurs from "../Database/utilisateurs";
import * as EtablissementDb from "../Database/etablissement";
import { api } from "../lib/api";
import { ServerCategorie, ServerEmploye, ServerEtablissement, ServerProduit } from "./serverTypes";
import { Utilisateur } from "../Database/db";

/**
 * Synchronise l'établissement distant sélectionné par le patron dans la base SQLite locale.
 * Permet au patron d'entrer dans l'interface complète (ventes, caisse, stock, inventaires)
 * avec tous les droits administrateur.
 */
export async function synchroniserEtablissementPourPatron(
  etablissementId: string,
  token: string,
  patronId: string,
  patronEmail: string
): Promise<Utilisateur> {
  // 1. Récupérer les informations de l'établissement et son catalogue
  const [etab, categoriesDistantes, produitsDistants, employesDistants] = await Promise.all([
    api.get<ServerEtablissement>(`/etablissements/${etablissementId}`, token),
    api.get<ServerCategorie[]>(`/etablissements/${etablissementId}/categories`, token),
    api.get<ServerProduit[]>(`/etablissements/${etablissementId}/produits`, token),
    api.get<ServerEmploye[]>(`/etablissements/${etablissementId}/employes`, token).catch(() => []),
  ]);

  // 2. Mettre à jour l'établissement dans SQLite local
  await EtablissementDb.save({
    nom: etab.nom,
    type: etab.type as any,
    server_id: etab.id,
    commande_temps_reel_active: true,
  });

  // 3. Synchroniser les catégories
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
    } else {
      idCategorieLocaleParServeur.set(categorie.id, existante.id);
      await Categories.updated({ ...existante, nom: categorie.nom, type: categorie.type });
    }
  }

  // 4. Synchroniser les produits
  const produitsLocaux = await Produits.getall();
  for (const produit of produitsDistants) {
    const categorieLocaleId = idCategorieLocaleParServeur.get(produit.categorie_id);
    if (!categorieLocaleId) continue;

    const existant = produitsLocaux.find((p) => p.server_produit_id === produit.id);
    if (!existant) {
      await Produits.created({
        nom: produit.nom,
        prix: produit.prix,
        quantite_par_lot: produit.quantite_par_lot,
        categorie_id: categorieLocaleId,
        server_produit_id: produit.id,
        stock_actuel: 0,
        seuil_alerte: null,
      });
    } else {
      await Produits.updated({
        ...existant,
        nom: produit.nom,
        prix: produit.prix,
        quantite_par_lot: produit.quantite_par_lot,
        categorie_id: categorieLocaleId,
      });
    }
  }

  // 5. Synchroniser les employés pour les filtres et attributions
  const utilisateursLocaux = await Utilisateurs.getall();
  for (const employe of employesDistants) {
    const existant = utilisateursLocaux.find((u) => u.server_employe_id === employe.id);
    if (!existant) {
      await Utilisateurs.created({
        nom: employe.nom,
        code: employe.telephone,
        role: employe.role,
        telephone: employe.telephone,
        server_employe_id: employe.id,
        password_verifier: null,
        password_salt_local: null,
        password_synced_version: null,
      });
    }
  }

  // 6. Enregistrer ou mettre à jour le compte Patron dans SQLite local
  let patronUser = utilisateursLocaux.find((u) => u.role === "patron" || u.server_employe_id === patronId);
  if (!patronUser) {
    patronUser = await Utilisateurs.created({
      nom: "Patron",
      code: "patron",
      role: "patron",
      telephone: patronEmail,
      server_employe_id: patronId,
      password_verifier: null,
      password_salt_local: null,
      password_synced_version: null,
    });
  }

  return patronUser;
}
