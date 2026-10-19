import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, FlatList, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { DESIGN_TOKENS } from "../../../../core/config/theme.config";

/**
 * FileUpload component para subir archivos e imágenes
 * 
 * Implementación nativa usando expo-image-picker y expo-document-picker.
 * Soporta selección de imágenes (cámara/galería) y documentos, con preview,
 * validación de tamaño y múltiples archivos.
 * 
 * @param {Array} value - Array de archivos seleccionados [{ uri, name, size, type }]
 * @param {function} onChange - Callback al cambiar archivos
 * @param {string} label - Etiqueta
 * @param {string} accept - Tipos aceptados: 'image/*', 'application/pdf',
 * @param {boolean} multiple - Permitir múltiples archivos
 * @param {number} maxSize - Tamaño máximo en bytes (default: 5MB)
 * @param {number} maxFiles - Máximo número de archivos
 * @param {boolean} preview - Mostrar preview de imágenes
 * @param {boolean} error - Si hay error
 * @param {string} errorMessage - Mensaje de error
 * @param {boolean} disabled - Si está deshabilitado
 * 
 * @example
 * // FileUpload básico (imagen)
 * const [files, setFiles] = useState([]);
 * <FileUpload
 *   label="Foto de perfil"
 *   accept="image/*"
 *   value={files}
 *   onChange={setFiles}
 * />
 * 
 * @example
 * // Múltiples imágenes con preview
 * <FileUpload
 *   label="Galería de imágenes"
 *   accept="image/*"
 *   multiple
 *   maxFiles={5}
 *   preview
 *   value={images}
 *   onChange={setImages}
 * />
 * 
 * @example
 * // Documentos
 * <FileUpload
 *   label="Subir documento"
 *   accept="application/pdf"
 *   maxSize={10 * 1024 * 1024} // 10MB
 *   value={documents}
 *   onChange={setDocuments}
 * />
 */
