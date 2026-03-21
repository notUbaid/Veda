/**
 * Returns all email addresses to notify for a given UserProfile:
 * primary email + all alternateEmails.
 */
import { UserProfile } from '../types';

export function getRecipientEmails(profile: UserProfile): string[] {
  const emails = [profile.email, ...(profile.alternateEmails ?? [])];
  return [...new Set(emails.filter(e => e && e.includes('@')))];
}
