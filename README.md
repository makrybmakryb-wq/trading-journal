# 📈 Journal de trading

Application web locale pour enregistrer, consulter, modifier, supprimer et analyser vos trades.
Interface sombre, tableau de bord, 6 types de graphiques, calendrier interactif, formulaire complet avec calculs automatiques.

## Installation et lancement

Prérequis : **Node.js 20 ou plus** (`node -v` pour vérifier). Dans un terminal, depuis ce dossier :

```bash
npm install        # installe les dépendances (une seule fois)
npm run build      # compile l'interface (à refaire si vous modifiez le code de src/)
npm start          # lance le site → http://localhost:3000
```

Pour tester avec des données fictives (≈ 100 trades) : `npm run seed` (avant ou après `npm start`).

Mode développement (rechargement automatique, interface sur http://localhost:5173) : `npm run dev`.
Vérifier les formules : `npm test`. Vérifier les types : `npm run typecheck`.

## Où sont mes données ?

Dans le dossier `data/` (créé automatiquement) : `journal.db` (SQLite) et `uploads/` (captures d'écran).
Elles survivent aux redémarrages. **Sauvegarde = copier le dossier `data/`.** Export CSV : page Paramètres ou bouton « CSV » du journal.

## Architecture

| Fichier / dossier | Rôle |
|---|---|
| `server/index.ts` | Serveur Express : API REST (`/api/trades`…), validation (zod), envoi des captures, sert l'interface compilée |
| `server/db.ts` | Base SQLite (better-sqlite3) : création de la table, conversion lignes ⇄ objets |
| `server/seed.ts` | Données de démonstration |
| `shared/calc.ts` | Calculs d'un trade (brut, net, %, R) — utilisés par le serveur **et** l'aperçu du formulaire |
| `shared/stats.ts` | Tous les indicateurs du tableau de bord et regroupements des graphiques |
| `src/pages/` | Tableau de bord, Journal, Calendrier, Analyses, Paramètres |
| `src/components/` | Formulaire de trade, graphiques (Recharts), filtres de période, fenêtres modales |

Choix techniques : React + Vite + TypeScript + Tailwind + Recharts pour l'interface ; Express + SQLite pour la persistance.
J'ai utilisé `better-sqlite3` plutôt que Prisma : même base SQLite, mais sans étape de génération ni téléchargement de moteur, donc plus simple à installer.

## Formules

**Par trade** (`shared/calc.ts`)
- Brut = (sortie − entrée) × quantité (long) ; (entrée − sortie) × quantité (short). Vous pouvez aussi saisir le brut à la main (utile en Forex/CFD).
- Net = brut − frais
- Gain/perte % = net ÷ (entrée × quantité) × 100
- Risque = risque prévu saisi, sinon |entrée − stop-loss| × quantité
- Ratio R réalisé = net ÷ risque

**Tableau de bord** (`shared/stats.ts`)
- Taux de réussite = gagnants ÷ (gagnants + perdants) × 100 (équilibre exclu)
- Profit brut / perte brute = somme des nets positifs / négatifs
- Gain moyen / perte moyenne = profit brut ÷ nb gagnants / perte brute ÷ nb perdants
- Profit factor = profit brut ÷ |perte brute|
- Drawdown maximal = plus grande baisse du capital cumulé depuis un plus-haut
- Risque/rendement moyen = moyenne des R réalisés (trades dont le risque est connu)
- Espérance = P&L net ÷ nombre de trades

## Limites connues

- Pas de conversion de devises : les totaux additionnent les résultats tels quels.
- Application mono-utilisateur, sans authentification (prévue pour un usage local).
