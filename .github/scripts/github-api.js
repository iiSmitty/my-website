/**
 * A small GitHub REST client for Alfred's scripts (late-night.js,
 * quiet-week.js). Reads use the workflow's GITHUB_TOKEN; anything Alfred says
 * is posted with BUTLER_TOKEN, a classic token from the waynemanor-butler
 * account with only the public_repo scope, so it comes from him.
 */

const API = 'https://api.github.com';
const BUTLER = 'waynemanor-butler';

async function github(path, token, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'waynemanor-butler-scripts',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${options.method || 'GET'} ${path}: HTTP ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
}

module.exports = { github, BUTLER };
