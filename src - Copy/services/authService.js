import { supabase } from '../lib/supabase';

export const authService = {
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();

      return {
        data,
        error,
      };
    } catch (error) {
      console.error('Get session failed:', error);

      return {
        data: {
          session: null,
        },
        error,
      };
    }
  },

  async login({ email, password }) {
    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        return {
          data: null,
          error,
        };
      }

      return {
        data,
        error: null,
      };
    } catch (error) {
      console.error('Login failed:', error);

      return {
        data: null,
        error,
      };
    }
  },

  async register({
    fullName,
    email,
    password,
  }) {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanFullName = fullName.trim();

      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanFullName,
            },
            emailRedirectTo:
              `${window.location.origin}/auth/callback`,
          },
        });

      if (error) {
        return {
          data: null,
          error,
        };
      }

      return {
        data,
        error: null,
      };
    } catch (error) {
      console.error('Registration failed:', error);

      return {
        data: null,
        error,
      };
    }
  },

  async logout() {
    try {
      const { error } = await supabase.auth.signOut({
        scope: 'local',
      });

      if (error) {
        return {
          success: false,
          error,
        };
      }

      return {
        success: true,
        error: null,
      };
    } catch (error) {
      console.error('Logout failed:', error);

      return {
        success: false,
        error,
      };
    }
  },

  async sendPasswordReset(email) {
    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/reset-password`,
          },
        );

      return {
        data,
        error,
      };
    } catch (error) {
      console.error('Password reset request failed:', error);

      return {
        data: null,
        error,
      };
    }
  },

  async updatePassword(password) {
    try {
      const { data, error } =
        await supabase.auth.updateUser({
          password,
        });

      return {
        data,
        error,
      };
    } catch (error) {
      console.error('Password update failed:', error);

      return {
        data: null,
        error,
      };
    }
  },

  async resendVerification(email) {
    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error } =
        await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
          options: {
            emailRedirectTo:
              `${window.location.origin}/auth/callback`,
          },
        });

      return {
        data,
        error,
      };
    } catch (error) {
      console.error('Verification email resend failed:', error);

      return {
        data: null,
        error,
      };
    }
  },
};

export default authService;