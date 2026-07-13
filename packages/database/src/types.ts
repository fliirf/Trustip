export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["admin_action_type"]
          admin_user_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          note: string | null
          order_id: string | null
          payout_request_id: string | null
          refund_request_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["admin_action_type"]
          admin_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          order_id?: string | null
          payout_request_id?: string | null
          refund_request_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["admin_action_type"]
          admin_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          order_id?: string | null
          payout_request_id?: string | null
          refund_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: Database["public"]["Enums"]["actor_type"]
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_role?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_role?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      binance_topup_sessions: {
        Row: {
          amount_usdc: number | null
          buyer_user_id: string | null
          created_at: string
          guide_status: Database["public"]["Enums"]["binance_guide_status"]
          id: string
          order_id: string | null
          wallet_address_to_receive: string | null
        }
        Insert: {
          amount_usdc?: number | null
          buyer_user_id?: string | null
          created_at?: string
          guide_status?: Database["public"]["Enums"]["binance_guide_status"]
          id?: string
          order_id?: string | null
          wallet_address_to_receive?: string | null
        }
        Update: {
          amount_usdc?: number | null
          buyer_user_id?: string | null
          created_at?: string
          guide_status?: Database["public"]["Enums"]["binance_guide_status"]
          id?: string
          order_id?: string | null
          wallet_address_to_receive?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "binance_topup_sessions_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binance_topup_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      blockchain_transactions: {
        Row: {
          amount: number | null
          asset_code: string | null
          confirmed_at: string | null
          created_at: string
          destination_account: string | null
          escrow_id: string | null
          id: string
          ledger: number | null
          network: Database["public"]["Enums"]["network"]
          order_id: string | null
          payment_id: string | null
          raw_response: Json | null
          source_account: string | null
          status: Database["public"]["Enums"]["blockchain_tx_status"]
          tx_hash: string
          tx_type: Database["public"]["Enums"]["blockchain_tx_type"]
        }
        Insert: {
          amount?: number | null
          asset_code?: string | null
          confirmed_at?: string | null
          created_at?: string
          destination_account?: string | null
          escrow_id?: string | null
          id?: string
          ledger?: number | null
          network: Database["public"]["Enums"]["network"]
          order_id?: string | null
          payment_id?: string | null
          raw_response?: Json | null
          source_account?: string | null
          status?: Database["public"]["Enums"]["blockchain_tx_status"]
          tx_hash: string
          tx_type: Database["public"]["Enums"]["blockchain_tx_type"]
        }
        Update: {
          amount?: number | null
          asset_code?: string | null
          confirmed_at?: string | null
          created_at?: string
          destination_account?: string | null
          escrow_id?: string | null
          id?: string
          ledger?: number | null
          network?: Database["public"]["Enums"]["network"]
          order_id?: string | null
          payment_id?: string | null
          raw_response?: Json | null
          source_account?: string | null
          status?: Database["public"]["Enums"]["blockchain_tx_status"]
          tx_hash?: string
          tx_type?: Database["public"]["Enums"]["blockchain_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "blockchain_transactions_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blockchain_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blockchain_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_links: {
        Row: {
          created_at: string
          currency_display: string | null
          description: string | null
          expires_at: string | null
          id: string
          price_idr_reference: number | null
          price_usdc: number
          requires_shipping: boolean
          seller_profile_id: string
          slug: string
          status: Database["public"]["Enums"]["checkout_link_status"]
          title: string
        }
        Insert: {
          created_at?: string
          currency_display?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          price_idr_reference?: number | null
          price_usdc: number
          requires_shipping?: boolean
          seller_profile_id: string
          slug: string
          status?: Database["public"]["Enums"]["checkout_link_status"]
          title: string
        }
        Update: {
          created_at?: string
          currency_display?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          price_idr_reference?: number | null
          price_usdc?: number
          requires_shipping?: boolean
          seller_profile_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["checkout_link_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_links_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_events: {
        Row: {
          amount_usdc: number | null
          created_at: string
          escrow_id: string
          event_type: Database["public"]["Enums"]["escrow_event_type"]
          from_public_key: string | null
          id: string
          ledger: number | null
          raw_event: Json | null
          to_public_key: string | null
          tx_hash: string | null
        }
        Insert: {
          amount_usdc?: number | null
          created_at?: string
          escrow_id: string
          event_type: Database["public"]["Enums"]["escrow_event_type"]
          from_public_key?: string | null
          id?: string
          ledger?: number | null
          raw_event?: Json | null
          to_public_key?: string | null
          tx_hash?: string | null
        }
        Update: {
          amount_usdc?: number | null
          created_at?: string
          escrow_id?: string
          event_type?: Database["public"]["Enums"]["escrow_event_type"]
          from_public_key?: string | null
          id?: string
          ledger?: number | null
          raw_event?: Json | null
          to_public_key?: string | null
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_events_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrows"
            referencedColumns: ["id"]
          },
        ]
      }
      escrows: {
        Row: {
          amount_usdc: number
          asset_code: string
          buyer_public_key: string | null
          contract_id: string | null
          contract_order_id: string | null
          created_at: string
          funded_at: string | null
          funded_tx_hash: string | null
          id: string
          order_id: string
          refund_tx_hash: string | null
          refunded_at: string | null
          release_destination_type: Database["public"]["Enums"]["release_destination_type"]
          release_tx_hash: string | null
          released_at: string | null
          seller_public_key: string | null
          status: Database["public"]["Enums"]["escrow_status"]
        }
        Insert: {
          amount_usdc: number
          asset_code?: string
          buyer_public_key?: string | null
          contract_id?: string | null
          contract_order_id?: string | null
          created_at?: string
          funded_at?: string | null
          funded_tx_hash?: string | null
          id?: string
          order_id: string
          refund_tx_hash?: string | null
          refunded_at?: string | null
          release_destination_type?: Database["public"]["Enums"]["release_destination_type"]
          release_tx_hash?: string | null
          released_at?: string | null
          seller_public_key?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Update: {
          amount_usdc?: number
          asset_code?: string
          buyer_public_key?: string | null
          contract_id?: string | null
          contract_order_id?: string | null
          created_at?: string
          funded_at?: string | null
          funded_tx_hash?: string | null
          id?: string
          order_id?: string
          refund_tx_hash?: string | null
          refunded_at?: string | null
          release_destination_type?: Database["public"]["Enums"]["release_destination_type"]
          release_tx_hash?: string | null
          released_at?: string | null
          seller_public_key?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "escrows_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      moneygram_payout_details: {
        Row: {
          cashout_currency: string | null
          compliance_status: Database["public"]["Enums"]["moneygram_compliance_status"]
          country: string | null
          created_at: string
          external_status: Database["public"]["Enums"]["moneygram_status"]
          id: string
          integration_level: Database["public"]["Enums"]["moneygram_integration_level"]
          location_hint: string | null
          metadata: Json | null
          moneygram_reference_id: string | null
          payout_request_id: string
          recipient_profile_ref: string | null
          updated_at: string
        }
        Insert: {
          cashout_currency?: string | null
          compliance_status?: Database["public"]["Enums"]["moneygram_compliance_status"]
          country?: string | null
          created_at?: string
          external_status?: Database["public"]["Enums"]["moneygram_status"]
          id?: string
          integration_level?: Database["public"]["Enums"]["moneygram_integration_level"]
          location_hint?: string | null
          metadata?: Json | null
          moneygram_reference_id?: string | null
          payout_request_id: string
          recipient_profile_ref?: string | null
          updated_at?: string
        }
        Update: {
          cashout_currency?: string | null
          compliance_status?: Database["public"]["Enums"]["moneygram_compliance_status"]
          country?: string | null
          created_at?: string
          external_status?: Database["public"]["Enums"]["moneygram_status"]
          id?: string
          integration_level?: Database["public"]["Enums"]["moneygram_integration_level"]
          location_hint?: string | null
          metadata?: Json | null
          moneygram_reference_id?: string | null
          payout_request_id?: string
          recipient_profile_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moneygram_payout_details_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: true
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      indexer_checkpoints: {
        Row: {
          worker: string
          network: Database["public"]["Enums"]["network"]
          last_ledger: number
          cursor: string | null
          updated_at: string
        }
        Insert: {
          worker: string
          network: Database["public"]["Enums"]["network"]
          last_ledger?: number
          cursor?: string | null
          updated_at?: string
        }
        Update: {
          worker?: string
          network?: Database["public"]["Enums"]["network"]
          last_ledger?: number
          cursor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          metadata: Json
          name: string
          order_id: string
          quantity: number
          subtotal_usdc: number
          unit_price_usdc: number
        }
        Insert: {
          id?: string
          metadata?: Json
          name: string
          order_id: string
          quantity: number
          subtotal_usdc: number
          unit_price_usdc: number
        }
        Update: {
          id?: string
          metadata?: Json
          name?: string
          order_id?: string
          quantity?: number
          subtotal_usdc?: number
          unit_price_usdc?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          actor_type: Database["public"]["Enums"]["actor_type"]
          actor_user_id: string | null
          created_at: string
          id: string
          label_public: string | null
          metadata: Json | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_type?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          label_public?: string | null
          metadata?: Json | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_type?: Database["public"]["Enums"]["actor_type"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          label_public?: string | null
          metadata?: Json | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_user_id: string | null
          buyer_wallet_id: string | null
          cancelled_at: string | null
          checkout_link_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          order_no: string
          paid_at: string | null
          requires_shipping: boolean
          selected_payout_method_id: string | null
          seller_profile_id: string
          seller_wallet_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_idr_reference: number | null
          total_usdc: number
        }
        Insert: {
          buyer_user_id?: string | null
          buyer_wallet_id?: string | null
          cancelled_at?: string | null
          checkout_link_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          order_no: string
          paid_at?: string | null
          requires_shipping?: boolean
          selected_payout_method_id?: string | null
          seller_profile_id: string
          seller_wallet_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_idr_reference?: number | null
          total_usdc: number
        }
        Update: {
          buyer_user_id?: string | null
          buyer_wallet_id?: string | null
          cancelled_at?: string | null
          checkout_link_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          order_no?: string
          paid_at?: string | null
          requires_shipping?: boolean
          selected_payout_method_id?: string | null
          seller_profile_id?: string
          seller_wallet_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_idr_reference?: number | null
          total_usdc?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_selected_payout_method"
            columns: ["selected_payout_method_id"]
            isOneToOne: false
            referencedRelation: "seller_payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_wallet_id_fkey"
            columns: ["buyer_wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_checkout_link_id_fkey"
            columns: ["checkout_link_id"]
            isOneToOne: false
            referencedRelation: "checkout_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_wallet_id_fkey"
            columns: ["seller_wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_usdc: number
          asset_code: string
          asset_issuer: string | null
          confirmed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          ledger: number | null
          method: Database["public"]["Enums"]["payment_method"]
          network: Database["public"]["Enums"]["network"]
          order_id: string
          payer_public_key: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tx_hash: string | null
        }
        Insert: {
          amount_usdc: number
          asset_code?: string
          asset_issuer?: string | null
          confirmed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          ledger?: number | null
          method?: Database["public"]["Enums"]["payment_method"]
          network: Database["public"]["Enums"]["network"]
          order_id: string
          payer_public_key?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tx_hash?: string | null
        }
        Update: {
          amount_usdc?: number
          asset_code?: string
          asset_issuer?: string | null
          confirmed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          ledger?: number | null
          method?: Database["public"]["Enums"]["payment_method"]
          network?: Database["public"]["Enums"]["network"]
          order_id?: string
          payer_public_key?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount_usdc: number | null
          completed_at: string | null
          escrow_id: string | null
          failure_reason: string | null
          fee_estimate_usdc: number | null
          id: string
          idempotency_key: string | null
          order_id: string
          payout_method_id: string | null
          processed_at: string | null
          provider_reference_id: string | null
          rate_snapshot: Json | null
          release_mode: Database["public"]["Enums"]["payout_release_mode"]
          requested_at: string | null
          route_type: Database["public"]["Enums"]["payout_method_type"]
          seller_profile_id: string
          status: Database["public"]["Enums"]["payout_status"]
          target_amount_estimate: number | null
          target_asset_code: string | null
        }
        Insert: {
          amount_usdc?: number | null
          completed_at?: string | null
          escrow_id?: string | null
          failure_reason?: string | null
          fee_estimate_usdc?: number | null
          id?: string
          idempotency_key?: string | null
          order_id: string
          payout_method_id?: string | null
          processed_at?: string | null
          provider_reference_id?: string | null
          rate_snapshot?: Json | null
          release_mode?: Database["public"]["Enums"]["payout_release_mode"]
          requested_at?: string | null
          route_type: Database["public"]["Enums"]["payout_method_type"]
          seller_profile_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          target_amount_estimate?: number | null
          target_asset_code?: string | null
        }
        Update: {
          amount_usdc?: number | null
          completed_at?: string | null
          escrow_id?: string | null
          failure_reason?: string | null
          fee_estimate_usdc?: number | null
          id?: string
          idempotency_key?: string | null
          order_id?: string
          payout_method_id?: string | null
          processed_at?: string | null
          provider_reference_id?: string | null
          rate_snapshot?: Json | null
          release_mode?: Database["public"]["Enums"]["payout_release_mode"]
          requested_at?: string | null
          route_type?: Database["public"]["Enums"]["payout_method_type"]
          seller_profile_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          target_amount_estimate?: number | null
          target_asset_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_escrow_id_fkey"
            columns: ["escrow_id"]
            isOneToOne: false
            referencedRelation: "escrows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_payout_method_id_fkey"
            columns: ["payout_method_id"]
            isOneToOne: false
            referencedRelation: "seller_payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_transactions: {
        Row: {
          amount: number | null
          asset_code: string | null
          created_at: string
          external_reference_id: string | null
          id: string
          network: Database["public"]["Enums"]["payout_transaction_network"]
          payout_request_id: string
          raw_payload: Json | null
          status: Database["public"]["Enums"]["payout_transaction_status"]
          transaction_type: Database["public"]["Enums"]["payout_transaction_type"]
          tx_hash: string | null
        }
        Insert: {
          amount?: number | null
          asset_code?: string | null
          created_at?: string
          external_reference_id?: string | null
          id?: string
          network: Database["public"]["Enums"]["payout_transaction_network"]
          payout_request_id: string
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["payout_transaction_status"]
          transaction_type: Database["public"]["Enums"]["payout_transaction_type"]
          tx_hash?: string | null
        }
        Update: {
          amount?: number | null
          asset_code?: string | null
          created_at?: string
          external_reference_id?: string | null
          id?: string
          network?: Database["public"]["Enums"]["payout_transaction_network"]
          payout_request_id?: string
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["payout_transaction_status"]
          transaction_type?: Database["public"]["Enums"]["payout_transaction_type"]
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_transactions_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_evidence: {
        Row: {
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          file_type: Database["public"]["Enums"]["file_type"]
          file_url: string
          id: string
          note: string | null
          refund_request_id: string
          uploaded_by: string | null
        }
        Insert: {
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          file_type: Database["public"]["Enums"]["file_type"]
          file_url: string
          id?: string
          note?: string | null
          refund_request_id: string
          uploaded_by?: string | null
        }
        Update: {
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          file_type?: Database["public"]["Enums"]["file_type"]
          file_url?: string
          id?: string
          note?: string | null
          refund_request_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refund_evidence_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          buyer_user_id: string | null
          created_at: string
          decision: Database["public"]["Enums"]["refund_decision"]
          decision_note: string | null
          description: string | null
          id: string
          order_id: string
          reason_code: Database["public"]["Enums"]["refund_reason_code"]
          requested_amount_usdc: number | null
          resolved_at: string | null
          seller_profile_id: string
          status: Database["public"]["Enums"]["refund_status"]
        }
        Insert: {
          buyer_user_id?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["refund_decision"]
          decision_note?: string | null
          description?: string | null
          id?: string
          order_id: string
          reason_code: Database["public"]["Enums"]["refund_reason_code"]
          requested_amount_usdc?: number | null
          resolved_at?: string | null
          seller_profile_id: string
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Update: {
          buyer_user_id?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["refund_decision"]
          decision_note?: string | null
          description?: string | null
          id?: string
          order_id?: string
          reason_code?: Database["public"]["Enums"]["refund_reason_code"]
          requested_amount_usdc?: number | null
          resolved_at?: string | null
          seller_profile_id?: string
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          buyer_user_id: string | null
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          seller_profile_id: string
        }
        Insert: {
          buyer_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          seller_profile_id: string
        }
        Update: {
          buyer_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          seller_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payout_methods: {
        Row: {
          asset_code: string | null
          cashout_country: string | null
          cashout_currency: string | null
          created_at: string
          display_name: string
          external_provider: string | null
          id: string
          is_default: boolean
          method_type: Database["public"]["Enums"]["payout_method_type"]
          provider_payload: Json | null
          seller_profile_id: string
          status: Database["public"]["Enums"]["payout_method_status"]
          stellar_address: string | null
          updated_at: string
          wallet_id: string | null
        }
        Insert: {
          asset_code?: string | null
          cashout_country?: string | null
          cashout_currency?: string | null
          created_at?: string
          display_name: string
          external_provider?: string | null
          id?: string
          is_default?: boolean
          method_type: Database["public"]["Enums"]["payout_method_type"]
          provider_payload?: Json | null
          seller_profile_id: string
          status?: Database["public"]["Enums"]["payout_method_status"]
          stellar_address?: string | null
          updated_at?: string
          wallet_id?: string | null
        }
        Update: {
          asset_code?: string | null
          cashout_country?: string | null
          cashout_currency?: string | null
          created_at?: string
          display_name?: string
          external_provider?: string | null
          id?: string
          is_default?: boolean
          method_type?: Database["public"]["Enums"]["payout_method_type"]
          provider_payload?: Json | null
          seller_profile_id?: string
          status?: Database["public"]["Enums"]["payout_method_status"]
          stellar_address?: string | null
          updated_at?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_methods_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_payout_methods_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          activation_status: Database["public"]["Enums"]["seller_activation_status"]
          category: string | null
          created_at: string
          default_payout_method_id: string | null
          email_verified: boolean
          id: string
          identity_status: Database["public"]["Enums"]["identity_status"]
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone_verified: boolean
          product_type: string | null
          social_url: string | null
          store_name: string
          user_id: string
        }
        Insert: {
          activation_status?: Database["public"]["Enums"]["seller_activation_status"]
          category?: string | null
          created_at?: string
          default_payout_method_id?: string | null
          email_verified?: boolean
          id?: string
          identity_status?: Database["public"]["Enums"]["identity_status"]
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone_verified?: boolean
          product_type?: string | null
          social_url?: string | null
          store_name: string
          user_id: string
        }
        Update: {
          activation_status?: Database["public"]["Enums"]["seller_activation_status"]
          category?: string | null
          created_at?: string
          default_payout_method_id?: string | null
          email_verified?: boolean
          id?: string
          identity_status?: Database["public"]["Enums"]["identity_status"]
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone_verified?: boolean
          product_type?: string | null
          social_url?: string | null
          store_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_seller_profiles_default_payout_method"
            columns: ["default_payout_method_id"]
            isOneToOne: false
            referencedRelation: "seller_payout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_proofs: {
        Row: {
          created_at: string
          file_type: Database["public"]["Enums"]["file_type"]
          file_url: string
          id: string
          proof_type: Database["public"]["Enums"]["shipment_proof_type"]
          shipment_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_type: Database["public"]["Enums"]["file_type"]
          file_url: string
          id?: string
          proof_type: Database["public"]["Enums"]["shipment_proof_type"]
          shipment_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_type?: Database["public"]["Enums"]["file_type"]
          file_url?: string
          id?: string
          proof_type?: Database["public"]["Enums"]["shipment_proof_type"]
          shipment_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_proofs_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_proofs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          courier_name: string | null
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string
          seller_note: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
        }
        Insert: {
          courier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id: string
          seller_note?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
        }
        Update: {
          courier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string
          seller_note?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["trust_event_type"]
          id: string
          metadata: Json | null
          order_id: string | null
          score_delta: number
          trust_profile_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["trust_event_type"]
          id?: string
          metadata?: Json | null
          order_id?: string | null
          score_delta?: number
          trust_profile_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["trust_event_type"]
          id?: string
          metadata?: Json | null
          order_id?: string | null
          score_delta?: number
          trust_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_events_trust_profile_id_fkey"
            columns: ["trust_profile_id"]
            isOneToOne: false
            referencedRelation: "trust_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_profiles: {
        Row: {
          average_rating: number
          cancelled_orders: number
          completed_orders: number
          created_at: string
          id: string
          level: Database["public"]["Enums"]["trust_level"]
          refund_rate: number
          refunded_orders: number
          seller_profile_id: string
          total_orders: number
          total_reviews: number
          trust_score: number
          updated_at: string
        }
        Insert: {
          average_rating?: number
          cancelled_orders?: number
          completed_orders?: number
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["trust_level"]
          refund_rate?: number
          refunded_orders?: number
          seller_profile_id: string
          total_orders?: number
          total_reviews?: number
          trust_score?: number
          updated_at?: string
        }
        Update: {
          average_rating?: number
          cancelled_orders?: number
          completed_orders?: number
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["trust_level"]
          refund_rate?: number
          refunded_orders?: number
          seller_profile_id?: string
          total_orders?: number
          total_reviews?: number
          trust_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_profiles_seller_profile_id_fkey"
            columns: ["seller_profile_id"]
            isOneToOne: true
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          network: Database["public"]["Enums"]["network"]
          public_key: string
          user_id: string
          verified_at: string | null
          wallet_provider: Database["public"]["Enums"]["wallet_provider"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          network: Database["public"]["Enums"]["network"]
          public_key: string
          user_id: string
          verified_at?: string | null
          wallet_provider: Database["public"]["Enums"]["wallet_provider"]
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          network?: Database["public"]["Enums"]["network"]
          public_key?: string
          user_id?: string
          verified_at?: string | null
          wallet_provider?: Database["public"]["Enums"]["wallet_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_funded_payment: {
        Args: {
          p_amount_usdc: number
          p_buyer_public_key: string
          p_escrow_id: string
          p_ledger: number
          p_network: Database["public"]["Enums"]["network"]
          p_order_id: string
          p_payment_id: string
          p_tx_hash: string
        }
        Returns: boolean
      }
      confirm_released_payment: {
        Args: {
          p_amount_usdc: number
          p_escrow_id: string
          p_ledger: number
          p_network: Database["public"]["Enums"]["network"]
          p_order_id: string
          p_to_public_key: string
          p_tx_hash: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_order_buyer: { Args: { p_order: string }; Returns: boolean }
      is_order_party: { Args: { p_order: string }; Returns: boolean }
      is_order_seller: { Args: { p_order: string }; Returns: boolean }
      my_seller_profile_id: { Args: never; Returns: string }
    }
    Enums: {
      actor_type: "buyer" | "seller" | "admin" | "system"
      admin_action_type:
        | "approve_refund"
        | "reject_refund"
        | "force_release"
        | "restrict_seller"
        | "mark_payout_review"
        | "approve_payout_retry"
        | "add_note"
      auth_provider: "email" | "google" | "wallet"
      binance_guide_status:
        | "opened"
        | "copied_address"
        | "completed_self_reported"
        | "abandoned"
      blockchain_tx_status: "submitted" | "pending" | "confirmed" | "failed"
      blockchain_tx_type:
        | "payment"
        | "escrow_create"
        | "escrow_fund"
        | "escrow_release"
        | "escrow_refund"
        | "escrow_cancel"
        | "payout"
        | "other"
      checkout_link_status: "draft" | "active" | "inactive" | "expired"
      escrow_event_type:
        | "create"
        | "fund"
        | "lock"
        | "release"
        | "refund"
        | "cancel"
        | "error"
      escrow_status:
        | "not_created"
        | "created"
        | "funded"
        | "released"
        | "refunded"
        | "cancelled"
        | "paused"
      evidence_type:
        | "unboxing_video"
        | "chat_screenshot"
        | "shipping_receipt"
        | "item_photo"
        | "other"
      file_type: "photo" | "video" | "document"
      identity_status: "not_started" | "pending" | "verified" | "rejected"
      kyc_status: "not_required_mvp" | "pending_future" | "verified_future"
      moneygram_compliance_status:
        | "not_required_mvp"
        | "pending"
        | "approved"
        | "rejected"
      moneygram_integration_level: "guided" | "integrated_future"
      moneygram_status:
        | "not_started"
        | "guide_opened"
        | "initiated"
        | "pending_kyc"
        | "ready_for_pickup"
        | "completed"
        | "failed"
        | "expired"
      network: "testnet" | "mainnet"
      order_status:
        | "awaiting_payment"
        | "payment_submitted"
        | "payment_confirmed"
        | "escrow_locked"
        | "processing"
        | "packed"
        | "shipped"
        | "delivered"
        | "completed"
        | "payout_pending"
        | "payout_completed"
        | "refund_requested"
        | "refund_review"
        | "refunded"
        | "cancelled"
        | "failed"
      payment_method: "stellar_wallet" | "binance_pay_future"
      payment_status:
        | "pending"
        | "awaiting_signature"
        | "submitted"
        | "confirmed"
        | "failed"
        | "expired"
        | "refunded"
      payout_method_status:
        | "active"
        | "disabled"
        | "needs_review"
        | "unsupported_region"
      payout_method_type: "usdc_wallet" | "xlm_wallet" | "moneygram_cashout"
      payout_release_mode:
        | "direct_wallet"
        | "guided_offramp"
        | "treasury_orchestrated_future"
      payout_status:
        | "not_requested"
        | "route_selected"
        | "pending_release"
        | "processing"
        | "completed"
        | "failed"
        | "needs_review"
        | "cancelled"
      payout_transaction_network: "testnet" | "mainnet" | "external"
      payout_transaction_status:
        | "submitted"
        | "confirmed"
        | "failed"
        | "pending_external"
      payout_transaction_type:
        | "escrow_release"
        | "stellar_payment"
        | "path_payment"
        | "moneygram_cashout_created"
        | "moneygram_cashout_completed"
        | "reconciliation"
        | "failed"
      refund_decision:
        | "none"
        | "refund_buyer"
        | "release_seller"
        | "partial_refund_future"
      refund_reason_code:
        | "not_received"
        | "wrong_item"
        | "damaged"
        | "fake"
        | "seller_unresponsive"
        | "other"
      refund_status:
        | "submitted"
        | "under_review"
        | "seller_response_needed"
        | "approved"
        | "rejected"
        | "completed"
      release_destination_type: "seller_wallet" | "payout_treasury_future"
      seller_activation_status: "incomplete" | "ready" | "restricted"
      shipment_proof_type: "packing_photo" | "shipping_receipt" | "item_photo"
      shipment_status: "processing" | "packed" | "shipped" | "delivered"
      trust_event_type:
        | "order_completed"
        | "order_refunded"
        | "order_cancelled"
        | "review_received"
        | "seller_restricted"
        | "manual_adjustment"
      trust_level: "new" | "bronze" | "silver" | "gold" | "restricted"
      user_role: "buyer" | "seller" | "admin"
      user_status: "active" | "suspended" | "pending_review"
      wallet_provider: "freighter" | "xbull" | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      actor_type: ["buyer", "seller", "admin", "system"],
      admin_action_type: [
        "approve_refund",
        "reject_refund",
        "force_release",
        "restrict_seller",
        "mark_payout_review",
        "approve_payout_retry",
        "add_note",
      ],
      auth_provider: ["email", "google", "wallet"],
      binance_guide_status: [
        "opened",
        "copied_address",
        "completed_self_reported",
        "abandoned",
      ],
      blockchain_tx_status: ["submitted", "pending", "confirmed", "failed"],
      blockchain_tx_type: [
        "payment",
        "escrow_create",
        "escrow_fund",
        "escrow_release",
        "escrow_refund",
        "escrow_cancel",
        "payout",
        "other",
      ],
      checkout_link_status: ["draft", "active", "inactive", "expired"],
      escrow_event_type: [
        "create",
        "fund",
        "lock",
        "release",
        "refund",
        "cancel",
        "error",
      ],
      escrow_status: [
        "not_created",
        "created",
        "funded",
        "released",
        "refunded",
        "cancelled",
        "paused",
      ],
      evidence_type: [
        "unboxing_video",
        "chat_screenshot",
        "shipping_receipt",
        "item_photo",
        "other",
      ],
      file_type: ["photo", "video", "document"],
      identity_status: ["not_started", "pending", "verified", "rejected"],
      kyc_status: ["not_required_mvp", "pending_future", "verified_future"],
      moneygram_compliance_status: [
        "not_required_mvp",
        "pending",
        "approved",
        "rejected",
      ],
      moneygram_integration_level: ["guided", "integrated_future"],
      moneygram_status: [
        "not_started",
        "guide_opened",
        "initiated",
        "pending_kyc",
        "ready_for_pickup",
        "completed",
        "failed",
        "expired",
      ],
      network: ["testnet", "mainnet"],
      order_status: [
        "awaiting_payment",
        "payment_submitted",
        "payment_confirmed",
        "escrow_locked",
        "processing",
        "packed",
        "shipped",
        "delivered",
        "completed",
        "payout_pending",
        "payout_completed",
        "refund_requested",
        "refund_review",
        "refunded",
        "cancelled",
        "failed",
      ],
      payment_method: ["stellar_wallet", "binance_pay_future"],
      payment_status: [
        "pending",
        "awaiting_signature",
        "submitted",
        "confirmed",
        "failed",
        "expired",
        "refunded",
      ],
      payout_method_status: [
        "active",
        "disabled",
        "needs_review",
        "unsupported_region",
      ],
      payout_method_type: ["usdc_wallet", "xlm_wallet", "moneygram_cashout"],
      payout_release_mode: [
        "direct_wallet",
        "guided_offramp",
        "treasury_orchestrated_future",
      ],
      payout_status: [
        "not_requested",
        "route_selected",
        "pending_release",
        "processing",
        "completed",
        "failed",
        "needs_review",
        "cancelled",
      ],
      payout_transaction_network: ["testnet", "mainnet", "external"],
      payout_transaction_status: [
        "submitted",
        "confirmed",
        "failed",
        "pending_external",
      ],
      payout_transaction_type: [
        "escrow_release",
        "stellar_payment",
        "path_payment",
        "moneygram_cashout_created",
        "moneygram_cashout_completed",
        "reconciliation",
        "failed",
      ],
      refund_decision: [
        "none",
        "refund_buyer",
        "release_seller",
        "partial_refund_future",
      ],
      refund_reason_code: [
        "not_received",
        "wrong_item",
        "damaged",
        "fake",
        "seller_unresponsive",
        "other",
      ],
      refund_status: [
        "submitted",
        "under_review",
        "seller_response_needed",
        "approved",
        "rejected",
        "completed",
      ],
      release_destination_type: ["seller_wallet", "payout_treasury_future"],
      seller_activation_status: ["incomplete", "ready", "restricted"],
      shipment_proof_type: ["packing_photo", "shipping_receipt", "item_photo"],
      shipment_status: ["processing", "packed", "shipped", "delivered"],
      trust_event_type: [
        "order_completed",
        "order_refunded",
        "order_cancelled",
        "review_received",
        "seller_restricted",
        "manual_adjustment",
      ],
      trust_level: ["new", "bronze", "silver", "gold", "restricted"],
      user_role: ["buyer", "seller", "admin"],
      user_status: ["active", "suspended", "pending_review"],
      wallet_provider: ["freighter", "xbull", "other"],
    },
  },
} as const

