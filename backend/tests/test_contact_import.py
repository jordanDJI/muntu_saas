"""
Tests des règles d'enrichissement à l'import de contacts.

Ce sont des fonctions pures : aucune base requise (le CLAUDE.md interdit les
mock DB). La règle « une cellule vide n'efface jamais rien » est la plus
importante du lot — sans elle, un fichier partiel vide le CRM.

Lancement :
    cd backend && python -m unittest discover -s tests -v
"""
import os
import unittest

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("RESEND_API_KEY", "test")
os.environ.setdefault("EMAIL_FROM", "test@example.com")
os.environ.setdefault("SECRET_KEY", "test")
os.environ.setdefault("GEMINI_API_KEY", "test")
os.environ.setdefault("FRONTEND_URL", "https://klientys.co")
os.environ.setdefault("APP_URL", "https://klientys.co")

from app.api.v1.contact_fields import DEFAULT_BASE_FIELDS  # noqa: E402
from app.api.v1.contacts import (_csv_row_to_contact_fields, _match_existing,  # noqa: E402
                                 _plan_enrichment)

FIELD_DEFS = [
    {"field_key": "first_name", "storage_mode": "column", "field_type": "text"},
    {"field_key": "email", "storage_mode": "column", "field_type": "email"},
    {"field_key": "phone", "storage_mode": "column", "field_type": "phone"},
    {"field_key": "city", "storage_mode": "jsonb", "field_type": "text"},
    {"field_key": "gender", "storage_mode": "jsonb", "field_type": "select"},
]


def _fields(**kw) -> dict:
    """Ligne de fichier normalisée, telle que la produit _csv_row_to_contact_fields."""
    base = {"first_name": None, "last_name": None, "email": None, "phone": None,
            "notes": None, "category": None, "segment": None, "custom_fields": None}
    custom = kw.pop("custom_fields", None)
    base.update(kw)
    base["custom_fields"] = custom
    return base


REAL_DEFS = [
    {"field_key": k, "label": lbl, "field_type": ft, "storage_mode": sm,
     "is_base": True, "enabled": True, "required": False, "position": i, "options": opts}
    for i, (k, lbl, ft, sm, opts) in enumerate(DEFAULT_BASE_FIELDS)
]


class TestCustomFieldsJamaisNull(unittest.TestCase):
    """
    `contact.custom_fields` est NOT NULL DEFAULT '{}'. Une valeur par défaut ne
    s'applique que si la clé est absente de l'insert : envoyer null faisait
    échouer la requête, et comme l'insertion est groupée, tout l'import avec elle.
    """

    def test_ligne_sans_champ_jsonb_renvoie_un_dict_vide(self):
        row = {"prénom": "Bruno", "nom": "Lemaire", "email": "bruno@example.com",
               "téléphone": "0612000002", "catégorie": "prospect"}
        fields = _csv_row_to_contact_fields(row, REAL_DEFS)
        self.assertEqual(fields["custom_fields"], {})
        self.assertIsNotNone(fields["custom_fields"])

    def test_ligne_avec_champ_jsonb(self):
        row = {"email": "chloe@example.com", "ville": "Brest"}
        fields = _csv_row_to_contact_fields(row, REAL_DEFS)
        self.assertEqual(fields["custom_fields"], {"city": "Brest"})

    def test_ligne_entierement_vide(self):
        fields = _csv_row_to_contact_fields({}, REAL_DEFS)
        self.assertEqual(fields["custom_fields"], {})


class TestCelluleVide(unittest.TestCase):
    """Une colonne vide signifie « information absente », jamais « supprime »."""

    def test_colonne_vide_nefface_pas_une_colonne(self):
        contact = {"first_name": "Marie", "email": "marie@example.com"}
        updates, changes = _plan_enrichment(contact, _fields(first_name=None), "overwrite", FIELD_DEFS)
        self.assertEqual(updates, {})
        self.assertEqual(changes, [])

    def test_colonne_vide_nefface_pas_un_champ_jsonb(self):
        contact = {"custom_fields": {"city": "Rennes"}}
        updates, _ = _plan_enrichment(contact, _fields(custom_fields={"city": ""}), "overwrite", FIELD_DEFS)
        self.assertEqual(updates, {})

    def test_custom_fields_absent_du_fichier(self):
        contact = {"custom_fields": {"city": "Rennes", "gender": "Femme"}}
        updates, _ = _plan_enrichment(contact, _fields(), "overwrite", FIELD_DEFS)
        self.assertEqual(updates, {})


