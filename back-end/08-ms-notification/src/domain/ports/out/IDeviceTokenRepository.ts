/**
 * Persistence port for the mobile devices' Expo push tokens — 08-ms-notification.
 */
export const DEVICE_PLATFORMS = ['ios', 'android'] as const;
export const DEVICE_LOCALES = ['es', 'en', 'pt', 'fr'] as const;

export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];
export type DeviceLocale = (typeof DEVICE_LOCALES)[number];

export interface ActiveDeviceToken {
  token: string;
  locale: string;
}

export interface IDeviceTokenRepository {
  /** Inserts the token, or re-activates it for `academicActorId` with the new platform/locale. Returns its id. */
  upsert(academicActorId: number, token: string, platform: DevicePlatform, locale: DeviceLocale): Promise<number>;

  /** Revokes the token only when it belongs to one of `academicActorIds`. Resolves whether a row changed. */
  revokeOwned(token: string, academicActorIds: number[]): Promise<boolean>;

  /** Tokens that are not revoked, for one actor. */
  findActiveByActor(academicActorId: number): Promise<ActiveDeviceToken[]>;

  /** Revokes tokens whatever their owner (Expo answered DeviceNotRegistered). */
  revokeTokens(tokens: string[]): Promise<void>;
}
