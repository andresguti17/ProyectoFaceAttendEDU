// Base URL fija para que las pruebas no dependan del host/IP de la máquina (src/config/env.js).
process.env.EXPO_PUBLIC_API_URL = 'http://gateway.test:8000';

// Almacenamiento nativo no disponible en Jest: mock oficial en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
