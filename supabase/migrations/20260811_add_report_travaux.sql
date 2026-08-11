-- Report d'exercice — catégorie de détail d'import
--
-- La table travaux_import_details a déjà été appliquée en production
-- (migration 20260811_add_travaux_import_details.sql). On ne modifie PAS cette
-- ancienne migration : on altère la contrainte `type` via une nouvelle migration
-- idempotente, pour autoriser la catégorie « report » écrite par importTravauxBatch
-- (report d'exercice : seule annee_exercice change).

alter table public.travaux_import_details
  drop constraint if exists travaux_import_details_type_check;

alter table public.travaux_import_details
  add constraint travaux_import_details_type_check
  check (type in ('creee', 'conflit', 'inchangee', 'archivee', 'doublon', 'ignoree', 'erreur', 'report'));
