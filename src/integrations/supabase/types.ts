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
