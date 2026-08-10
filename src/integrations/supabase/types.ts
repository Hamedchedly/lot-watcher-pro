export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      adresses_geo: {
        Row: {
          adresse: string
          cle: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          statut: string
          updated_at: string
          ville: string
        }
        Insert: {
          adresse: string
          cle: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          statut?: string
          updated_at?: string
          ville: string
        }
        Update: {
          adresse?: string
          cle?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          statut?: string
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      import_travaux: {
        Row: {
          annee_exercice: number | null
          archivees: number
          creees: number
          demarre_at: string
          doublons: number
          erreurs: number
          fichier: string
          id: string
          ignorees: number
          inchangees: number
          lignes: number
          modifiees: number
          statut: string
          termine_at: string | null
        }
        Insert: {
          annee_exercice?: number | null
          archivees?: number
          creees?: number
          demarre_at?: string
          doublons?: number
          erreurs?: number
          fichier: string
          id?: string
          ignorees?: number
          inchangees?: number
          lignes?: number
          modifiees?: number
          statut?: string
          termine_at?: string | null
        }
        Update: {
          annee_exercice?: number | null
          archivees?: number
          creees?: number
          demarre_at?: string
          doublons?: number
          erreurs?: number
          fichier?: string
          id?: string
          ignorees?: number
          inchangees?: number
          lignes?: number
          modifiees?: number
          statut?: string
          termine_at?: string | null
        }
        Relationships: []
      }
      imports: {
        Row: {
          created_at: string
          fichier: string | null
          id: string
          lignes: number
          lots_crees: number
          lots_disparus: number
          lots_maj: number
          tranches_creees: number
        }
        Insert: {
          created_at?: string
          fichier?: string | null
          id?: string
          lignes?: number
          lots_crees?: number
          lots_disparus?: number
          lots_maj?: number
          tranches_creees?: number
        }
        Update: {
          created_at?: string
          fichier?: string | null
          id?: string
          lignes?: number
          lots_crees?: number
          lots_disparus?: number
          lots_maj?: number
          tranches_creees?: number
        }
        Relationships: []
      }
      lots: {
        Row: {
          actif: boolean
          adresse: string | null
          batiment: string | null
          code_patrimoine: string
          code_postal: string | null
          created_at: string
          date_achevement_travaux: string | null
          date_dpe: string | null
          date_entree: string | null
          dpe: string | null
          etage: string | null
          id: string
          identifiant_insee: string | null
          individuel_collectif: string | null
          locataire_email: string | null
          locataire_nom: string | null
          locataire_telephone: string | null
          porte: string | null
          surface_utile: number | null
          tranche_code: string
          type_lot: string | null
          updated_at: string
          ville: string | null
          vu_le: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          batiment?: string | null
          code_patrimoine: string
          code_postal?: string | null
          created_at?: string
          date_achevement_travaux?: string | null
          date_dpe?: string | null
          date_entree?: string | null
          dpe?: string | null
          etage?: string | null
          id?: string
          identifiant_insee?: string | null
          individuel_collectif?: string | null
          locataire_email?: string | null
          locataire_nom?: string | null
          locataire_telephone?: string | null
          porte?: string | null
          surface_utile?: number | null
          tranche_code: string
          type_lot?: string | null
          updated_at?: string
          ville?: string | null
          vu_le?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          batiment?: string | null
          code_patrimoine?: string
          code_postal?: string | null
          created_at?: string
          date_achevement_travaux?: string | null
          date_dpe?: string | null
          date_entree?: string | null
          dpe?: string | null
          etage?: string | null
          id?: string
          identifiant_insee?: string | null
          individuel_collectif?: string | null
          locataire_email?: string | null
          locataire_nom?: string | null
          locataire_telephone?: string | null
          porte?: string | null
          surface_utile?: number | null
          tranche_code?: string
          type_lot?: string | null
          updated_at?: string
          ville?: string | null
          vu_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lots_tranche_code_fkey"
            columns: ["tranche_code"]
            isOneToOne: false
            referencedRelation: "tranches"
            referencedColumns: ["code"]
          },
        ]
      }
      occupants: {
        Row: {
          created_at: string
          date_entree: string | null
          date_naissance: string | null
          id: string
          lot_code: string
          nom: string | null
          prenom: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_entree?: string | null
          date_naissance?: string | null
          id?: string
          lot_code: string
          nom?: string | null
          prenom?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_entree?: string | null
          date_naissance?: string | null
          id?: string
          lot_code?: string
          nom?: string | null
          prenom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occupants_lot_code_fkey"
            columns: ["lot_code"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["code_patrimoine"]
          },
        ]
      }
      tranches: {
        Row: {
          actif: boolean
          code: string
          copro_numero: string | null
          created_at: string
          id: string
          libelle: string | null
          localite: string | null
          nb_logements: number
          quartier: string | null
          secteur: string | null
          sous_secteur: string | null
          updated_at: string
          vu_le: string | null
          zone_apl: string | null
          zone_edf: string | null
        }
        Insert: {
          actif?: boolean
          code: string
          copro_numero?: string | null
          created_at?: string
          id?: string
          libelle?: string | null
          localite?: string | null
          nb_logements?: number
          quartier?: string | null
          secteur?: string | null
          sous_secteur?: string | null
          updated_at?: string
          vu_le?: string | null
          zone_apl?: string | null
          zone_edf?: string | null
        }
        Update: {
          actif?: boolean
          code?: string
          copro_numero?: string | null
          created_at?: string
          id?: string
          libelle?: string | null
          localite?: string | null
          nb_logements?: number
          quartier?: string | null
          secteur?: string | null
          sous_secteur?: string | null
          updated_at?: string
          vu_le?: string | null
          zone_apl?: string | null
          zone_edf?: string | null
        }
        Relationships: []
      }
      travaux: {
        Row: {
          batiment: string | null
          cout: number
          created_at: string
          date_travaux: string | null
          id: string
          libelle: string
          lot_code: string | null
          niveau: string
          note: string | null
          statut: string
          tranche_code: string | null
          updated_at: string
        }
        Insert: {
          batiment?: string | null
          cout?: number
          created_at?: string
          date_travaux?: string | null
          id?: string
          libelle: string
          lot_code?: string | null
          niveau?: string
          note?: string | null
          statut?: string
          tranche_code?: string | null
          updated_at?: string
        }
        Update: {
          batiment?: string | null
          cout?: number
          created_at?: string
          date_travaux?: string | null
          id?: string
          libelle?: string
          lot_code?: string | null
          niveau?: string
          note?: string | null
          statut?: string
          tranche_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      travaux_commandes: {
        Row: {
          actif: boolean
          adresse: string | null
          annee_exercice: number | null
          batiment: string | null
          budget: number | null
          charge_clientele: string | null
          charge_operation: string | null
          classification_programmation: string | null
          classification_secteur: string | null
          corps_etat: string | null
          created_at: string
          date_communication: string | null
          date_demarrage: string | null
          date_fin_travaux: string | null
          descriptif: string | null
          ecart: number | null
          engage: number | null
          etat_commande: string | null
          etat_travaux: string | null
          fournisseur: string | null
          id: string
          ligne_budget: string | null
          lot_code: string | null
          nature_analytique: string | null
          numero_commande: string
          numero_fournisseur: string | null
          observations: string | null
          paye: number | null
          secteur: string | null
          solde: number | null
          support_communication: string | null
          tranche_code: string | null
          updated_at: string
          vu_dans_import_id: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          annee_exercice?: number | null
          batiment?: string | null
          budget?: number | null
          charge_clientele?: string | null
          charge_operation?: string | null
          classification_programmation?: string | null
          classification_secteur?: string | null
          corps_etat?: string | null
          created_at?: string
          date_communication?: string | null
          date_demarrage?: string | null
          date_fin_travaux?: string | null
          descriptif?: string | null
          ecart?: number | null
          engage?: number | null
          etat_commande?: string | null
          etat_travaux?: string | null
          fournisseur?: string | null
          id?: string
          ligne_budget?: string | null
          lot_code?: string | null
          nature_analytique?: string | null
          numero_commande: string
          numero_fournisseur?: string | null
          observations?: string | null
          paye?: number | null
          secteur?: string | null
          solde?: number | null
          support_communication?: string | null
          tranche_code?: string | null
          updated_at?: string
          vu_dans_import_id?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          annee_exercice?: number | null
          batiment?: string | null
          budget?: number | null
          charge_clientele?: string | null
          charge_operation?: string | null
          classification_programmation?: string | null
          classification_secteur?: string | null
          corps_etat?: string | null
          created_at?: string
          date_communication?: string | null
          date_demarrage?: string | null
          date_fin_travaux?: string | null
          descriptif?: string | null
          ecart?: number | null
          engage?: number | null
          etat_commande?: string | null
          etat_travaux?: string | null
          fournisseur?: string | null
          id?: string
          ligne_budget?: string | null
          lot_code?: string | null
          nature_analytique?: string | null
          numero_commande?: string
          numero_fournisseur?: string | null
          observations?: string | null
          paye?: number | null
          secteur?: string | null
          solde?: number | null
          support_communication?: string | null
          tranche_code?: string | null
          updated_at?: string
          vu_dans_import_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travaux_commandes_lot_code_fkey"
            columns: ["lot_code"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["code_patrimoine"]
          },
          {
            foreignKeyName: "travaux_commandes_tranche_code_fkey"
            columns: ["tranche_code"]
            isOneToOne: false
            referencedRelation: "tranches"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "travaux_commandes_vu_dans_import_id_fkey"
            columns: ["vu_dans_import_id"]
            isOneToOne: false
            referencedRelation: "import_travaux"
            referencedColumns: ["id"]
          },
        ]
      }
      travaux_commandes_historique: {
        Row: {
          apres: Json | null
          avant: Json | null
          commande_id: string
          created_at: string
          id: string
          import_id: string
          operation: string
        }
        Insert: {
          apres?: Json | null
          avant?: Json | null
          commande_id: string
          created_at?: string
          id?: string
          import_id: string
          operation: string
        }
        Update: {
          apres?: Json | null
          avant?: Json | null
          commande_id?: string
          created_at?: string
          id?: string
          import_id?: string
          operation?: string
        }
        Relationships: [
          {
            foreignKeyName: "travaux_commandes_historique_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "travaux_commandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travaux_commandes_historique_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_travaux"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
