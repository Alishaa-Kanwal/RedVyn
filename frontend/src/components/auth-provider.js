"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi } from "@/lib/api";

const AuthContext = createContext(null);

export function dashboardPath(role) {
  if (role === "admin") return "/dashboard/admin";
  if (role === "donor") return "/dashboard/donor";
  if (role === "guardian") return "/dashboard/guardian";
  if (role === "hospital") return "/dashboard/hospital";
  return "/";
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { body } = await authApi.me();
      setUser(body.user ?? null);
      return body.user ?? null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      await refresh();
      if (mounted) setLoading(false);
    }
    init();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const signin = useCallback(async (data) => {
    // Use the unified sign-in endpoint that supports admin, donor, guardian and hospital.
    const { body } = await authApi.signin(data);
    setUser(body.user ?? null);
    return body.user ?? null;
  }, []);

  const signup = useCallback(async (data) => {
    // Dispatch to the correct role-specific registration endpoint.
    let response;
    if (data.role === "donor") {
      response = await authApi.donorSignup(data);
    } else if (data.role === "guardian") {
      response = await authApi.guardianSignup(data);
    } else if (data.role === "hospital") {
      response = await authApi.hospitalSignup(data);
    } else {
      response = await authApi.signup(data);
    }
    setUser(response.body.user ?? null);
    return response.body.user ?? null;
  }, []);

  const signout = useCallback(async () => {
    await authApi.signout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signin, signup, signout }}>
      {children}
    </AuthContext.Provider>
  );
}