export function FileUpload({
  value = [],
  onChange,
  label,
  accept = "*/*",
  multiple = false,
  maxSize = 5 * 1024 * 1024, // 5MB default
  maxFiles = 10,
  preview = true,
  error = false,
  errorMessage,
  disabled = false,
  style,
}) {
  const { theme } = useTheme();

  const handlePress = async () => {
    if (disabled) return;
    
    try {
      if (accept === "image/*" || accept.startsWith("image/")) {
        // Image Picker
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (!permissionResult.granted) {
          Alert.alert(
            "Permiso requerido",
            "Necesitamos permiso para acceder a tus fotos"
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: multiple,
          quality: 0.8,
        });

        if (!result.canceled) {
          const newFiles = result.assets.map((asset) => ({
            uri: asset.uri,
            name: asset.fileName || `image_${Date.now()}.jpg`,
            size: asset.fileSize || 0,
            type: asset.type || "image/jpeg",
          }));

          // Validar tamaño
          const validFiles = newFiles.filter((file) => {
            if (file.size > maxSize) {
              Alert.alert(
                "Archivo muy grande",
                `${file.name} excede el tamaño máximo de ${formatSize(maxSize)}`
              );
              return false;
            }
            return true;
          });

          if (validFiles.length > 0) {
            const updatedFiles = multiple 
              ? [...value, ...validFiles].slice(0, maxFiles)
              : validFiles;
            onChange(updatedFiles);
          }
        }
      } else {
        // Document Picker
        const result = await DocumentPicker.getDocumentAsync({
          type: accept === "*/*" ? "*/*" : accept,
          multiple,
          copyToCacheDirectory: true,
        });

        if (result.type === "success" || !result.canceled) {
          const files = result.canceled ? [] : (Array.isArray(result) ? result : [result]);
          
          const newFiles = files.map((file) => ({
            uri: file.uri,
            name: file.name,
            size: file.size || 0,
            type: file.mimeType || "application/octet-stream",
          }));

          // Validar tamaño
          const validFiles = newFiles.filter((file) => {
            if (file.size > maxSize) {
              Alert.alert(
                "Archivo muy grande",
                `${file.name} excede el tamaño máximo de ${formatSize(maxSize)}`
              );
              return false;
            }
            return true;
          });

          if (validFiles.length > 0) {
            const updatedFiles = multiple 
              ? [...value, ...validFiles].slice(0, maxFiles)
              : validFiles;
            onChange(updatedFiles);
          }
        }
      }
    } catch (error) {
      console.error("Error selecting file:", error);
      Alert.alert("Error", "No se pudo seleccionar el archivo");
    }
  };

  const handleRemove = (index) => {
    const newFiles = value.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (file) => {
    return file.type?.startsWith("image/") || file.uri?.match(/\.(jpg|jpeg|png|gif)$/i);
  };

  const canAddMore = !multiple ? value.length === 0 : value.length < maxFiles;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: error ? theme.colors.status.error : theme.colors.text.secondary },
          ]}
        >
          {label}
        </Text>
      )}

      {/* Upload button */}
      {canAddMore && (
        <TouchableOpacity
          onPress={handlePress}
          disabled={disabled}
          style={[
            styles.uploadButton,
            {
              borderColor: error
                ? theme.colors.status.error
                : theme.colors.border.primary,
              backgroundColor: disabled
                ? theme.colors.background.hover
                : theme.colors.background.surface,
            },
          ]}
        >
          <Feather
            name="upload-cloud"
            size={32}
            color={theme.colors.text.secondary}
          />
          <Text
            style={[
              styles.uploadText,
              { color: theme.colors.text.primary },
            ]}
          >
            {value.length === 0 ? "Seleccionar archivo" : "Agregar otro archivo"}
          </Text>
          <Text
            style={[
              styles.uploadHint,
              { color: theme.colors.text.tertiary },
            ]}
          >
            {accept === "image/*" ? "Imágenes" : "Archivos"} hasta {formatSize(maxSize)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Files list */}
      {value.length > 0 && (
        <View style={styles.filesList}>
          {value.map((file, index) => (
            <View
              key={index}
              style={[
                styles.fileItem,
                {
                  backgroundColor: theme.colors.background.surface,
                  borderColor: theme.colors.border.primary,
                },
              ]}
            >
              {/* Preview or icon */}
              {preview && isImage(file) ? (
                <Image source={{ uri: file.uri }} style={styles.preview} />
              ) : (
                <View
                  style={[
                    styles.fileIcon,
                    { backgroundColor: theme.colors.background.hover },
                  ]}
                >
                  <Feather
                    name="file"
                    size={24}
                    color={theme.colors.text.secondary}
                  />
                </View>
              )}

              {/* File info */}
              <View style={styles.fileInfo}>
                <Text
                  style={[
                    styles.fileName,
                    { color: theme.colors.text.primary },
                  ]}
                  numberOfLines={1}
                >
                  {file.name}
                </Text>
                <Text
                  style={[
                    styles.fileSize,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {formatSize(file.size)}
                </Text>
              </View>

              {/* Remove button */}
              <TouchableOpacity
                onPress={() => handleRemove(index)}
                style={styles.removeButton}
              >
                <Feather name="x" size={18} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {error && errorMessage && (
        <Text style={[styles.message, { color: theme.colors.status.error }]}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: DESIGN_TOKENS.borderRadius.lg,
    padding: DESIGN_TOKENS.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: DESIGN_TOKENS.spacing.sm,
  },
  uploadHint: {
    fontSize: 12,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  filesList: {
    marginTop: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.borderRadius.md,
    borderWidth: 1,
  },
  preview: {
    width: 48,
    height: 48,
    borderRadius: DESIGN_TOKENS.borderRadius.sm,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: DESIGN_TOKENS.borderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    flex: 1,
    marginLeft: DESIGN_TOKENS.spacing.sm,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: DESIGN_TOKENS.spacing.xs,
  },
  message: {
    fontSize: 12,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
});

export default FileUpload;
