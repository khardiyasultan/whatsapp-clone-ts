
import { useEffect, useState } from "react";
import App from "../App";
import AuthPage from "./AuthPage";
import { connectSocket, disconnectSocket } from "../utils/socket";
import {
  fetchCurrentUser,
  refreshSession,
  setAccessToken,
  logoutRequest,
  type AuthUser,
} from "../utils/api";

export default function AuthGate() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      disconnectSocket();
      setAccessToken(null);
      setUser(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        await refreshSession();
        const currentUser = await fetchCurrentUser();

        if (!cancelled) {
          connectSocket();
          setUser(currentUser);
        }
      } catch {
        setAccessToken(null);

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0b141a] text-[#e9edef]">
        Checking session...
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={setUser} />;
  }

  return (
    <>
      <App user={user} />

      <button
        onClick={handleLogout}
        className="fixed right-4 top-4 z-50 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Logout
      </button>
    </>
  );
}
