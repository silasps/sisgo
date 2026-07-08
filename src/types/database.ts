export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Rel<FK extends string, Cols extends string[], OneToOne extends boolean, Ref extends string, RefCols extends string[]> = {
  foreignKeyName: FK
  columns: Cols
  isOneToOne: OneToOne
  referencedRelation: Ref
  referencedColumns: RefCols
}

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string; name: string; slug: string; city: string | null; state: string | null
          country: string; phone: string | null; email: string | null; website: string | null
          logo_url: string | null; active: boolean; created_at: string; updated_at: string
          accent_color: string | null
          department_assignments: Record<string, string> | null
          id_card_enabled: boolean
        }
        Insert: { name: string; slug: string; country?: string; city?: string | null; state?: string | null; phone?: string | null; email?: string | null; website?: string | null; logo_url?: string | null; active?: boolean; accent_color?: string | null; department_assignments?: Record<string, string> | null; id_card_enabled?: boolean }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
        Relationships: []
      }
      organization_users: {
        Row: { id: string; user_id: string; organization_id: string | null; role_id: string; active: boolean; created_at: string; updated_at: string }
        Insert: { user_id: string; role_id: string; organization_id?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['organization_users']['Insert']>
        Relationships: [
          Rel<'organization_users_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>,
          Rel<'organization_users_role_id_fkey', ['role_id'], false, 'roles', ['id']>
        ]
      }
      roles: {
        Row: { id: string; name: string; label: string; description: string | null; created_at: string }
        Insert: { name: string; label: string; description?: string | null }
        Update: Partial<Database['public']['Tables']['roles']['Insert']>
        Relationships: []
      }
      people: {
        Row: {
          id: string; organization_id: string; full_name: string; preferred_name: string | null
          birth_date: string | null; gender: 'M' | 'F' | 'outro' | null; nationality: string | null
          civil_status: 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro' | null
          photo_url: string | null; notes: string | null; created_at: string; updated_at: string
        }
        Insert: { organization_id: string; full_name: string; preferred_name?: string | null; birth_date?: string | null; gender?: 'M' | 'F' | 'outro' | null; nationality?: string | null; civil_status?: 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro' | null; photo_url?: string | null; notes?: string | null }
        Update: Partial<Database['public']['Tables']['people']['Insert']>
        Relationships: [Rel<'people_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      person_contacts: {
        Row: { id: string; person_id: string; type: string; value: string; label: string | null; is_primary: boolean; created_at: string }
        Insert: { person_id: string; type: string; value: string; label?: string | null; primary?: boolean }
        Update: Partial<Database['public']['Tables']['person_contacts']['Insert']>
        Relationships: [Rel<'person_contacts_person_id_fkey', ['person_id'], false, 'people', ['id']>]
      }
      person_documents: {
        Row: { id: string; person_id: string; type: string; number: string; issued_by: string | null; issued_at: string | null; expires_at: string | null; created_at: string }
        Insert: { person_id: string; type: string; number: string; issued_by?: string | null; issued_at?: string | null; expires_at?: string | null }
        Update: Partial<Database['public']['Tables']['person_documents']['Insert']>
        Relationships: [Rel<'person_documents_person_id_fkey', ['person_id'], false, 'people', ['id']>]
      }
      person_status_history: {
        Row: { id: string; person_id: string; status: string; started_at: string; ended_at: string | null; notes: string | null; created_by: string | null }
        Insert: { person_id: string; status: string; started_at?: string; ended_at?: string | null; notes?: string | null; created_by?: string | null }
        Update: Partial<Database['public']['Tables']['person_status_history']['Insert']>
        Relationships: [Rel<'person_status_history_person_id_fkey', ['person_id'], false, 'people', ['id']>]
      }
      staff_interest_forms: {
        Row: { id: string; organization_id: string; ministry_id: string | null; person_id: string | null; full_name: string; email: string | null; phone: string | null; phone_country: string | null; language: string | null; message: string | null; status: string; refusal_reason: string | null; reviewed_by: string | null; reviewed_at: string | null; notified_at: string | null; responded_at: string | null; created_at: string; updated_at: string }
        Insert: { organization_id: string; ministry_id?: string | null; person_id?: string | null; full_name: string; email?: string | null; phone?: string | null; phone_country?: string | null; language?: string | null; message?: string | null; status?: string; refusal_reason?: string | null }
        Update: Partial<Database['public']['Tables']['staff_interest_forms']['Insert']>
        Relationships: []
      }
      staff_applications: {
        Row: { id: string; organization_id: string; person_id: string; ministry_id: string | null; interest_form_id: string | null; token: string | null; token_expires_at: string | null; form_data: Json; current_section: number; status: string; applied_at: string; reviewed_at: string | null; reviewed_by: string | null; notes: string | null; leader_accepted_by: string | null; leader_accepted_at: string | null; dh_finalized_by: string | null; dh_finalized_at: string | null; refusal_reason: string | null }
        Insert: { organization_id: string; person_id: string; ministry_id?: string | null; interest_form_id?: string | null; token?: string | null; token_expires_at?: string | null; form_data?: Json; current_section?: number; status?: string; notes?: string | null }
        Update: Partial<Database['public']['Tables']['staff_applications']['Insert']>
        Relationships: [Rel<'staff_applications_interest_form_id_fkey', ['interest_form_id'], false, 'staff_interest_forms', ['id']>]
      }
      staff_profiles: {
        Row: {
          id: string; organization_id: string; person_id: string; user_id: string | null; role_title: string | null; area: string | null; joined_at: string | null; left_at: string | null; active: boolean; created_at: string; updated_at: string
          // added by migration 085_public_api
          sent_as_missionary: boolean; sent_to: string | null
        }
        Insert: { organization_id: string; person_id: string; user_id?: string | null; role_title?: string | null; area?: string | null; joined_at?: string | null; left_at?: string | null; active?: boolean; sent_as_missionary?: boolean; sent_to?: string | null }
        Update: Partial<Database['public']['Tables']['staff_profiles']['Insert']>
        Relationships: [Rel<'staff_profiles_person_id_fkey', ['person_id'], false, 'people', ['id']>]
      }
      person_public_tokens: {
        Row: { id: string; person_id: string; organization_id: string; token: string; revoked_at: string | null; access_count: number; last_accessed_at: string | null; created_at: string; created_by: string | null }
        Insert: { person_id: string; organization_id: string; token?: string; revoked_at?: string | null; created_by?: string | null }
        Update: Partial<Database['public']['Tables']['person_public_tokens']['Insert']>
        Relationships: [
          Rel<'person_public_tokens_person_id_fkey', ['person_id'], false, 'people', ['id']>,
          Rel<'person_public_tokens_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>
        ]
      }
      organization_api_tokens: {
        Row: { id: string; organization_id: string; site_name: string; token: string; allowed_origin: string | null; revalidate_webhook_url: string | null; revalidate_secret: string | null; revoked_at: string | null; created_at: string; updated_at: string }
        Insert: { organization_id: string; site_name: string; token?: string; allowed_origin?: string | null; revalidate_webhook_url?: string | null; revalidate_secret?: string | null; revoked_at?: string | null }
        Update: Partial<Database['public']['Tables']['organization_api_tokens']['Insert']>
        Relationships: [Rel<'organization_api_tokens_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      organization_stats_overrides: {
        Row: { id: string; organization_id: string; key: string; label: string; value: string; updated_by: string | null; updated_at: string }
        Insert: { organization_id: string; key: string; label: string; value: string; updated_by?: string | null }
        Update: Partial<Database['public']['Tables']['organization_stats_overrides']['Insert']>
        Relationships: [Rel<'organization_stats_overrides_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      student_applications: {
        Row: { id: string; organization_id: string; person_id: string; school_id: string | null; class_id: string | null; status: string; applied_at: string; reviewed_at: string | null; reviewed_by: string | null; notes: string | null }
        Insert: { organization_id: string; person_id: string; school_id?: string | null; class_id?: string | null; status?: string; notes?: string | null }
        Update: Partial<Database['public']['Tables']['student_applications']['Insert']>
        Relationships: []
      }
      student_profiles: {
        Row: { id: string; organization_id: string; person_id: string; user_id: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; person_id: string; user_id?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['student_profiles']['Insert']>
        Relationships: [Rel<'student_profiles_person_id_fkey', ['person_id'], false, 'people', ['id']>]
      }
      schools: {
        Row: {
          id: string; organization_id: string; name: string; acronym: string | null
          description: string | null; active: boolean; created_at: string; updated_at: string
          // added by migration 003_schools_public_page
          type: string | null; public_page_enabled: boolean | null
          public_page_title: string | null; public_page_description: string | null
          public_page_slug: string | null; accept_interest_forms: boolean | null
        }
        Insert: { organization_id: string; name: string; acronym?: string | null; description?: string | null; active?: boolean; type?: string | null; public_page_enabled?: boolean | null; public_page_title?: string | null; public_page_description?: string | null; public_page_slug?: string | null; accept_interest_forms?: boolean | null }
        Update: Partial<Database['public']['Tables']['schools']['Insert']>
        Relationships: [Rel<'schools_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      school_classes: {
        Row: {
          id: string; school_id: string; name: string; year: number | null; semester: number | null
          starts_at: string | null; ends_at: string | null; max_students: number | null
          active: boolean; created_at: string; updated_at: string
          // added by migration 003_schools_public_page
          accept_applications: boolean | null
        }
        Insert: { school_id: string; name: string; year?: number | null; semester?: number | null; starts_at?: string | null; ends_at?: string | null; max_students?: number | null; active?: boolean; accept_applications?: boolean | null }
        Update: Partial<Database['public']['Tables']['school_classes']['Insert']>
        Relationships: [Rel<'school_classes_school_id_fkey', ['school_id'], false, 'schools', ['id']>]
      }
      class_students: {
        Row: { id: string; class_id: string; person_id: string; enrolled_at: string; status: string }
        Insert: { class_id: string; person_id: string; enrolled_at?: string; status?: string }
        Update: Partial<Database['public']['Tables']['class_students']['Insert']>
        Relationships: []
      }
      class_staff: {
        Row: { id: string; class_id: string; person_id: string; role: string }
        Insert: { class_id: string; person_id: string; role?: string }
        Update: Partial<Database['public']['Tables']['class_staff']['Insert']>
        Relationships: []
      }
      ministries: {
        Row: { id: string; organization_id: string; name: string; description: string | null; active: boolean; linked_role: string | null; created_at: string; updated_at: string }
        Insert: { organization_id: string; name: string; description?: string | null; active?: boolean; linked_role?: string | null }
        Update: Partial<Database['public']['Tables']['ministries']['Insert']>
        Relationships: [Rel<'ministries_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      ministry_roles: {
        Row: { id: string; ministry_id: string; name: string }
        Insert: { ministry_id: string; name: string }
        Update: Partial<Database['public']['Tables']['ministry_roles']['Insert']>
        Relationships: []
      }
      ministry_members: {
        Row: { id: string; ministry_id: string; person_id: string; ministry_role_id: string | null; joined_at: string | null; left_at: string | null; active: boolean }
        Insert: { ministry_id: string; person_id: string; ministry_role_id?: string | null; joined_at?: string | null; left_at?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['ministry_members']['Insert']>
        Relationships: []
      }
      ministry_leaders: {
        Row: { id: string; organization_id: string; ministry_id: string; user_id: string; created_at: string }
        Insert: { organization_id: string; ministry_id: string; user_id: string }
        Update: Partial<Database['public']['Tables']['ministry_leaders']['Insert']>
        Relationships: []
      }
      ministry_pending_requests: {
        Row: {
          id: string; organization_id: string; ministry_id: string; requested_by: string
          request_type: 'add_member' | 'remove_member' | 'change_role'
          person_id: string | null; ministry_role_id: string | null; notes: string | null
          status: 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado'
          reviewed_by: string | null; reviewed_at: string | null; created_at: string
        }
        Insert: {
          organization_id: string; ministry_id: string; requested_by: string
          request_type: 'add_member' | 'remove_member' | 'change_role'
          person_id?: string | null; ministry_role_id?: string | null; notes?: string | null
          status?: 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado'
        }
        Update: Partial<Database['public']['Tables']['ministry_pending_requests']['Insert']>
        Relationships: []
      }
      service_requests: {
        Row: {
          id: string; organization_id: string; requester_id: string; requester_role: string
          target_department: 'hospitalidade' | 'dh' | 'secretaria' | 'outro'
          request_type: string; subject: string; description: string | null
          status: 'pendente' | 'em_analise' | 'resolvido' | 'rejeitado'
          reviewed_by: string | null; reviewed_at: string | null; created_at: string
        }
        Insert: {
          organization_id: string; requester_id: string; requester_role: string
          target_department: 'hospitalidade' | 'dh' | 'secretaria' | 'outro'
          request_type: string; subject: string; description?: string | null
          status?: 'pendente' | 'em_analise' | 'resolvido' | 'rejeitado'
        }
        Update: Partial<Database['public']['Tables']['service_requests']['Insert']>
        Relationships: []
      }
      notification_events: {
        Row: { id: string; event_type: string; payload: Json | null; created_at: string }
        Insert: { event_type: string; payload?: Json | null }
        Update: Partial<Database['public']['Tables']['notification_events']['Insert']>
        Relationships: []
      }
      notification_logs: {
        Row: { id: string; event_id: string | null; user_id: string | null; channel: string; status: string; sent_at: string | null; error: string | null }
        Insert: { channel: string; status?: string; event_id?: string | null; user_id?: string | null; sent_at?: string | null; error?: string | null }
        Update: Partial<Database['public']['Tables']['notification_logs']['Insert']>
        Relationships: []
      }
      audit_logs: {
        Row: { id: string; organization_id: string | null; user_id: string | null; action: string; table_name: string | null; record_id: string | null; old_data: Json | null; new_data: Json | null; ip_address: string | null; created_at: string }
        Insert: { action: string; organization_id?: string | null; user_id?: string | null; table_name?: string | null; record_id?: string | null; old_data?: Json | null; new_data?: Json | null; ip_address?: string | null }
        Update: never
        Relationships: []
      }
      // --- tables added by later migrations ---
      reservations: {
        Row: {
          id: string; organization_id: string
          type: 'espaco' | 'quarto'; title: string; description: string | null
          requester_type: string | null; requester_id: string | null; requested_by: string
          starts_at: string; ends_at: string
          resource_description: string | null; guests_count: number | null
          guests_description: string | null; estimated_cost: number | null; final_cost: number | null
          status: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada'
          reviewed_by: string | null; reviewed_at: string | null; review_notes: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          organization_id: string; type: 'espaco' | 'quarto'; title: string
          requested_by: string; starts_at: string; ends_at: string
          description?: string | null; requester_type?: string | null; requester_id?: string | null
          resource_description?: string | null; guests_count?: number | null
          guests_description?: string | null; estimated_cost?: number | null; final_cost?: number | null
          status?: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada'
        }
        Update: Partial<Database['public']['Tables']['reservations']['Insert']>
        Relationships: [Rel<'reservations_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      financial_transactions: {
        Row: {
          id: string; organization_id: string; description: string; amount: number
          type: 'income' | 'expense'; category: string | null; date: string
          status: 'paid' | 'pending' | 'overdue' | 'cancelled'
          created_by: string | null; created_at: string; updated_at: string
          // added by migration 038
          fund_id: string | null; category_id: string | null
          ministry_id: string | null; school_id: string | null
          payment_method: string | null; reference_code: string | null; notes: string | null
          approved_by: string | null; approved_at: string | null
          // added by migration 040
          cash_scope_id: string | null
        }
        Insert: {
          organization_id: string; description: string; amount: number
          type: 'income' | 'expense'; date: string
          category?: string | null; status?: 'paid' | 'pending' | 'overdue' | 'cancelled'
          created_by?: string | null; fund_id?: string | null; category_id?: string | null
          ministry_id?: string | null; school_id?: string | null
          payment_method?: string | null; reference_code?: string | null; notes?: string | null
          approved_by?: string | null; approved_at?: string | null; cash_scope_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['financial_transactions']['Insert']>
        Relationships: [Rel<'financial_transactions_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      finance_funds: {
        Row: { id: string; organization_id: string; name: string; description: string | null; restriction_type: string | null; active: boolean; created_at: string }
        Insert: { organization_id: string; name: string; description?: string | null; restriction_type?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['finance_funds']['Insert']>
        Relationships: [Rel<'finance_funds_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      finance_categories: {
        Row: { id: string; organization_id: string; name: string; type: 'income' | 'expense'; created_at: string }
        Insert: { organization_id: string; name: string; type: 'income' | 'expense' }
        Update: Partial<Database['public']['Tables']['finance_categories']['Insert']>
        Relationships: [Rel<'finance_categories_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      finance_budgets: {
        Row: {
          id: string; organization_id: string; name: string
          fund_id: string | null; category_id: string | null
          ministry_id: string | null; school_id: string | null
          period_start: string; period_end: string; planned_amount: number
          notes: string | null; active: boolean; created_at: string
        }
        Insert: {
          organization_id: string; name: string; period_start: string; period_end: string; planned_amount: number
          fund_id?: string | null; category_id?: string | null; ministry_id?: string | null; school_id?: string | null
          notes?: string | null; active?: boolean
        }
        Update: Partial<Database['public']['Tables']['finance_budgets']['Insert']>
        Relationships: [Rel<'finance_budgets_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      finance_expense_requests: {
        Row: {
          id: string; organization_id: string; requester_id: string
          fund_id: string | null; category_id: string | null
          ministry_id: string | null; school_id: string | null
          description: string; amount: number; due_date: string | null
          status: 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado'
          notes: string | null; reviewed_by: string | null; reviewed_at: string | null; review_notes: string | null
          created_at: string
        }
        Insert: {
          organization_id: string; requester_id: string; description: string; amount: number
          fund_id?: string | null; category_id?: string | null; ministry_id?: string | null; school_id?: string | null
          due_date?: string | null; status?: 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado'
          notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['finance_expense_requests']['Insert']>
        Relationships: [Rel<'finance_expense_requests_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      finance_cash_scopes: {
        Row: {
          id: string; organization_id: string
          entity_type: 'school' | 'ministry'
          school_id: string | null; ministry_id: string | null
          enabled: boolean; include_in_base_available: boolean
          name_snapshot: string | null; notes: string | null
          configured_by: string | null; configured_at: string | null
          created_at: string
        }
        Insert: {
          organization_id: string; entity_type: 'school' | 'ministry'
          school_id?: string | null; ministry_id?: string | null
          enabled?: boolean; include_in_base_available?: boolean
          name_snapshot?: string | null; notes?: string | null
          configured_by?: string | null; configured_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['finance_cash_scopes']['Insert']>
        Relationships: [Rel<'finance_cash_scopes_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      finance_price_tables: {
        Row: { id: string; organization_id: string; name: string; period_start: string; period_end: string; active: boolean; notes: string | null; created_by: string | null; created_at: string }
        Insert: { organization_id: string; name: string; period_start: string; period_end: string; active?: boolean; notes?: string | null; created_by?: string | null }
        Update: Partial<Database['public']['Tables']['finance_price_tables']['Insert']>
        Relationships: []
      }
      finance_price_items: {
        Row: { id: string; table_id: string; organization_id: string; category: string; description: string; unit_type: string; amount: number; sort_order: number }
        Insert: { table_id: string; organization_id: string; category: string; description: string; unit_type?: string; amount?: number; sort_order?: number }
        Update: Partial<Database['public']['Tables']['finance_price_items']['Insert']>
        Relationships: []
      }
      finance_charges: {
        Row: { id: string; organization_id: string; person_id: string | null; person_name_snapshot: string | null; description: string; amount: number; due_date: string; status: string; origin: string; reference_month: string | null; price_item_id: string | null; notes: string | null; paid_at: string | null; paid_by: string | null; created_by: string | null; created_at: string }
        Insert: { organization_id: string; description: string; amount: number; due_date: string; person_id?: string | null; person_name_snapshot?: string | null; status?: string; origin?: string; reference_month?: string | null; price_item_id?: string | null; notes?: string | null; created_by?: string | null }
        Update: Partial<Database['public']['Tables']['finance_charges']['Insert']>
        Relationships: []
      }
      finance_payables: {
        Row: { id: string; organization_id: string; description: string; supplier: string | null; amount: number; due_date: string; recurrence: string; category_id: string | null; fund_id: string | null; status: string; notes: string | null; paid_at: string | null; paid_by: string | null; created_by: string | null; created_at: string }
        Insert: { organization_id: string; description: string; amount: number; due_date: string; recurrence?: string; supplier?: string | null; category_id?: string | null; fund_id?: string | null; status?: string; notes?: string | null; created_by?: string | null }
        Update: Partial<Database['public']['Tables']['finance_payables']['Insert']>
        Relationships: []
      }
      kitchen_meal_consumers: {
        Row: {
          id: string; organization_id: string; person_id: string | null; consumer_name: string | null
          meal_date: string; breakfast: boolean; lunch: boolean; dinner: boolean
          payment_type: string | null; paid_until: string | null; notes: string | null
          created_by: string | null; created_at: string
          // added by migration 026
          purchase_group_id: string | null
          subtotal_amount: number | null; discount_amount: number | null; final_amount: number | null
          // added by migration 030
          payment_status: string | null; purchase_source: string | null
          requested_by: string | null; paid_at: string | null; paid_by: string | null
        }
        Insert: {
          organization_id: string; meal_date: string
          person_id?: string | null; consumer_name?: string | null
          breakfast?: boolean; lunch?: boolean; dinner?: boolean
          payment_type?: string | null; paid_until?: string | null; notes?: string | null
          created_by?: string | null; purchase_group_id?: string | null
          subtotal_amount?: number | null; discount_amount?: number | null; final_amount?: number | null
          payment_status?: string | null; purchase_source?: string | null
          requested_by?: string | null; paid_at?: string | null; paid_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['kitchen_meal_consumers']['Insert']>
        Relationships: [Rel<'kitchen_meal_consumers_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      kitchen_meal_settings: {
        Row: {
          organization_id: string
          breakfast_price: number; lunch_price: number; dinner_price: number
          combo_lunch_dinner_includes_breakfast: boolean
          lunch_dinner_discount_percent: number
          // added by migration 027
          meal_options: Json | null; combo_rules: Json | null
          // added by migrations 031/032
          payment_mode: string | null; payment_methods: Json | null
          payment_instructions: string | null; payment_provider: string | null
          payment_provider_settings: Json | null
          updated_at: string
        }
        Insert: {
          organization_id: string
          breakfast_price?: number; lunch_price?: number; dinner_price?: number
          combo_lunch_dinner_includes_breakfast?: boolean; lunch_dinner_discount_percent?: number
          meal_options?: Json | null; combo_rules?: Json | null
          payment_mode?: string | null; payment_methods?: Json | null
          payment_instructions?: string | null; payment_provider?: string | null
          payment_provider_settings?: Json | null
        }
        Update: Partial<Database['public']['Tables']['kitchen_meal_settings']['Insert']>
        Relationships: [Rel<'kitchen_meal_settings_organization_id_fkey', ['organization_id'], true, 'organizations', ['id']>]
      }
      kitchen_stock_items: {
        Row: {
          id: string; organization_id: string; name: string; category: string | null
          unit: string | null; quantity: number; min_quantity: number | null
          notes: string | null; active: boolean; created_at: string; updated_at: string
        }
        Insert: { organization_id: string; name: string; category?: string | null; unit?: string | null; quantity?: number; min_quantity?: number | null; notes?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['kitchen_stock_items']['Insert']>
        Relationships: [Rel<'kitchen_stock_items_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      school_interest_forms: {
        Row: {
          id: string; organization_id: string; school_id: string; class_id: string | null
          full_name: string; email: string | null; phone: string | null; message: string | null
          status: 'pendente' | 'formulario_enviado' | 'em_contato' | 'convertido' | 'descartado'
          notified_at: string | null; responded_at: string | null; created_at: string
        }
        Insert: {
          organization_id: string; school_id: string; full_name: string
          class_id?: string | null; email?: string | null; phone?: string | null; message?: string | null
          status?: 'pendente' | 'formulario_enviado' | 'em_contato' | 'convertido' | 'descartado'
        }
        Update: Partial<Database['public']['Tables']['school_interest_forms']['Insert']>
        Relationships: [Rel<'school_interest_forms_school_id_fkey', ['school_id'], false, 'schools', ['id']>]
      }
      school_applications: {
        Row: {
          id: string; interest_form_id: string | null; organization_id: string
          school_id: string; class_id: string | null
          token: string; token_expires_at: string
          status: string; current_section: string | null; form_data: Json | null
          created_at: string; updated_at: string
        }
        Insert: {
          organization_id: string; school_id: string; token: string; token_expires_at: string
          interest_form_id?: string | null; class_id?: string | null
          status?: string; current_section?: string | null; form_data?: Json | null
        }
        Update: Partial<Database['public']['Tables']['school_applications']['Insert']>
        Relationships: [Rel<'school_applications_school_id_fkey', ['school_id'], false, 'schools', ['id']>]
      }
      reference_forms: {
        Row: {
          id: string; school_application_id: string | null; staff_application_id: string | null
          type: 'pastor' | 'amigo'; token: string; token_expires_at: string
          status: 'pendente' | 'enviado'; form_data: Json | null; created_at: string
        }
        Insert: {
          school_application_id?: string | null; staff_application_id?: string | null
          type: 'pastor' | 'amigo'
          token?: string; token_expires_at?: string
          status?: 'pendente' | 'enviado'; form_data?: Json | null
        }
        Update: Partial<Database['public']['Tables']['reference_forms']['Insert']>
        Relationships: [
          Rel<'reference_forms_school_application_id_fkey', ['school_application_id'], false, 'school_applications', ['id']>,
          Rel<'reference_forms_staff_application_id_fkey', ['staff_application_id'], false, 'staff_applications', ['id']>
        ]
      }
      base_groups: {
        Row: { id: string; name: string; description: string | null; active: boolean; created_at: string }
        Insert: { name: string; description?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['base_groups']['Insert']>
        Relationships: []
      }
      base_group_organizations: {
        Row: { id: string; group_id: string; organization_id: string; created_at: string }
        Insert: { group_id: string; organization_id: string }
        Update: Partial<Database['public']['Tables']['base_group_organizations']['Insert']>
        Relationships: [
          Rel<'base_group_organizations_group_id_fkey', ['group_id'], false, 'base_groups', ['id']>,
          Rel<'base_group_organizations_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>
        ]
      }
      base_group_leaders: {
        Row: { id: string; group_id: string; user_id: string; created_at: string }
        Insert: { group_id: string; user_id: string }
        Update: Partial<Database['public']['Tables']['base_group_leaders']['Insert']>
        Relationships: [Rel<'base_group_leaders_group_id_fkey', ['group_id'], false, 'base_groups', ['id']>]
      }
      base_supervisors: {
        Row: { id: string; organization_id: string; user_id: string; active: boolean; created_at: string }
        Insert: { organization_id: string; user_id: string; active?: boolean }
        Update: Partial<Database['public']['Tables']['base_supervisors']['Insert']>
        Relationships: [Rel<'base_supervisors_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      auth_organization_id: { Args: Record<PropertyKey, never>; Returns: string | null }
      auth_role: { Args: Record<PropertyKey, never>; Returns: string | null }
      is_superadmin: { Args: Record<PropertyKey, never>; Returns: boolean }
      supervised_base_ids: { Args: { target_user_id: string }; Returns: string[] }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
