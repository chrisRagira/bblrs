import { createContext, useContext, useReducer, useEffect } from "react";

const AuthContext = createContext(null);
const storedUser = localStorage.getItem("user");
const initialState = {
  user:            JSON.parse(localStorage.getItem("user") || "null"),
  token:           localStorage.getItem("token") || null,
  role:            localStorage.getItem("role") || null,
  isAuthenticated: !!localStorage.getItem("token"),
};

function authReducer(state, action) {
  switch (action.type) {
    case "LOGIN": {
      const { token, role, user } = action.payload;
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("user", JSON.stringify(user));
      return { token, role, user, isAuthenticated: true };
    }
    case "LOGOUT": {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      return { user: null, token: null, role: null, isAuthenticated: false };
    }
    case "UPDATE_USER": {
      const updated = { ...state.user, ...action.payload };
      localStorage.setItem("user", JSON.stringify(updated));
      return { ...state, user: updated };
    }
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login  = (payload) => dispatch({ type: "LOGIN",       payload });
  const logout = ()        => dispatch({ type: "LOGOUT" });
  const updateUser = (payload) => dispatch({ type: "UPDATE_USER", payload });

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
