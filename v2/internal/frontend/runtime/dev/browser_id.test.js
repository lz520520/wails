import {describe, expect, it} from 'vitest';
import {getBrowserID} from './browser_id';

function browserWindow(initialValue = null) {
    let stored = initialValue;
    let randomCalls = 0;
    return {
        localStorage: {
            getItem(key) {
                expect(key).toBe('wails_browser_id');
                return stored;
            },
            setItem(key, value) {
                expect(key).toBe('wails_browser_id');
                stored = value;
            },
        },
        crypto: {
            getRandomValues(bytes) {
                randomCalls++;
                bytes.fill(0x12);
                return bytes;
            },
        },
        get randomCalls() {
            return randomCalls;
        },
        get stored() {
            return stored;
        },
    };
}

describe('getBrowserID', () => {
    it('stores a UUID v4 once and reuses it across connections', () => {
        const browser = browserWindow();
        const id = getBrowserID(browser);
        expect(id).toBe('12121212-1212-4212-9212-121212121212');
        expect(browser.stored).toBe(id);
        expect(getBrowserID(browser)).toBe(id);
        expect(browser.randomCalls).toBe(1);
    });

    it('replaces an invalid stored value', () => {
        const browser = browserWindow('invalid');
        expect(getBrowserID(browser)).toBe('12121212-1212-4212-9212-121212121212');
        expect(browser.randomCalls).toBe(1);
    });

    it('omits the identifier when browser storage is unavailable', () => {
        expect(getBrowserID({localStorage: {getItem() { throw new Error('blocked'); }}})).toBe('');
    });
});
