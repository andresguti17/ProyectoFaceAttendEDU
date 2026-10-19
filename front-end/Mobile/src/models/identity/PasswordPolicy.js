import BaseModel from '../BaseModel';

export default class PasswordPolicy extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.policyId = data.policy_id || null;
    this.minLength = data.min_length || 8;
    this.maxLength = data.max_length || 20;
    this.requiresUppercase = data.requires_uppercase !== undefined ? data.requires_uppercase : true;
    this.requiresNumbers = data.requires_numbers !== undefined ? data.requires_numbers : true;
    this.requiresSymbols = data.requires_symbols !== undefined ? data.requires_symbols : true;
    this.expirationDays = data.expiration_days || 90;
  }

  static fromApi(data) {
    if (!data) return null;
    return new PasswordPolicy(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      policy_id: this.policyId,
      min_length: this.minLength,
      max_length: this.maxLength,
      requires_uppercase: this.requiresUppercase,
      requires_numbers: this.requiresNumbers,
      requires_symbols: this.requiresSymbols,
      expiration_days: this.expirationDays,
    };
  }
}