class TestModeComplete(unittest.TestCase):
    """complete : ne remplit que le vide, ne remplace jamais."""

    def test_remplit_un_champ_vide(self):
        contact = {"first_name": "Marie", "phone": None}
        updates, changes = _plan_enrichment(contact, _fields(phone="0612345678"), "complete", FIELD_DEFS)
        self.assertEqual(updates["phone"], "0612345678")
        self.assertEqual(changes[0]["field"], "phone")
        self.assertIsNone(changes[0]["from"])

    def test_ne_remplace_pas_une_valeur_existante(self):
        contact = {"phone": "0600000000"}
        updates, changes = _plan_enrichment(contact, _fields(phone="0612345678"), "complete", FIELD_DEFS)
        self.assertEqual(updates, {})
        self.assertEqual(changes, [])

    def test_remplit_un_jsonb_vide_en_preservant_les_autres(self):
        contact = {"custom_fields": {"gender": "Femme"}}
        updates, _ = _plan_enrichment(
            contact, _fields(custom_fields={"city": "Rennes"}), "complete", FIELD_DEFS)
        self.assertEqual(updates["custom_fields"], {"gender": "Femme", "city": "Rennes"})

    def test_aucune_modification_ne_produit_aucun_update(self):
        contact = {"first_name": "Marie", "custom_fields": {"city": "Rennes"}}
        updates, changes = _plan_enrichment(
            contact, _fields(first_name="Marie", custom_fields={"city": "Rennes"}), "complete", FIELD_DEFS)
        self.assertEqual(updates, {})
        self.assertEqual(changes, [])


class TestModeOverwrite(unittest.TestCase):
    """overwrite : le fichier fait foi sur les valeurs renseignées."""

    def test_remplace_une_colonne(self):
        contact = {"phone": "0600000000"}
        updates, changes = _plan_enrichment(contact, _fields(phone="0612345678"), "overwrite", FIELD_DEFS)
        self.assertEqual(updates["phone"], "0612345678")
        self.assertEqual(changes[0]["from"], "0600000000")
        self.assertEqual(changes[0]["to"], "0612345678")

    def test_remplace_un_jsonb(self):
        contact = {"custom_fields": {"city": "Rennes"}}
        updates, _ = _plan_enrichment(
            contact, _fields(custom_fields={"city": "Brest"}), "overwrite", FIELD_DEFS)
        self.assertEqual(updates["custom_fields"]["city"], "Brest")

    def test_valeur_identique_nest_pas_un_changement(self):
        contact = {"phone": "0612345678"}
        updates, changes = _plan_enrichment(contact, _fields(phone="0612345678"), "overwrite", FIELD_DEFS)
        self.assertEqual(updates, {})
        self.assertEqual(changes, [])

    def test_le_contact_dorigine_nest_pas_mute(self):
        """_plan_enrichment ne doit pas modifier le dict passé en argument."""
        contact = {"custom_fields": {"city": "Rennes"}}
        _plan_enrichment(contact, _fields(custom_fields={"city": "Brest"}), "overwrite", FIELD_DEFS)
        self.assertEqual(contact["custom_fields"]["city"], "Rennes")


class TestRapprochement(unittest.TestCase):
    """Email d'abord, téléphone à défaut. Plusieurs candidats = ambiguïté."""

    def setUp(self):
        self.c1 = {"id": "1", "email": "marie@example.com", "phone": "0612345678"}
        self.c2 = {"id": "2", "email": "paul@example.com", "phone": "0612345678"}
        self.by_email = {"marie@example.com": [self.c1], "paul@example.com": [self.c2]}
        self.by_phone = {"0612345678": [self.c1, self.c2]}

    def test_rapprochement_par_email(self):
        found = _match_existing(_fields(email="marie@example.com"), self.by_email, self.by_phone)
        self.assertEqual([c["id"] for c in found], ["1"])

    def test_email_prioritaire_sur_telephone_ambigu(self):
        """L'email identifie sans ambiguïté, même si le téléphone est partagé."""
        found = _match_existing(
            _fields(email="paul@example.com", phone="0612345678"), self.by_email, self.by_phone)
        self.assertEqual([c["id"] for c in found], ["2"])

    def test_email_inconnu_ne_retombe_pas_sur_le_telephone(self):
        """
        Règle de sûreté : un email inconnu désigne une nouvelle personne, même si
        son téléphone est déjà connu. Deux membres d'un même foyer partageant un
        numéro, avec des emails distincts, doivent rester deux contacts.
        """
        found = _match_existing(
            _fields(email="nouvelle@example.com", phone="0612345678"), self.by_email, self.by_phone)
        self.assertEqual(found, [])

    def test_repli_sur_le_telephone(self):
        found = _match_existing(_fields(phone="0612345678"), self.by_email, self.by_phone)
        self.assertEqual(len(found), 2)  # ambigu : l'appelant doit signaler la ligne

    def test_aucune_correspondance(self):
        self.assertEqual(
            _match_existing(_fields(email="inconnu@example.com"), self.by_email, self.by_phone), [])

    def test_ligne_sans_identifiant(self):
        self.assertEqual(_match_existing(_fields(), self.by_email, self.by_phone), [])

    def test_telephone_formate_differemment(self):
        """Le rapprochement passe par clean_phone : les séparateurs ne doivent pas gêner."""
        found = _match_existing(_fields(phone="06 12 34 56 78"), self.by_email, self.by_phone)
        self.assertEqual(len(found), 2)


if __name__ == "__main__":
    unittest.main()
