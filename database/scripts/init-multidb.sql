-- Script para despliegue multi-DB (microservicios con BD independiente)
-- En desarrollo se usa una sola BD (faceattend_db) con 8 schemas (ver docker-compose.yml)
-- Este script es alternativo para crear 8 BDs físicas si se despliega por servicio
CREATE DATABASE ms_identity_db;
CREATE DATABASE ms_authorization_db;
CREATE DATABASE ms_academic_db;
CREATE DATABASE ms_scheduling_db;
CREATE DATABASE ms_attendance_db;
CREATE DATABASE ms_biometric_db;
CREATE DATABASE ms_configuration_db;
CREATE DATABASE ms_notification_db;
