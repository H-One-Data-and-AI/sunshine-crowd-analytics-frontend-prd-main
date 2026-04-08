// src/authConfig.js
import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: "421ca281-856d-4df9-8235-7a5f448d032b", // Client ID
    authority: "https://login.microsoftonline.com/f14fd681-5189-41b3-8261-c88a0387a0e0", // Tenant ID
    redirectUri: window.location.origin, // e.g., http://localhost:5173
  },
  cache: {
    cacheLocation: "sessionStorage", 
    storeAuthStateInCookie: false,
  },
};

// Initialize the instance
export const msalInstance = new PublicClientApplication(msalConfig);