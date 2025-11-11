import axios from 'axios';

// Configuração base da API
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : 'https://nova-versao-liga-do-bem-api.onrender.com';

// Criar instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
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
    api.post('/api/auth/login', { email, password }),
  
  register: (userData: any) =>
    api.post('/api/auth/register', userData),
  
  googleAuth: (idToken: string) =>
    api.post('/api/auth/oauth/google', { idToken }),
  
  refreshToken: (token: string) =>
    api.post('/api/auth/refresh', { token }),
};

// Users
export const userService = {
  getProfile: () =>
    api.get('/api/users/profile'),
  
  updateProfile: (userData: any) =>
    api.put('/api/users/profile', userData),
  
  getMembership: () =>
    api.get('/api/users/membership'),
};

// Animals
export const animalService = {
  getAll: (filters?: any) =>
    api.get('/api/animals', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/api/animals/${id}`),
  
  createAdoption: (animalId: string, data: any) =>
    api.post(`/api/animals/${animalId}/adopt`, data),
};

// Partners
export const partnerService = {
  getAll: (filters?: any) =>
    api.get('/api/partners', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/api/partners/${id}`),
  
  validateDiscount: (partnerId: string, memberId: string, discountId?: string) =>
    api.post(`/api/partners/${partnerId}/validate`, { memberId, discountId }),
  
  getCategories: () =>
    api.get('/api/partners/meta/categories'),
};

// Events
export const eventService = {
  getAll: (filters?: any) =>
    api.get('/api/events', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/api/events/${id}`),
  
  register: (eventId: string, data: any) =>
    api.post(`/api/events/${eventId}/register`, data),
};

// Donations
export const donationService = {
  create: (donationData: any) =>
    api.post('/api/donations', donationData),
  
  getAll: (filters?: any) =>
    api.get('/api/donations', { params: filters }),
  
  getById: (id: string) =>
    api.get(`/api/donations/${id}`),
};

// Volunteers
export const volunteerService = {
  getAll: () =>
    api.get('/api/volunteers'),
  
  register: (data: any) =>
    api.post('/api/volunteers/register', data),
};

// Notifications
export const notificationService = {
  getAll: () =>
    api.get('/api/notifications'),
  
  markAsRead: (id: string) =>
    api.put(`/api/notifications/${id}/read`),
  
  registerDeviceToken: (token: string, platform: string) =>
    api.post('/api/notifications/device-token', { token, platform }),
};

// Transparency
export const transparencyService = {
  getReports: (year?: number) =>
    api.get('/api/transparency/reports', { params: { year } }),
  
  getStats: () =>
    api.get('/api/transparency/stats'),
};

export default api;
