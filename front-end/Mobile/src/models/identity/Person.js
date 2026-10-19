import BaseModel from '../BaseModel';

export default class Person extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.personId = data.person_id || null;
    this.documentNumber = data.document_number || '';
    this.name = data.name || '';
    this.lastName = data.last_name || '';
    this.email = data.email || null;
    this.phone = data.phone || null;
    this.status = data.status !== undefined ? data.status : true;
  }

  get fullName() {
    return `${this.name} ${this.lastName}`.trim();
  }

  static fromApi(data) {
    if (!data) return null;
    return new Person(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      person_id: this.personId,
      document_number: this.documentNumber,
      name: this.name,
      last_name: this.lastName,
      email: this.email,
      phone: this.phone,
      status: this.status,
    };
  }
}
