// The agency's link to its /check/agent listings, kept for this browser tab
// so an agent can always get back to them (AgentPortal.tsx, and the "Back to
// all your listings" button on an agency's property pages).

const TOKEN_KEY = 'havlo_agent_portfolio_token';

export const readAgencyToken = (): string | null => {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const storeAgencyToken = (token: string) => {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode etc.: the URL still carries the token.
  }
};
