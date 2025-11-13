import axios from 'axios';
import { API_BASE_PATH } from '../config/apiConfig';

// Criar instância do axios
const api = axios.create({
  baseURL: API_BASE_PATH,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido
      clearStoredToken();
      // Redirecionar para login
      // navigation.navigate('Login');
    }
    return Promise.reject(error);
  }
);

// Funções para gerenciar token
const getStoredToken = (): string | null => {
  try {
    // Implementar AsyncStorage ou SecureStore
    return null; // Placeholder
  } catch (error) {
    return null;
  }
};

const clearStoredToken = (): void => {
  try {
    // Implementar limpeza do token
  } catch (error) {
    console.error('Erro ao limpar token:', error);
  }
};

// Serviços da API

// Auth
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (userData: any) =>
    api.post('/auth/register', userData),
  
  googleAuth: (idToken: string) =>
    api.post('/auth/oauth/google', { idToken }),
  
  refreshToken: (token: string) =>
    api.post('/auth/refresh', { token }),
};

// Users
export const userService = {
  getProfile: () =>
    api.get('/users/profile'),
  
  updateProfile: (userData: any) =>
    api.put('/users/profile', userData),
  
  getMembership: () =>
    api.get('/users/membership'),
};

// Animals
export const animalService = {
  getAll: (filters?: any) =>
    api.get('/animals', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/animals/${id}`),
  
  createAdoption: (animalId: string, data: any) =>
    api.post(`/animals/${animalId}/adopt`, data),
};

// Partners
export const partnerService = {
  getAll: (filters?: any) =>
    api.get('/partners', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/partners/${id}`),
  
  validateDiscount: (partnerId: string, memberId: string, discountId?: string) =>
    api.post(`/partners/${partnerId}/validate`, { memberId, discountId }),
  
  getCategories: () =>
    api.get('/partners/meta/categories'),
};

// Events
export const eventService = {
  getAll: (filters?: any) =>
    api.get('/events', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/events/${id}`),
  
  register: (eventId: string, data: any) =>
    api.post(`/events/${eventId}/register`, data),
};

// Donations
export const donationService = {
  create: (donationData: any) =>
    api.post('/donations', donationData),
  
  getAll: (filters?: any) =>
    api.get('/donations', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/donations/${id}`),
};

// Volunteers
export const volunteerService = {
  getAll: () =>
    api.get('/volunteers'),
  
  register: (data: any) =>
    api.post('/volunteers/register', data),
};

// Notifications
export const notificationService = {
  getAll: () =>
    api.get('/notifications'),
  
  markAsRead: (id: string) =>
    api.put(`/notifications/${id}/read`),
  
  registerDeviceToken: (token: string, platform: string) =>
    api.post('/notifications/device-token', { token, platform }),
};

// Transparency
export const transparencyService = {
  getReports: (year?: number) =>
    api.get('/transparency/reports', { params: { year } }),
  
  getStats: () =>
    api.get('/transparency/stats'),
};

export default api;
