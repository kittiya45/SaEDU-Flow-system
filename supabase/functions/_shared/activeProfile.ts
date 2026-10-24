// Shared by all service-role entry points. UI checks do not authorize API calls.
export function assertActiveProfile(profile: {
  is_active?: boolean; approval_status?: string; expires_at?: string | null;
} | null): void {
  const expiry = profile?.expires_at ? Date.parse(profile.expires_at) : null;
  if (!profile || profile.is_active !== true || profile.approval_status !== 'approved' ||
      (expiry !== null && (!Number.isFinite(expiry) || expiry <= Date.now()))) {
    throw { status: 403, message: 'account inactive, unapproved, or expired' };
  }
}
