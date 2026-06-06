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
        }
        Insert: { name: string; slug: string; country?: string; city?: string | null; state?: string | null; phone?: string | null; email?: string | null; website?: string | null; logo_url?: string | null; active?: boolean; accent_color?: string | null; department_assignments?: Record<string, string> | null }
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
      staff_applications: {
        Row: { id: string; organization_id: string; person_id: string; ministry_id: string | null; status: string; applied_at: string; reviewed_at: string | null; reviewed_by: string | null; notes: string | null }
        Insert: { organization_id: string; person_id: string; ministry_id?: string | null; status?: string; notes?: string | null }
        Update: Partial<Database['public']['Tables']['staff_applications']['Insert']>
        Relationships: []
      }
      staff_profiles: {
        Row: { id: string; organization_id: string; person_id: string; role_title: string | null; area: string | null; joined_at: string | null; left_at: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; person_id: string; role_title?: string | null; area?: string | null; joined_at?: string | null; left_at?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['staff_profiles']['Insert']>
        Relationships: [Rel<'staff_profiles_person_id_fkey', ['person_id'], false, 'people', ['id']>]
      }
      student_applications: {
        Row: { id: string; organization_id: string; person_id: string; school_id: string | null; class_id: string | null; status: string; applied_at: string; reviewed_at: string | null; reviewed_by: string | null; notes: string | null }
        Insert: { organization_id: string; person_id: string; school_id?: string | null; class_id?: string | null; status?: string; notes?: string | null }
        Update: Partial<Database['public']['Tables']['student_applications']['Insert']>
        Relationships: []
      }
      student_profiles: {
        Row: { id: string; organization_id: string; person_id: string; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; person_id: string; active?: boolean }
        Update: Partial<Database['public']['Tables']['student_profiles']['Insert']>
        Relationships: [Rel<'student_profiles_person_id_fkey', ['person_id'], false, 'people', ['id']>]
      }
      schools: {
        Row: { id: string; organization_id: string; name: string; acronym: string | null; description: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; name: string; acronym?: string | null; description?: string | null; active?: boolean }
        Update: Partial<Database['public']['Tables']['schools']['Insert']>
        Relationships: [Rel<'schools_organization_id_fkey', ['organization_id'], false, 'organizations', ['id']>]
      }
      school_classes: {
        Row: { id: string; school_id: string; name: string; year: number | null; semester: number | null; starts_at: string | null; ends_at: string | null; max_students: number | null; active: boolean; created_at: string; updated_at: string }
        Insert: { school_id: string; name: string; year?: number | null; semester?: number | null; starts_at?: string | null; ends_at?: string | null; max_students?: number | null; active?: boolean }
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
        Row: { id: string; organization_id: string; name: string; description: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { organization_id: string; name: string; description?: string | null; active?: boolean }
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
    }
    Views: { [_ in never]: never }
    Functions: {
      auth_organization_id: { Args: Record<PropertyKey, never>; Returns: string | null }
      auth_role: { Args: Record<PropertyKey, never>; Returns: string | null }
      is_superadmin: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
