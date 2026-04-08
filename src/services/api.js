// src/services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000',
});

export const setupInterceptors = (handleSessionExpired) => {
    api.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response && error.response.status === 401) {
                handleSessionExpired();
            }
            return Promise.reject(error);
        }
    );
};

export default api;