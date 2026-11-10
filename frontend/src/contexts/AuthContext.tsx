import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export interface IUser {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'FACULTY';
  department: string;
  designation: string;
  lastLogin?: string;
}

interface AuthContextType {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: IUser) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Set axios default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    setLoading(false);
  }, []);

  const login = (jwtToken: string, userDetails: IUser) => {
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userDetails));
    setToken(jwtToken);
    setUser(userDetails);
    axios.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const requestUrl: string = error.config?.url || '';
        const isLoginRequest = requestUrl.includes('/auth/login');
        // A failed login is also a 401 - let the Login page show the error instead of reloading
        if (error.response && error.response.status === 401 && !isLoginRequest) {
          logout();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
