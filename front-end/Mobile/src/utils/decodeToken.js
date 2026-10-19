import {jwtDecode} from "jwt-decode";

export function decodeToken(token) {
    const defaultUser = { roles: [] };

    if (!token) return defaultUser;

    try {
        const decoded = jwtDecode(token);
        return {
            roles: decoded.roles || [],
            email: decoded.sub || "",
            userId: decoded.userId,
        };
    } catch (e) {
        console.warn("Error decodificando token", e);
        return defaultUser;
    }
}