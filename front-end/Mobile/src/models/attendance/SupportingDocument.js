import BaseModel from '../BaseModel';

export default class SupportingDocument extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.supportingDocumentId = data.supporting_document_id || null;
    this.justificationId = data.justification_id || null;
    this.fileName = data.file_name || '';
    this.storageUri = data.storage_uri || '';
    this.mimeType = data.mime_type || '';
    this.sizeBytes = data.size_bytes || 0;
  }

  get sizeFormatted() {
    if (this.sizeBytes < 1024) return `${this.sizeBytes} B`;
    if (this.sizeBytes < 1024 * 1024) return `${(this.sizeBytes / 1024).toFixed(1)} KB`;
    return `${(this.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  static fromApi(data) {
    if (!data) return null;
    return new SupportingDocument(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      supporting_document_id: this.supportingDocumentId,
      justification_id: this.justificationId,
      file_name: this.fileName,
      storage_uri: this.storageUri,
      mime_type: this.mimeType,
      size_bytes: this.sizeBytes,
    };
  }
}
