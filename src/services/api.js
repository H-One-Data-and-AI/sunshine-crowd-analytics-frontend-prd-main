// src/services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://sunshineca-be-sea-cve5agcaawg6etd8.southeastasia-01.azurewebsites.net',
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
