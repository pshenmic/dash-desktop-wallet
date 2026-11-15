import {ZodError} from 'zod'

// A ZodError crossing IPC arrives as its class name only.
export function zodErrorMessage(channel: string, error: ZodError): string {
  return `${channel}: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
}