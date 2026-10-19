export default class BaseModel {
  constructor(data = {}) {
    this.createdAt = data.created_at || null;
    this.updatedAt = data.updated_at || null;
    this.deletedAt = data.deleted_at || null;
    this.createdBy = data.created_by || null;
    this.updatedBy = data.updated_by || null;
    this.deletedBy = data.deleted_by || null;
    this.rowVersion = data.row_version || 1;
  }

  isDeleted() {
    return this.deletedAt !== null;
  }

  toApi() {
    return {
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted_at: this.deletedAt,
      created_by: this.createdBy,
      updated_by: this.updatedBy,
      deleted_by: this.deletedBy,
      row_version: this.rowVersion,
    };
  }
}
