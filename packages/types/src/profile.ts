export interface Profile {
  id: string;
  name: string;
  isKids: boolean;
  isMaster: boolean;
  pinHash: string | null;
  passwordHash: string | null;
  securityType: 'pin' | 'password' | null;
  avatarColor?: string;
  avatar?: string | null;
  accentColor?: string | null;
  preferredSource?: string;
  autoMarkThreshold?: number;
}

export interface ProfileCreateInput {
  name: string;
  isKids: boolean;
  isMaster?: boolean;
  pinHash?: string | null;
  password?: string | null;
  securityType?: 'pin' | 'password' | null;
  avatar?: string | null;
  accentColor?: string | null;
  preferredSource?: string | null;
  autoMarkThreshold?: number | null;
}

export const MAX_STANDARD_PROFILES = 5;

export interface ProfileGuardrailResult {
  allowed: boolean;
  error?: string;
  currentCount: number;
}
