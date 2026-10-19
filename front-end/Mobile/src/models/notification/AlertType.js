import BaseModel from '../BaseModel';

export default class AlertType extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.alertTypeId = data.alert_type_id || null;
    this.code = data.code || '';
    this.name = data.name || '';
  }

  static fromApi(data) {
    if (!data) return null;
    return new AlertType(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      alert_type_id: this.alertTypeId,
      code: this.code,
      name: this.name,
    };
  }
}
