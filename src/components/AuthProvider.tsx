"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AUTH_SESSION_STORAGE_KEY,
  BROWSER_ID_STORAGE_KEY,
  hashPassword,
  isAuthSession,
  normalizeUsername,
  type AuthSession,
} from "@/lib/auth";

interface AuthContextValue {
  session: AuthSession | null;
  isReady: boolean;
  isModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthView = "login" | "signup";

function getSessionLabel(session: AuthSession | null) {
  if (!session) {
    return "Sign in";
  }

  return session.profileMode === "account" ? session.username : "Guest";
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 12c2.761 0 5-2.463 5-5.5S14.761 1 12 1 7 3.463 7 6.5 9.239 12 12 12Zm0 2c-4.418 0-8 2.91-8 6.5V23h16v-2.5c0-3.59-3.582-6.5-8-6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AuthModal({
  isOpen,
  view,
  session,
  username,
  password,
  error,
  isSubmitting,
  isHashing,
  canDismiss,
  onUsernameChange,
  onPasswordChange,
  onToggleView,
  onSubmit,
  onContinueWithoutSignIn,
  onClose,
  onSignOut,
}: {
  isOpen: boolean;
  view: AuthView;
  session: AuthSession | null;
  username: string;
  password: string;
  error: string | null;
  isSubmitting: boolean;
  isHashing: boolean;
  canDismiss: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleView: (nextView: AuthView) => void;
  onSubmit: () => void;
  onContinueWithoutSignIn: () => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const isLogin = view === "login";
  const title = isLogin ? "Log In to Hydrocarbon Atlas" : "Sign Up for Hydrocarbon Atlas";
  const subtitle = isLogin
    ? "Use your user ID and password to load the database profile tied to your account."
    : "Create a user ID and password to store a separate progress profile under your own account.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,23,27,0.74)] px-4 py-6 backdrop-blur-sm">
      <div className="surface-card relative w-full max-w-md p-6 md:p-7">
        {canDismiss ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)]"
          >
            Close
          </button>
        ) : null}

        <p className="section-kicker">Account access</p>
        <h2 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{subtitle}</p>

