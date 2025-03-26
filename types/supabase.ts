export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      employee_profiles: {
        Row: {
          id: string
          email: string
          fiscal_name: string
          pin: string
          is_active: boolean
          created_at: string
          updated_at: string
          phone?: string | null
          country: string
          timezone: string
          company_id?: string | null
          document_type?: string | null
          document_number?: string | null
          delegation?: string | null
          employee_id?: string | null
          seniority_date?: string | null
          job_positions?: string[] | null
          work_centers?: string[] | null
        }
        Insert: {
          id: string
          email: string
          fiscal_name: string
          pin: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          phone?: string | null
          country?: string
          timezone?: string
          company_id?: string | null
          document_type?: string | null
          document_number?: string | null
          delegation?: string | null
          employee_id?: string | null
          seniority_date?: string | null
          job_positions?: string[] | null
          work_centers?: string[] | null
        }
        Update: {
          id?: string
          email?: string
          fiscal_name?: string
          pin?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          phone?: string | null
          country?: string
          timezone?: string
          company_id?: string | null
          document_type?: string | null
          document_number?: string | null
          delegation?: string | null
          employee_id?: string | null
          seniority_date?: string | null
          job_positions?: string[] | null
          work_centers?: string[] | null
        }
      }
      supervisor_profiles: {
        Row: {
          id: string
          email: string
          fiscal_name: string
          pin: string
          is_active: boolean
          created_at: string
          updated_at: string
          phone?: string | null
          country: string
          timezone: string
          company_id?: string | null
          document_type?: string | null
          document_number?: string | null
          supervisor_type?: string | null
          employee_id?: string | null
          work_centers?: string[] | null
          delegations?: string[] | null
        }
        Insert: {
          id: string
          email: string
          fiscal_name: string
          pin: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          phone?: string | null
          country?: string
          timezone?: string
          company_id?: string | null
          document_type?: string | null
          document_number?: string | null
          supervisor_type?: string | null
          employee_id?: string | null
          work_centers?: string[] | null
          delegations?: string[] | null
        }
        Update: {
          id?: string
          email?: string
          fiscal_name?: string
          pin?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          phone?: string | null
          country?: string
          timezone?: string
          company_id?: string | null
          document_type?: string | null
          document_number?: string | null
          supervisor_type?: string | null
          employee_id?: string | null
          work_centers?: string[] | null
          delegations?: string[] | null
        }
      }
    }
    Functions: {
      verify_employee_credentials: {
        Args: {
          p_email: string
          p_pin: string
        }
        Returns: boolean
      }
    }
  }
}