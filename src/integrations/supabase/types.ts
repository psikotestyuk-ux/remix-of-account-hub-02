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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_credentials: {
        Row: {
          cookies: string | null
          created_at: string
          credentials_encrypted: string | null
          email: string | null
          grade_id: string | null
          id: string
          is_sold: boolean
          notes: string | null
          password: string | null
          product_id: string
          recovery_email: string | null
          sold_to_order: string | null
          twofa_secret: string | null
          updated_at: string
        }
        Insert: {
          cookies?: string | null
          created_at?: string
          credentials_encrypted?: string | null
          email?: string | null
          grade_id?: string | null
          id?: string
          is_sold?: boolean
          notes?: string | null
          password?: string | null
          product_id: string
          recovery_email?: string | null
          sold_to_order?: string | null
          twofa_secret?: string | null
          updated_at?: string
        }
        Update: {
          cookies?: string | null
          created_at?: string
          credentials_encrypted?: string | null
          email?: string | null
          grade_id?: string | null
          id?: string
          is_sold?: boolean
          notes?: string | null
          password?: string | null
          product_id?: string
          recovery_email?: string | null
          sold_to_order?: string | null
          twofa_secret?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_credentials_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "account_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_credentials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_credentials_sold_to_order_fkey"
            columns: ["sold_to_order"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      account_grades: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          grade: string
          id: string
          is_active: boolean
          product_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          description?: string | null
          grade: string
          id?: string
          is_active?: boolean
          product_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          grade?: string
          id?: string
          is_active?: boolean
          product_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_grades_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      category_settings: {
        Row: {
          display_order: number | null
          emoji: string
          is_active: boolean | null
          label: string
          logo_url: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          display_order?: number | null
          emoji?: string
          is_active?: boolean | null
          label: string
          logo_url?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          display_order?: number | null
          emoji?: string
          is_active?: boolean | null
          label?: string
          logo_url?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          discount_amount: number
          grade_id: string | null
          id: string
          notes: string | null
          order_number: string
          order_status: Database["public"]["Enums"]["order_status"]
          package_id: string | null
          payment_method: string | null
          payment_proof_uploaded_at: string | null
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string
          promo_code: string | null
          quantity: number
          total_price: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          discount_amount?: number
          grade_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          order_status?: Database["public"]["Enums"]["order_status"]
          package_id?: string | null
          payment_method?: string | null
          payment_proof_uploaded_at?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id: string
          promo_code?: string | null
          quantity?: number
          total_price: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          discount_amount?: number
          grade_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          order_status?: Database["public"]["Enums"]["order_status"]
          package_id?: string | null
          payment_method?: string | null
          payment_proof_uploaded_at?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id?: string
          promo_code?: string | null
          quantity?: number
          total_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "account_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "account_grades"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          features: Json | null
          id: string
          image_url: string | null
          name: string
          price: number
          rating: number
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          rating?: number
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          rating?: number
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_banners: {
        Row: {
          created_at: string
          display_order: number
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          placement: Database["public"]["Enums"]["banner_placement"]
          product_id: string | null
          starts_at: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          placement: Database["public"]["Enums"]["banner_placement"]
          product_id?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          placement?: Database["public"]["Enums"]["banner_placement"]
          product_id?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promos: {
        Row: {
          banner_url: string | null
          code: string
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_purchase: number
          starts_at: string | null
          title: string
          updated_at: string
          used_count: number
        }
        Insert: {
          banner_url?: string | null
          code: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase?: number
          starts_at?: string | null
          title: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          banner_url?: string | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          external_ref: string | null
          id: string
          notes: string | null
          order_id: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["wallet_tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          external_ref?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          type: Database["public"]["Enums"]["wallet_tx_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          external_ref?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_fulfill_order: {
        Args: { _credential_ids?: string[]; _notes?: string; _order_id: string }
        Returns: {
          assigned_count: number
          message: string
          needed: number
          success: boolean
          total_assigned: number
        }[]
      }
      admin_fulfill_order_internal: {
        Args: { _credential_ids?: string[]; _notes?: string; _order_id: string }
        Returns: {
          assigned_count: number
          message: string
          needed: number
          success: boolean
          total_assigned: number
        }[]
      }
      generate_short_order_code: { Args: never; Returns: string }
      get_order_by_number: {
        Args: { _order_number: string }
        Returns: {
          admin_notes: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          grade_id: string
          id: string
          order_number: string
          order_status: Database["public"]["Enums"]["order_status"]
          package_id: string
          payment_proof_url: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string
          quantity: number
          total_price: number
        }[]
      }
      get_order_by_number_internal: {
        Args: { _order_number: string }
        Returns: {
          admin_notes: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          grade_id: string
          id: string
          order_number: string
          order_status: Database["public"]["Enums"]["order_status"]
          package_id: string
          payment_proof_url: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string
          quantity: number
          total_price: number
        }[]
      }
      get_order_product_info: {
        Args: { _order_number: string }
        Returns: {
          grade_label: string
          package_name: string
          package_quantity: number
          product_category: string
          product_id: string
          product_image_url: string
          product_name: string
          product_slug: string
          product_status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_with_wallet: {
        Args: {
          _customer_name?: string
          _customer_phone?: string
          _grade_id?: string
          _package_id?: string
          _product_id: string
          _quantity: number
        }
        Returns: {
          message: string
          new_balance: number
          order_id: string
          order_number: string
          success: boolean
        }[]
      }
      purchase_with_wallet_internal: {
        Args: {
          _customer_name?: string
          _customer_phone?: string
          _grade_id?: string
          _package_id?: string
          _product_id: string
          _quantity: number
        }
        Returns: {
          message: string
          new_balance: number
          order_id: string
          order_number: string
          success: boolean
        }[]
      }
      recompute_product_stock: {
        Args: { _product_id: string }
        Returns: undefined
      }
      topup_wallet: {
        Args: { _amount: number; _notes?: string; _payment_method?: string }
        Returns: {
          message: string
          new_balance: number
          success: boolean
          transaction_id: string
        }[]
      }
      topup_wallet_internal: {
        Args: { _amount: number; _notes?: string; _payment_method?: string }
        Returns: {
          message: string
          new_balance: number
          success: boolean
          transaction_id: string
        }[]
      }
      validate_promo_code: {
        Args: { _code: string; _purchase_amount: number }
        Returns: {
          code: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          message: string
          min_purchase: number
          title: string
          valid: boolean
        }[]
      }
      validate_promo_code_internal: {
        Args: { _code: string; _purchase_amount: number }
        Returns: {
          code: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          message: string
          min_purchase: number
          title: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      banner_placement:
        | "home_hero"
        | "products_top"
        | "product_detail"
        | "cart_checkout"
      discount_type: "percent" | "fixed"
      order_status: "processing" | "completed" | "cancelled"
      payment_status: "pending" | "paid" | "failed" | "expired"
      product_category:
        | "facebook"
        | "instagram"
        | "tiktok"
        | "gaming"
        | "tools"
        | "crypto"
      product_status: "active" | "inactive"
      wallet_tx_status: "pending" | "completed" | "failed" | "cancelled"
      wallet_tx_type: "topup" | "purchase" | "refund" | "adjustment"
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
    Enums: {
      app_role: ["admin", "user"],
      banner_placement: [
        "home_hero",
        "products_top",
        "product_detail",
        "cart_checkout",
      ],
      discount_type: ["percent", "fixed"],
      order_status: ["processing", "completed", "cancelled"],
      payment_status: ["pending", "paid", "failed", "expired"],
      product_category: [
        "facebook",
        "instagram",
        "tiktok",
        "gaming",
        "tools",
        "crypto",
      ],
      product_status: ["active", "inactive"],
      wallet_tx_status: ["pending", "completed", "failed", "cancelled"],
      wallet_tx_type: ["topup", "purchase", "refund", "adjustment"],
    },
  },
} as const
