export interface School {
  schoolId: number;
  code: string;
  name: string;
  /**
   * `academic.school.city_id` is VARCHAR(100) NULL in PostgreSQL while the API
   * contract exposes it as a number; the adapter writes text and reads a number.
   */
  cityId: number | null;
  /**
   * Plain-text city name from the external countriesnow catalog (the same one
   * the mobile app uses). The web/mobile forms pick it from a dropdown and
   * send the name; `city_name` existed in the relational model but was never
   * exposed through the API before.
   */
  cityName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