        {session?.profileMode === "account" ? (
          <div className="mt-5 flex items-center justify-between rounded-[1.4rem] border border-[color:var(--line)] bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                Signed in as {session.username}
              </p>
              <p className="text-xs text-[color:var(--muted)]">
                Use the button here to log out and switch accounts.
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-full border border-[color:var(--line)] px-4 py-2 text-xs font-semibold text-[color:var(--foreground)]"
            >
              Log out
            </button>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">User ID</span>
            <input
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="Enter your user ID"
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-base text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Enter your password"
              className="mt-2 w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-base text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            <span className="mt-2 block text-xs text-[color:var(--muted)]">
              {isHashing ? "Hashing password..." : "Passwords are hashed before comparison or storage."}
            </span>
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-[1.2rem] border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--foreground)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || isHashing || username.trim().length === 0 || password.length === 0}
            className="rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,118,110,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Working..." : isLogin ? "Log In" : "Sign up"}
          </button>

          {isLogin ? (
            <button
              type="button"
              onClick={onContinueWithoutSignIn}
              className="rounded-full border border-[color:var(--line)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-strong)]"
            >
              Continue without sign in
            </button>
          ) : null}
        </div>

        <p className="mt-5 text-sm text-[color:var(--muted)]">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => onToggleView(isLogin ? "signup" : "login")}
            className="font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
          >
            {isLogin ? "Sign up instead" : "Log in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const browserIdRef = useRef<string | null>(null);
  const passwordHashRequestRef = useRef(0);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [view, setView] = useState<AuthView>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordHash, setPasswordHash] = useState("");
  const [isHashing, setIsHashing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrapAuth() {
      const savedBrowserId =
        window.localStorage.getItem(BROWSER_ID_STORAGE_KEY) ?? crypto.randomUUID();

      window.localStorage.setItem(BROWSER_ID_STORAGE_KEY, savedBrowserId);
      browserIdRef.current = savedBrowserId;

      const rawSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession) as unknown;

          if (isAuthSession(parsed)) {
            const restoredSession =
              parsed.profileMode === "account"
                ? {
                    profileMode: "account" as const,
                    browserId: savedBrowserId,
                    username: normalizeUsername(parsed.username),
                  }
                : {
                    profileMode: "guest" as const,
                    browserId: savedBrowserId,
                    username: null,
                  };

            setSession(restoredSession);
          }
        } catch {
          window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        }
      }

      setIsReady(true);
    }

    void bootstrapAuth();
  }, []);

  function persistSession(nextSession: AuthSession | null) {
    if (!nextSession) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  }

  function resetForm() {
    setPassword("");
    setPasswordHash("");
    setIsHashing(false);
    setIsSubmitting(false);
    setError(null);
  }

  function openAuthModal() {
    setError(null);
    setIsModalOpen(true);
  }

  function closeAuthModal() {
    if (!session) {
      return;
    }

    setError(null);
    setIsModalOpen(false);
    resetForm();
  }

  function signOut() {
    setSession(null);
    persistSession(null);
    setView("login");
    setUsername("");
    resetForm();
    setIsModalOpen(true);
  }

  async function handlePasswordChange(value: string) {
    setPassword(value);
    setError(null);

    const nextRequestId = passwordHashRequestRef.current + 1;
    passwordHashRequestRef.current = nextRequestId;

    if (value.length === 0) {
      setPasswordHash("");
      setIsHashing(false);
      return;
    }

    setIsHashing(true);
    const nextHash = await hashPassword(value);

    if (passwordHashRequestRef.current !== nextRequestId) {
      return;
    }

    setPasswordHash(nextHash);
    setIsHashing(false);
  }

  async function handleSubmit() {
    const browserId = browserIdRef.current;

    if (!browserId) {
      return;
    }

    const normalizedUsername = normalizeUsername(username);

    if (normalizedUsername.length < 3 || normalizedUsername.length > 32) {
      setError("User ID must be between 3 and 32 characters.");
      return;
    }

    if (!passwordHash || isHashing) {
      setError("Wait for the password hash to finish, then try again.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: view,
          username: normalizedUsername,
          passwordHash,
          browserId,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        session?: AuthSession;
      };

      if (!response.ok || !payload.session || !isAuthSession(payload.session)) {
        throw new Error(payload.error ?? "Could not authenticate this account.");
      }

      setSession(payload.session);
      persistSession(payload.session);
      setUsername(payload.session.profileMode === "account" ? payload.session.username : "");
      resetForm();
      setIsModalOpen(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not authenticate this account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function continueWithoutSignIn() {
    const browserId = browserIdRef.current;

    if (!browserId) {
      return;
    }

    const guestSession: AuthSession = {
      profileMode: "guest",
      browserId,
      username: null,
    };

    setSession(guestSession);
    persistSession(guestSession);
    resetForm();
    setIsModalOpen(false);
  }

  const contextValue: AuthContextValue = {
    session,
    isReady,
    isModalOpen,
    openAuthModal,
    closeAuthModal,
    signOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {isReady ? (
        <button
          type="button"
          onClick={openAuthModal}
          className="fixed right-5 top-5 z-40 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[rgba(255,251,244,0.92)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] shadow-[0_20px_40px_rgba(18,31,38,0.12)] backdrop-blur"
        >
          <UserIcon />
          <span>{getSessionLabel(session)}</span>
        </button>
      ) : null}

      {children}

      <AuthModal
        isOpen={isModalOpen}
        view={view}
        session={session}
        username={username}
        password={password}
        error={error}
        isSubmitting={isSubmitting}
        isHashing={isHashing}
        canDismiss={Boolean(session)}
        onUsernameChange={(value) => {
          setUsername(value);
          setError(null);
        }}
        onPasswordChange={(value) => {
          void handlePasswordChange(value);
        }}
        onToggleView={(nextView) => {
          setView(nextView);
          setError(null);
        }}
        onSubmit={() => {
          void handleSubmit();
        }}
        onContinueWithoutSignIn={continueWithoutSignIn}
        onClose={closeAuthModal}
        onSignOut={signOut}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}