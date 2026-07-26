const FORMATEUR_MONTANT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, style: "currency", currency: "XAF" });

export function formaterMontant(montant: number): string {
    return FORMATEUR_MONTANT.format(montant);
}
