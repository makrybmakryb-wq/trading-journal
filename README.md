# 📈 Journal de trading

Journal de trading personnel : enregistrez, modifiez, supprimez et analysez vos trades.
Tableau de bord, graphiques, calendrier, formulaire avec calculs automatiques. 100 % dans le navigateur, sans serveur.

**Site en ligne :** https://makrybmakryb-wq.github.io/trading-journal/

## ⚠️ Où sont mes données ?

Dans **votre navigateur, sur votre appareil** (IndexedDB). Rien n'est envoyé sur Internet, et le dépôt GitHub ne contient jamais vos trades.
Conséquences : pas de synchronisation PC ↔ téléphone, et perte possible si vous videz les données du site.
👉 **Paramètres → Télécharger une sauvegarde** régulièrement (fichier `.json`, captures comprises), et « Restaurer » pour la remettre sur un autre appareil.

## Publier sur GitHub Pages

Le site compilé est dans le dossier `docs/`.

1. Déposez le contenu de ce projet dans le dépôt (en conservant `docs/`).
2. GitHub → **Settings → Pages → Build and deployment** → Source : *Deploy from a branch* → Branch : `main`, dossier **`/docs`** → Save.
3. Après 1 à 2 minutes : https://makrybmakryb-wq.github.io/trading-journal/

Après toute modification du code : `npm run build:pages`, puis commit + push de `docs/`.

## Lancer en local

Prérequis : Node.js 20+.
```bash
npm install
npm run dev        # développement → http://localhost:3000
npm run start      # compile puis sert la version finale → http://localhost:3000
npm test           # vérifie les formules
```

## Architecture

| Fichier | Rôle |
|---|---|
| `src/lib/db.ts` | Stockage IndexedDB (trades) |
| `src/lib/api.ts` | Ajout / modification / suppression, calculs, réduction des captures d'écran |
| `src/lib/backup.ts` | Sauvegarde JSON, restauration, export CSV |
| `src/lib/seed.ts` | Données de démonstration (bouton sur le tableau de bord vide) |
| `shared/calc.ts` | Calculs d'un trade (brut, net, %, R) |
| `shared/stats.ts` | Tous les indicateurs et regroupements des graphiques |
| `src/pages/`, `src/components/` | Interface (React, Tailwind, Recharts) |

Les pages utilisent des adresses de type `…/trading-journal/#/trades` (routage par `#`), nécessaire sur GitHub Pages.

## Formules

**Par trade** — Montant engagé en $. Brut = montant × (sortie − entrée) ÷ entrée (long) ou montant × (entrée − sortie) ÷ entrée (short). Frais = 0,0005 % × montant, **à l'entrée uniquement** (1 000 000 $ → 5 $). Net = brut − frais. Gain/perte % = net ÷ montant × 100. Taille de position = montant ÷ capital actuel × 100. Ratio R réalisé = RR saisi (TP touché) ou −1 R (SL touché).

**Tableau de bord** — Taux de réussite = gagnants ÷ (gagnants + perdants) (équilibre exclu). Profit brut / perte brute = somme des nets positifs / négatifs. Gain / perte moyens = ÷ nombre de gagnants / perdants. Profit factor = profit brut ÷ |perte brute|. Drawdown maximal = plus grande baisse du capital cumulé depuis un plus-haut. Risque/rendement moyen = moyenne des R. Espérance = P&L net ÷ nombre de trades.

## Limites

- Pas de conversion de devises (totaux additionnés tels quels).
- Les captures d'écran sont réduites (1600 px max, JPEG) pour économiser l'espace du navigateur.
