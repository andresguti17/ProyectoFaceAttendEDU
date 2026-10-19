import BaseModel from '../BaseModel';

export default class School extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.schoolId = data.school_id || null;
    this.code = data.code || '';
    this.name = data.name || '';
    this.cityId = data.city_id || null;
    this.address = data.address || null;
    this.phone = data.phone || null;
    this.email = data.email || null;
    this.status = data.status !== undefined ? data.status : true;
  }

  static fromApi(data) {
    if (!data) return null;
    return new School(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      school_id: this.schoolId,
      code: this.code,
      name: this.name,
      city_id: this.cityId,
      address: this.address,
      phone: this.phone,
      email: this.email,
      status: this.status,
    };
  }
}
