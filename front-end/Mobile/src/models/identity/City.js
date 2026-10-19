import BaseModel from '../BaseModel';

export default class City extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.cityId = data.city_id || null;
    this.name = data.name || '';
    this.department = data.department || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new City(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      city_id: this.cityId,
      name: this.name,
      department: this.department,
    };
  }
}
