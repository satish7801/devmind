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
      commits: {
        Row: {
          author_login: string | null
          committed_at: string | null
          created_at: string
          html_url: string
          id: string
          message: string | null
          repo_full_name: string
          sha: string
          user_id: string
        }
        Insert: {
          author_login?: string | null
          committed_at?: string | null
          created_at?: string
          html_url: string
          id?: string
          message?: string | null
          repo_full_name: string
          sha: string
          user_id: string
        }
        Update: {
          author_login?: string | null
          committed_at?: string | null
          created_at?: string
          html_url?: string
          id?: string
          message?: string | null
          repo_full_name?: string
          sha?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          account_id: string | null
          account_login: string | null
          created_at: string
          encrypted_token: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          site_url: string | null
          status: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          account_id?: string | null
          account_login?: string | null
          created_at?: string
          encrypted_token?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          site_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          account_id?: string | null
          account_login?: string | null
          created_at?: string
          encrypted_token?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          provider?: Database["public"]["Enums"]["integration_provider"]
          site_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      issues: {
        Row: {
          assignee: string | null
          created_at: string
          description: string | null
          html_url: string
          id: string
          issue_type: string | null
          jira_key: string
          jira_updated_at: string | null
          priority: string | null
          project_key: string | null
          reporter: string | null
          status: string | null
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          description?: string | null
          html_url: string
          id?: string
          issue_type?: string | null
          jira_key: string
          jira_updated_at?: string | null
          priority?: string | null
          project_key?: string | null
          reporter?: string | null
          status?: string | null
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          description?: string | null
          html_url?: string
          id?: string
          issue_type?: string | null
          jira_key?: string
          jira_updated_at?: string | null
          priority?: string | null
          project_key?: string | null
          reporter?: string | null
          status?: string | null
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kg_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      kg_citations: {
        Row: {
          answer_id: string
          created_at: string
          id: string
          position: number
          source_ref: string
          source_type: string
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          id?: string
          position?: number
          source_ref: string
          source_type: string
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          id?: string
          position?: number
          source_ref?: string
          source_type?: string
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kg_citations_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "kg_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          source: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          source: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          source?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pull_requests: {
        Row: {
          additions: number | null
          author_login: string | null
          body: string | null
          changed_files: number | null
          created_at: string
          deletions: number | null
          html_url: string
          id: string
          merged_at: string | null
          number: number
          repo_full_name: string
          state: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additions?: number | null
          author_login?: string | null
          body?: string | null
          changed_files?: number | null
          created_at?: string
          deletions?: number | null
          html_url: string
          id?: string
          merged_at?: string | null
          number: number
          repo_full_name: string
          state: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additions?: number | null
          author_login?: string | null
          body?: string | null
          changed_files?: number | null
          created_at?: string
          deletions?: number | null
          html_url?: string
          id?: string
          merged_at?: string | null
          number?: number
          repo_full_name?: string
          state?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      repos: {
        Row: {
          created_at: string
          default_branch: string | null
          description: string | null
          full_name: string
          github_id: number
          html_url: string
          id: string
          language: string | null
          pushed_at: string | null
          stars: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_branch?: string | null
          description?: string | null
          full_name: string
          github_id: number
          html_url: string
          id?: string
          language?: string | null
          pushed_at?: string | null
          stars?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_branch?: string | null
          description?: string | null
          full_name?: string
          github_id?: number
          html_url?: string
          id?: string
          language?: string | null
          pushed_at?: string | null
          stars?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      slack_channels: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          is_tracked: boolean
          name: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          is_tracked?: boolean
          name: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          is_tracked?: boolean
          name?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      slack_messages: {
        Row: {
          author: string | null
          channel_id: string
          channel_name: string | null
          created_at: string
          id: string
          permalink: string | null
          posted_at: string | null
          text: string | null
          ts: string
          user_id: string
        }
        Insert: {
          author?: string | null
          channel_id: string
          channel_name?: string | null
          created_at?: string
          id?: string
          permalink?: string | null
          posted_at?: string | null
          text?: string | null
          ts: string
          user_id: string
        }
        Update: {
          author?: string | null
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          id?: string
          permalink?: string | null
          posted_at?: string | null
          text?: string | null
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_type: string
          id: string
          payload: Json
          processed_at: string
          provider: string
          user_id: string | null
        }
        Insert: {
          event_type: string
          id?: string
          payload: Json
          processed_at?: string
          provider: string
          user_id?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
          provider?: string
          user_id?: string | null
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
      integration_provider: "github" | "jira" | "slack"
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
      integration_provider: ["github", "jira", "slack"],
    },
  },
} as const
