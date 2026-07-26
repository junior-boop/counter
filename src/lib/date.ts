import { Temporal } from "@js-temporal/polyfill";

const FORMATEUR_JOUR_SEMAINE = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
const FORMATEUR_DATE_COMPLETE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const FORMATEUR_HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const FORMATEUR_DATE_COURTE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

function toPlainDate(date: Date | string): Temporal.PlainDate {
    const d = typeof date === "string" ? new Date(date) : date;
    return Temporal.PlainDate.from({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
}

function capitaliser(texte: string): string {
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Aujourd'hui / Hier / Il y a X jours / {Jour} le {j} / date normale au-delà d'une semaine.
 */
export function formaterDateRelative(date: Date | string): string {
    const cible = toPlainDate(date);
    const aujourdhui = Temporal.Now.plainDateISO();
    const diff = aujourdhui.since(cible, { largestUnit: "days" }).days;

    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Hier";
    if (diff >= 2 && diff <= 3) return `Il y a ${diff} jours`;
    if (diff >= 4 && diff <= 6) {
        const jour = FORMATEUR_JOUR_SEMAINE.format(new Date(cible.year, cible.month - 1, cible.day));
        return `${capitaliser(jour)} le ${cible.day}`;
    }
    return FORMATEUR_DATE_COMPLETE.format(new Date(cible.year, cible.month - 1, cible.day));
}

export function formaterHeure(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return FORMATEUR_HEURE.format(d);
}

export function formaterDateCourte(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return FORMATEUR_DATE_COURTE.format(d);
}
