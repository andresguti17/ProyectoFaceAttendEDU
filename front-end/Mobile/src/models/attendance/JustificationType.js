import BaseModel from '../BaseModel';

export default class JustificationType extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.justificationTypeId = data.justification_type_id || null;
    this.name = data.name || '';
    this.description = data.description || null;
    this.requiresAttachment = data.requires_attachment !== undefined ? data.requires_attachment : false;
    this.status = data.status !== undefined ? data.status : true;
  }

  static fromApi(data) {
    if (!data) return null;
    return new JustificationType(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      justification_type_id: this.justificationTypeId,
      name: this.name,
      description: this.description,
      requires_attachment: this.requiresAttachment,
      status: this.status,
    };
  }
}
