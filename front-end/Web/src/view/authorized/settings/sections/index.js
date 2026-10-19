// ============================================================
//  Settings Sections — barrel export
//
//  Sub-bloques de UI puros, sin rol, sin estado global.
//  Cada rol los importa y los pasa a sus modals.
// ============================================================

// appearance
export { AccentBlock }            from "./appearance/AccentBlock";

// security
export { TwoFactorRow }           from "./security/TwoFactorRow";
export { SessionTimeInput }       from "./security/SessionTimeInput";

// notifications
export { EmailAlertToggle, WeeklyReportToggle, AtRiskAlertToggle, DailySummaryToggle } from "./notifications/NotificationToggles";
export { PushNotificationToggle, PushNotificationLimit } from "./notifications/PushNotificationConfig";

// general
export { InstitutionInfo }        from "./general/InstitutionInfo";
export { PeriodConfig }           from "./general/PeriodConfig";
export { GeneralSummary }         from "./general/GeneralSummary";
export { LanguageBlock }          from "./general/LanguageBlock";
export { DateFormatBlock }        from "./general/DateFormatBlock";

// facial
export { ConfidenceSlider }       from "./facial/ConfidenceSlider";
export { FaceToggles }            from "./facial/FaceToggles";
export { AttendanceThresholds }   from "./facial/AttendanceThresholds";
