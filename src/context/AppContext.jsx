import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { supabase, isSupabaseReady } from "../lib/supabase";

const AppContext = createContext();

// Enrich a Supabase auth user with user_metadata
function enrichUser(authUser) {
  if (!authUser) return null;
  const meta = authUser.user_metadata || {};
  return {
    id:     authUser.id,
    email:  authUser.email,
    name:   meta.name   || authUser.email.split("@")[0],
    avatar: meta.avatar || authUser.email.slice(0, 2).toUpperCase(),
    role:   meta.role   || "account",
  };
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────
async function sbFetchAll() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("projects")
    .select("id, data")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Supabase] fetch:", error.message);
    return null;
  }
  return data.map((row) => ({ ...row.data, id: row.id }));
}

async function sbUpsert(project) {
  if (!supabase) return;
  const { error } = await supabase.from("projects").upsert({
    id: project.id,
    data: project,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[Supabase] upsert:", error.message);
}

async function sbDelete(id) {
  if (!supabase) return;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) console.error("[Supabase] delete:", error.message);
}

async function syncProfileIfExists(authUser) {
  if (!supabase || !authUser) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (error) { console.error("[Supabase] profile check:", error.message); return false; }
  if (!data) return false; // usuário não cadastrado
  const profile = enrichUser(authUser);
  await supabase.from("profiles").update({
    name:   profile.name,
    email:  profile.email,
    avatar: profile.avatar,
  }).eq("id", profile.id);
  return true;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // ── Projects ──────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState(() => {
    try {
      const s = localStorage.getItem("rl_projects");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const [loadingProjects, setLoadingProjects] = useState(isSupabaseReady);

  // ── Contador de escritas locais em andamento (evita sobrescrever via realtime) ──
  const pendingWrites = useRef(0);

  // ── Team members (from profiles table) ────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState([]);

  // ── Supabase Auth session restore + listener ───────────────────────────────
  useEffect(() => {
    if (!supabase) { setLoadingAuth(false); return; }

    // Restore existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(enrichUser(session?.user ?? null));
      setLoadingAuth(false);
    });

    // Keep user in sync (login, logout, token refresh, cross-tab)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        syncProfileIfExists(session.user).then((exists) => {
          if (!exists) {
            supabase.auth.signOut();
            setAuthError("Acesso não autorizado. Entre em contato com o administrador.");
          } else {
            setAuthError(null);
            setUser(enrichUser(session.user));
          }
        });
      } else {
        setUser(enrichUser(session?.user ?? null));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Cloud sync on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady) return;
    setLoadingProjects(true);
    sbFetchAll()
      .then((rows) => {
        if (rows !== null) {
          setProjects(rows);
          localStorage.setItem("rl_projects", JSON.stringify(rows));
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar projetos:", err);
      })
      .finally(() => {
        setLoadingProjects(false);
      });

    // Load team members from profiles table
    supabase
      .from("profiles")
      .select("*")
      .eq("disabled", false)
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao carregar membros do time:", error);
          return;
        }
        if (data) setTeamMembers(data);
      });
  }, []);

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("projects-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "projects" },
        ({ new: row }) => {
          if (pendingWrites.current > 0) return;
          const project = { ...row.data, id: row.id };
          setProjects((prev) => {
            const updated = [project, ...prev];
            localStorage.setItem("rl_projects", JSON.stringify(updated));
            return updated;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects" },
        ({ new: row }) => {
          if (pendingWrites.current > 0) return;
          const project = { ...row.data, id: row.id };
          setProjects((prev) => {
            const updated = prev.map((p) => (String(p.id) === String(row.id) ? project : p));
            localStorage.setItem("rl_projects", JSON.stringify(updated));
            return updated;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "projects" },
        ({ old: row }) => {
          if (pendingWrites.current > 0) return;
          setProjects((prev) => {
            const updated = prev.filter((p) => String(p.id) !== String(row.id));
            localStorage.setItem("rl_projects", JSON.stringify(updated));
            return updated;
          });
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    if (!supabase) return { ok: false, error: "Supabase não configurado." };
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, user: enrichUser(data.user) };
  }, []);

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
      // onAuthStateChange will call setUser(null)
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!supabase) return { ok: false, error: "Supabase não configurado." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addProject = useCallback(
    (data) => {
      const project = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        status: "onboarding",
        progress: 0,
        accountId: user?.id,
        accountName: user?.name,
        completedSteps: [],
      };
      setProjects((prev) => {
        const updated = [project, ...prev];
        localStorage.setItem("rl_projects", JSON.stringify(updated));
        return updated;
      });
      pendingWrites.current += 1;
      sbUpsert(project)
        .catch((err) => console.error("Erro ao salvar projeto no Supabase:", err))
        .finally(() => { pendingWrites.current -= 1; });
      return project;
    },
    [user],
  );

  const updateProject = useCallback((id, patch) => {
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id !== id ? p : { ...p, ...patch }));
      const merged = updated.find((p) => p.id === id);
      if (merged) {
        pendingWrites.current += 1;
        sbUpsert(merged)
          .catch((err) => console.error("Erro ao atualizar projeto no Supabase:", err))
          .finally(() => { pendingWrites.current -= 1; });
      }
      localStorage.setItem("rl_projects", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteProject = useCallback((id) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem("rl_projects", JSON.stringify(updated));
      return updated;
    });
    sbDelete(id);
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    user,
    loadingAuth,
    authError,
    projects,
    loadingProjects,
    login,
    logout,
    loginWithGoogle,
    addProject,
    updateProject,
    deleteProject,
    isSupabaseReady,
    teamMembers,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};
