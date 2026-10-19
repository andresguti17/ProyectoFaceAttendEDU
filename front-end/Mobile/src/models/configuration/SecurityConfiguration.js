import BaseModel from '../BaseModel';

export default class SecurityConfiguration extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.configurationId = data.configuration_id || null;
    this.configurationName = data.configuration_name || '';
    this.configurationValue = data.configuration_value || '';
    this.description = data.description || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new SecurityConfiguration(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      configuration_id: this.configurationId,
      configuration_name: this.configurationName,
      configuration_value: this.configurationValue,
      description: this.description,
    };
  }
}
