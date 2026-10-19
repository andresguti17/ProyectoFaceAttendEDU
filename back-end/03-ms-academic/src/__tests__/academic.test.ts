/**
 * IEEE 829 — Test Case Specification
 * Service: 03-ms-academic
 * Entity: School
 * Test IDs: TC-03-001 through TC-03-005
 */

import { MemoryStore } from '../infrastructure/persistence/memory.store';

describe('IEEE 829 TC-03: School CRUD Tests', () => {
  let store: MemoryStore<any>;

  beforeEach(() => {
    store = new MemoryStore<any>('schoolId');
  });

  describe('TC-03-001: Create School', () => {
    it('should create school with valid data', () => {
      // Arrange
      const schoolData = {
        code: 'SCH001',
        name: 'Test School',
        cityId: 1,
        status: true,
      };

      // Act
      const created = store.create(schoolData);

      // Assert
      expect(created).toBeDefined();
      expect(created.schoolId).toBeGreaterThan(0);
      expect(created.code).toBe('SCH001');
      expect(created.name).toBe('Test School');
    });

    it('should generate unique ID for each school', () => {
      // Arrange & Act
      const school1 = store.create({ code: 'SCH001', name: 'School 1' });
      const school2 = store.create({ code: 'SCH002', name: 'School 2' });

      // Assert
      expect(school1.schoolId).not.toBe(school2.schoolId);
    });
  });

  describe('TC-03-002: Get School by ID', () => {
    it('should return school when found', () => {
      // Arrange
      const created = store.create({ code: 'SCH001', name: 'Test School' });

      // Act
      const found = store.get(created.schoolId);

      // Assert
      expect(found).toBeDefined();
      expect(found.schoolId).toBe(created.schoolId);
      expect(found.code).toBe('SCH001');
    });

    it('should return null when school not found', () => {
      // Act
      const found = store.get(999);

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('TC-03-003: Update School', () => {
    it('should update school fields', () => {
      // Arrange
      const created = store.create({ code: 'SCH001', name: 'Old Name' });

      // Act
      const updated = store.update(created.schoolId, { name: 'New Name' });

      // Assert
      expect(updated).toBeDefined();
      expect(updated.name).toBe('New Name');
      expect(updated.code).toBe('SCH001');
    });

    it('should return null when updating non-existent school', () => {
      // Act
      const updated = store.update(999, { name: 'New Name' });

      // Assert
      expect(updated).toBeNull();
    });
  });

  describe('TC-03-004: Delete School', () => {
    it('should soft delete school', () => {
      // Arrange
      const created = store.create({ code: 'SCH001', name: 'Test School' });

      // Act
      const deleted = store.remove(created.schoolId);

      // Assert
      expect(deleted).toBe(true);
      expect(store.get(created.schoolId)).toBeNull();
    });

    it('should return false when deleting non-existent school', () => {
      // Act
      const deleted = store.remove(999);

      // Assert
      expect(deleted).toBe(false);
    });
  });

  describe('TC-03-005: List Schools', () => {
    it('should list all schools', () => {
      // Arrange
      store.create({ code: 'SCH001', name: 'School 1' });
      store.create({ code: 'SCH002', name: 'School 2' });

      // Act
      const list = store.list();

      // Assert
      expect(list).toHaveLength(2);
    });

    it('should filter schools by predicate', () => {
      // Arrange
      store.create({ code: 'SCH001', name: 'School 1', status: true });
      store.create({ code: 'SCH002', name: 'School 2', status: false });

      // Act
      const activeSchools = store.list((s: any) => s.status === true);

      // Assert
      expect(activeSchools).toHaveLength(1);
      expect(activeSchools[0].code).toBe('SCH001');
    });
  });
});

describe('IEEE 829 TC-03: Program CRUD Tests', () => {
  let store: MemoryStore<any>;

  beforeEach(() => {
    store = new MemoryStore<any>('programId');
  });

  it('TC-03-006: should create program with valid data', () => {
    // Arrange
    const programData = {
      schoolId: 1,
      code: 'PRG001',
      name: 'Computer Science',
      status: true,
    };

    // Act
    const created = store.create(programData);

    // Assert
    expect(created).toBeDefined();
    expect(created.programId).toBeGreaterThan(0);
    expect(created.code).toBe('PRG001');
  });

  it('TC-03-007: should return program when found', () => {
    // Arrange
    const created = store.create({ code: 'PRG001', name: 'CS' });

    // Act
    const found = store.get(created.programId);

    // Assert
    expect(found).toBeDefined();
    expect(found.code).toBe('PRG001');
  });

  it('TC-03-008: should update program', () => {
    // Arrange
    const created = store.create({ code: 'PRG001', name: 'Old Name' });

    // Act
    const updated = store.update(created.programId, { name: 'New Name' });

    // Assert
    expect(updated.name).toBe('New Name');
  });

  it('TC-03-009: should delete program', () => {
    // Arrange
    const created = store.create({ code: 'PRG001', name: 'CS' });

    // Act
    const deleted = store.remove(created.programId);

    // Assert
    expect(deleted).toBe(true);
  });

  it('TC-03-010: should list all programs', () => {
    // Arrange
    store.create({ code: 'PRG001', name: 'CS' });
    store.create({ code: 'PRG002', name: 'Math' });

    // Act
    const list = store.list();

    // Assert
    expect(list).toHaveLength(2);
  });
});
