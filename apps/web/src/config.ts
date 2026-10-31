/**
 * Build-time configuration from CDK outputs (the deploy workflow passes them as VITE_*
 * variables). Nothing here is secret: pool and client ids are public by design.
 */
export const config = {
  region: import.meta.env.VITE_AWS_REGION ?? 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  /** The co-leads' app client, whose refresh token lasts a year (docs/phases/04-group.md). */
  groupClientId: import.meta.env.VITE_COGNITO_GROUP_CLIENT_ID ?? '',
  /** Same origin through CloudFront; set only for local development against a deployed API. */
  apiBase: import.meta.env.VITE_API_BASE ?? '',
};
