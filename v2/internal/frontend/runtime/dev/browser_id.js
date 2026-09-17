const storageKey = 'wails_browser_id';
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getBrowserID(browserWindow = window) {
    try {
        const storage = browserWindow.localStorage;
        const stored = storage.getItem(storageKey);
        if (stored && uuidV4.test(stored)) {
            return stored.toLowerCase();
        }

        const bytes = new Uint8Array(16);
        browserWindow.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        storage.setItem(storageKey, id);
        return id;
    } catch (_) {
        return '';
    }
}
