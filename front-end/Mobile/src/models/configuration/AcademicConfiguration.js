import BaseModel from '../BaseModel';

export default class AcademicConfiguration extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.configurationId = data.configuration_id || null;
    this.schoolId = data.school_id || null;
    this.configurationName = data.configuration_name || '';
    this.configurationValue = data.configuration_value || '';
    this.description = data.description || null;
  }

  get numericValue() {
    const num = Number(this.configurationValue);
    return isNaN(num) ? this.configurationValue : num;
  }

  static fromApi(data) {
    if (!data) return null;
    return new AcademicConfiguration(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      configuration_id: this.configurationId,
      school_id: this.schoolId,
      configuration_name: this.configurationName,
      configuration_value: this.configurationValue,
      description: this.description,
    };
  }
}
