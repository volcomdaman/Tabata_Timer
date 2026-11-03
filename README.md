# Mon Tabata

Chronomètre d'entraînement en français pour iPhone : thème sombre et pastel, préparation, exercices, repos, rounds, cycles et récupération finale.

L'application est autonome : HTML, CSS et JavaScript, avec une police incluse. Aucun compte ChatGPT, serveur applicatif, installation de dépendances ou abonnement n'est nécessaire pour l'utiliser depuis GitHub Pages. Le mode hors connexion n'est pas encore implémenté.

## Publier gratuitement sur GitHub Pages

1. Créer un dépôt GitHub public nommé **mon-tabata**. GitHub Pages sur GitHub Free nécessite un dépôt public : le code et le site seront accessibles à tous.
2. Mettre tous les fichiers de ce dossier à la racine du dépôt. **index.html doit être directement à la racine**, sans dossier supplémentaire autour. Inclure aussi le dossier fonts et le fichier .nojekyll.
3. Ouvrir **Settings → Pages** dans le dépôt.
4. Choisir **Deploy from a branch**, la branche **main**, le dossier **/(root)**, puis **Save**.
5. Attendre la fin du déploiement. L'adresse affichée par GitHub Pages permettra d'ouvrir le chronomètre dans Safari, sans connexion à ChatGPT.

Pour le compte Flyneus et le dépôt mon-tabata, l'adresse prévue après activation est https://flyneus.github.io/mon-tabata/ . Cette adresse ne fonctionne qu'une fois le dépôt et Pages configurés.

Pour une mise à jour, remplacer les fichiers modifiés sur main : GitHub Pages republie automatiquement la branche configurée.

## Utilisation sur iPhone

1. Ouvrir le nouveau lien dans Safari.
2. Ouvrir les réglages, choisir les durées et les nombres de rounds et cycles, puis toucher **Enregistrer**.
3. Pour vérifier l'enchaînement, charger **Essai rapide · 45 s** dans les réglages, enregistrer, puis commencer.
4. Le bouton rond permet de commencer, mettre en pause et reprendre. Les autres boutons permettent de passer à la phase suivante et de réinitialiser.
5. **+5 s** ajoute cinq secondes à la phase en cours et au temps total restant. Chaque appui se cumule, même en pause. Il fonctionne pendant les exercices, les repos, les repos entre cycles et la récupération finale ; il est désactivé pendant la préparation et après la séance.
6. Dans Safari, utiliser **Partager → Sur l'écran d'accueil** pour créer un raccourci vers la nouvelle adresse.

Les réglages sont enregistrés uniquement dans le navigateur de l'appareil. Le changement d'adresse ne transfère pas les réglages de l'ancien site : il faut les saisir une fois sur le nouveau. Pour conserver tes durées, note-les avant le changement. Le code publié ne contient pas tes réglages enregistrés dans Safari.

## Enchaînement de la séance

- Préparation une seule fois au début ; si sa durée vaut zéro, elle est ignorée.
- Un round comprend un exercice et un repos lorsqu'un autre round suit dans le même cycle.
- Après le dernier exercice d'un cycle, le repos entre cycles remplace le repos habituel.
- Après le dernier exercice de la séance, la récupération finale commence directement.
- Les phases optionnelles réglées à zéro sont ignorées ; un exercice dure au moins une seconde.
- L'option de décompte sonore signale les trois dernières secondes d'une phase d'au moins quatre secondes. Les transitions utilisent des bips plus forts et plus longs ; trois bips annoncent la fin de la séance.

L'exemple initial dure **15 min 40 s**. L'essai rapide dure **45 s**, suivies du bref signal sonore final. Les exemples ne sont pas des recommandations sportives.

## Audio et écran

Une piste audio contenant les signaux de toute la séance est préparée au démarrage. Après un ajout de temps, la partie restante est reconstruite à partir de la position actuelle. Le chronomètre suit le lecteur audio.

Le maintien de l'écran allumé et la lecture écran verrouillé ont été vérifiés sur l'iPhone utilisé pendant le développement. Un court essai sur le nouveau lien reste conseillé, notamment après un ajout de temps. Le volume réel dépend du téléphone, de ses réglages et de la sortie audio. Un appel ou une autre lecture peut interrompre le son.

## Limites

- La configuration initiale est limitée à 60 minutes et 400 exercices. Les ajouts de cinq secondes peuvent dépasser cette durée initiale.
- Recharger ou fermer la page arrête la séance et remet le chronomètre à zéro.
- Le maintien de l'écran dépend du système et du mode économie d'énergie.
- L'accès sans connexion Internet n'est pas encore pris en charge.

## Vérifications techniques

Avec Node.js installé, depuis la racine du dépôt :

~~~sh
node tests/workout.mjs
node tests/extensions.mjs
~~~

Les fichiers applicatifs sont à la racine. Les imports, la police, le manifeste et les liens utilisent des chemins relatifs compatibles avec le sous-dossier d'un projet GitHub Pages.

La police **Bebas Neue**, par Dharma Type, est distribuée sous licence SIL Open Font License 1.1 ; la licence est incluse dans **fonts/OFL.txt**.
