export const USER_LANGUAGES = ['en', 'id', 'ja', 'ko', 'zh'] as const;

export type UserLanguage = (typeof USER_LANGUAGES)[number];
