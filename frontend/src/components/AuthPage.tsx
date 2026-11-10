
import { useState, type FormEvent } from "react";
import { apiRequest, setAccessToken, type AuthUser } from "../utils/api";

type Props = {
  onLogin: (user: AuthUser) => void;
};

type AuthResponse = {
  token?: string;
  accessToken?: string;
  user?: AuthUser;
  message?: string;
};

export default function AuthPage({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });

        setMode("login");
        setPassword("");
        setError("");
        return;
      }

      const data = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const token = data.token ?? data.accessToken;

      if (!token || !data.user) {
        throw new Error(
          "Login response format unexpected. Check the backend response.",
        );
      }

      setAccessToken(token);
      onLogin(data.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0b141a] p-4 text-[#e9edef]">
      <div className="w-full max-w-md rounded-2xl border border-[#303d45] bg-[#202c33] p-6 shadow-2xl sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#00a884] text-3xl">
            ☎
          </div>

          <h1 className="text-2xl font-bold">WhatsApp Clone</h1>

          <p className="mt-2 text-sm text-[#aebac1]">
            {mode === "login"
              ? "Welcome back! Sign in to continue."
              : "Create an account to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label htmlFor="auth-name" className="mb-1 block text-sm">
                Full name
              </label>
              <input
                id="auth-name"
                required
                minLength={2}
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your name"
                className="w-full rounded-lg border border-[#3b4a54] bg-[#111b21] px-4 py-3 outline-none focus:border-[#00a884]"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[#3b4a54] bg-[#111b21] px-4 py-3 outline-none focus:border-[#00a884]"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-[#3b4a54] bg-[#111b21] px-4 py-3 outline-none focus:border-[#00a884]"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#00a884] px-4 py-3 font-semibold text-white hover:bg-[#06cf9c] disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#aebac1]">
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="font-semibold text-[#53bdeb] hover:underline"
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
