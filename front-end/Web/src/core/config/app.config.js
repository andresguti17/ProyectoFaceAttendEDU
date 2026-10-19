export const APP_CONFIG = {
  // App Info
  name: "FaceAttend EDU",
  version: "1.0.0",
  description: "Sistema de asistencia facial para instituciones educativas",

  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3000/api",
    timeout: 30000, // 30 seconds
  },

  // Feature Flags
  features: {
    faceRecognition: true,
    darkMode: true,
    i18n: true,
    offlineMode: false,
  },

  // UI Configuration
  ui: {
    animationDuration: 300,
    toastDuration: 3000,
    debounceDelay: 300,
  },

  // Pagination
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },

  // File Upload
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/jpg"],
    allowedDocTypes: ["application/pdf", "text/csv", "application/vnd.ms-excel"],
  },

  // Date/Time
  dateFormat: "DD/MM/YYYY",
  timeFormat: "HH:mm",
  locale: "es-ES",
};

export default APP_CONFIG;
