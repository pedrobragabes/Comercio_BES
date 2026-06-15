// ===========================================
// Helper - Cookies de Auth
// ===========================================
const crypto = require('crypto');

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// TTLs
const ACCESS_TOKEN_MS = 15 * 60 * 1000;          // 15 min
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/**
 * Gera um token CSRF opaco (32 bytes hex).
 */
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Gera um refresh token opaco (48 bytes hex).
 */
function generateRefreshToken() {
    return crypto.randomBytes(48).toString('hex');
}

/**
 * Define os três cookies de auth na resposta.
 * @param {import('express').Response} res
 * @param {string} accessToken  - JWT curto (15min)
 * @param {string} refreshToken - Token opaco (7d)
 * @param {string} csrfToken    - Token CSRF (não-httpOnly)
 */
function setAuthCookies(res, accessToken, refreshToken, csrfToken) {
    const base = { sameSite: 'Lax', secure: IS_PROD };
    if (COOKIE_DOMAIN) base.domain = COOKIE_DOMAIN;

    res.cookie('access_token', accessToken, {
        ...base,
        httpOnly: true,
        maxAge: ACCESS_TOKEN_MS,
        path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
        ...base,
        httpOnly: true,
        sameSite: 'Strict',
        maxAge: REFRESH_TOKEN_MS,
        path: '/api/auth/refresh',
    });

    setCsrfCookie(res, csrfToken);
}

/**
 * Define (ou renova) apenas o cookie CSRF.
 * Usado em endpoints como /me e /csrf que emitem novo token sem tocar access/refresh.
 * @param {import('express').Response} res
 * @param {string} csrfToken
 */
function setCsrfCookie(res, csrfToken) {
    const opts = {
        sameSite: 'Lax',
        secure: IS_PROD,
        httpOnly: false,
        maxAge: ACCESS_TOKEN_MS,
        path: '/',
    };
    if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
    res.cookie('csrf_token', csrfToken, opts);
}

/**
 * Limpa todos os cookies de auth.
 * @param {import('express').Response} res
 */
function clearAuthCookies(res) {
    const domainOpt = COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {};
    res.clearCookie('access_token', { path: '/', ...domainOpt });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh', ...domainOpt });
    res.clearCookie('csrf_token', { path: '/', ...domainOpt });
}

module.exports = {
    generateCsrfToken,
    generateRefreshToken,
    setAuthCookies,
    setCsrfCookie,
    clearAuthCookies,
    ACCESS_TOKEN_MS,
    REFRESH_TOKEN_MS,
};
