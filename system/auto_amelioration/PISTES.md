# Pistes d'amélioration

Tenu à jour par la routine quotidienne (charte, règle 6) : ce qu'il reste à faire, ce qui est en test, ce qui est fait.
Chaque piste dit d'où elle vient. Les pistes « à soumettre » relèvent du responsable du projet (charte, règle 5).

## À faire

- **Retraite à 62 ans : messages contradictoires** (test débutants, 30/10/2026). Le pilier « Économie » dit « plutôt négatif »
  alors que le texte dit que l'activité progresse (+0,56 %), avec une explication générique ; le pilier « Social » dit qu'elle
  « ne passe pas par les revenus des ménages ». Il faut une explication propre à cette mesure (court terme et long terme) et
  une mention claire de ce qui n'est pas chiffré (pensions des nouveaux retraités).
- **Page « Le budget » trop dense** (test débutants). Trois totaux de périmètres différents se suivent (dépense publique,
  détail par domaine, État seul) : un petit schéma « 3 chiffres, 3 périmètres ». Écarts d'arrondi (déficit 153 contre
  1 714 − 1 562 = 152 ; protection sociale 690 contre 693) : afficher des sommes qui tombent juste, ou une ligne « autres ».
- **Pistes pour les propriétaires âgés aux revenus modestes** (test débutants, Bernard, 72 ans). L'allègement de taxe foncière
  pour les 65-75 ans et l'exonération après 75 ans, ainsi que MaPrimeAdapt' : de nouvelles fiches dans
  `model/aides/oubliees.yaml`, avec leurs sources officielles (service-public.gouv.fr, anah.gouv.fr).
- **Chèque énergie : plafond adapté au foyer** (test débutants). Pour une mère de deux enfants, la fiche cite le plafond
  d'une personne seule (11 000 €) au lieu de celui du foyer (environ 19 800 €). Calculer le plafond selon les unités de
  consommation.
- **C2S d'un propriétaire** (test débutants). Un forfait logement s'ajoute aux ressources d'un propriétaire : la piste est
  proposée trop facilement. Le prendre en compte (source : ameli.fr), ou dire « proche du plafond, à vérifier ».
- **Idées toutes prêtes pour les retraités actuels** (test débutants). Aucune ne les concerne directement : par exemple
  « Minimum vieillesse + 100 € » ou « Revaloriser les pensions ». Elles doivent rester équilibrées (financement indiqué).
- **Foyer exemple « Parent seul »** dans « Mes droits » (test débutants) ; le simulateur de réformes en a déjà un.
- **Ordinateur partagé** (test débutants) : un bouton « Effacer mes réponses » dans « Mes droits ».
- **« Se connecter » en haut de page** déroute, alors que la visite promet « sans compte » (test débutants) : dire que c'est
  facultatif, et à quoi sert un compte.
- **Message répété** dans « Changer les règles » : « Encore une étape : il manque 14 milliards € » apparaît deux fois de suite.
- **Jargon restant** : « APL/ALF/ALS », « Décote : taux », « cerfa n° … ».
- **À soumettre au responsable** : limiter le nombre de simulations de réforme simultanées si la fréquentation augmente
  (le serveur de 4 Go met jusqu'à une minute et demie pour la première simulation).

## En bêta

- **« Avez-vous pensé à… ? »**, les aides souvent oubliées dans « Mes droits » (depuis le 30/10/2026). Bilan possible à
  partir du 13/11/2026.

## Fait

- 30/10/2026 : la TVA compte dans le pouvoir d'achat des ménages ; la pension alimentaire est demandée aux parents seuls ;
  « Pourquoi aucune aide ? » ; allocation de rentrée scolaire présentée comme annuelle ; bouton « A+ » ; bouton d'avis discret
  (test première visite, Nadia et Bernard).
