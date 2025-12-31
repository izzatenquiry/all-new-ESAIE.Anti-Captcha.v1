/**
 * Centralized configuration for Proxy Servers.
 * Edit this list to add or remove servers for the entire application.
 */

/**
 * Get localhost server URL with appropriate protocol
 * Uses HTTP for backend server (port 3001) as it's a separate service
 */
export const getLocalhostServerUrl = (): string => {
    // Backend server runs on HTTP, so always use http://localhost:3001
    return 'http://localhost:3001';
};

export const PROXY_SERVER_URLS = [
    'https://s1.esaie.tech',
    'https://s2.esaie.tech',
    'https://s3.esaie.tech',
    'https://s4.esaie.tech',
    'https://s5.esaie.tech'
];

/**
 * Helper to generate structured server objects for UI components (Dashboards, etc).
 * Returns array of { id, name, url }
 */
export const UI_SERVER_LIST = PROXY_SERVER_URLS.map((url, index) => {
    const id = `s${index + 1}`;
    let name = `Server S${index + 1}`;

    // Label S1, S2, S3, S4, and S6 for iOS users
    if (['s1', 's2'].includes(id)) {
        name += ' (iOS)';
    }
    
    // Label S12 for Admin/Special users (VIP)
    if (id === 's5') {
        name += ' (VIP)';
    }

    return {
        id,
        name,
        url
    };
});