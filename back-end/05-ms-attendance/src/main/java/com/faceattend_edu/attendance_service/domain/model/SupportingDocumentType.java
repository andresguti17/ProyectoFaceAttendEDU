package com.faceattend_edu.attendance_service.domain.model;

import java.util.Optional;

/**
 * Supporting document formats accepted by ERF 6.1 (PDF, JPG, PNG). The type is
 * read from the file's first bytes, never from the name or the Content-Type the
 * client sends, so a renamed executable is rejected.
 */
public enum SupportingDocumentType {
    PDF("application/pdf", "pdf", new int[]{0x25, 0x50, 0x44, 0x46, 0x2D}),
    PNG("image/png", "png", new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}),
    JPEG("image/jpeg", "jpg", new int[]{0xFF, 0xD8, 0xFF});

    private final String mimeType;
    private final String extension;
    private final int[] signature;

    SupportingDocumentType(String mimeType, String extension, int[] signature) {
        this.mimeType = mimeType;
        this.extension = extension;
        this.signature = signature;
    }

    public String mimeType() { return mimeType; }

    public String extension() { return extension; }

    public static Optional<SupportingDocumentType> detect(byte[] content) {
        if (content == null) return Optional.empty();
        for (SupportingDocumentType type : values()) {
            if (content.length < type.signature.length) continue;
            boolean match = true;
            for (int i = 0; i < type.signature.length && match; i++) {
                match = (content[i] & 0xFF) == type.signature[i];
            }
            if (match) return Optional.of(type);
        }
        return Optional.empty();
    }
}
