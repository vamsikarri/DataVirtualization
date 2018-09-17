/**
 * Interface to be implemented by objects modeling the session info used
 * by the editor.
 */
export interface SessionInfo {
    editorContents: string;
}

/**
 * Static class that contains helpful utility methods.
 */
export class Utility {

    /**
     * Get an error to be thrown from trying to access the given browser storage.
     * @param storage 
     * @param e 
     */
    public static sessionError(storage, e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === 'QuotaExceededError' ||
            // Firefox
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            storage.length !== 0;
    }

    /**
     * Get the coordinate position of the caret.
     */
    public static getCaretCoords(parent: HTMLElement) {
        var doc = window.document;
        var sel, range, rects, rect;
        var x = 0, y = 0;
        if (window.getSelection) {
            sel = window.getSelection();
            if (sel.rangeCount) {
                range = sel.getRangeAt(0).cloneRange();
                let parentRects = parent.getClientRects();
                if (parentRects.length > 0 && range.getClientRects) {
                    range.collapse(true);
                    rects = range.getClientRects();
                    if (rects.length > 0) {
                        rect = rects[0];
                        let parentRect = parentRects[0];
                        x = rect.left - parentRect.left;
                        y = rect.top - parentRect.top;
                    }
                }
                // Fall back to inserting a temporary element
                if (parentRects.length > 0 && (rects.length == 0 || (x == 0 && y == 0))) {
                    var span = doc.createElement("span");
                    if (span.getClientRects) {
                        // Ensure span has dimensions and position by
                        // adding a zero-width space character
                        span.appendChild(doc.createTextNode("\u200b"));
                        range.insertNode(span);
                        if (span.parentElement.tagName == "BR") {
                            spanParent = span.parentNode;
                            spanParent.removeChild(span);
                            spanParent.parentNode.appendChild(span);
                        }

                        rect = span.getClientRects()[0];
                        let parentRect = parentRects[0];
                        x = rect.left - parentRect.left;
                        y = rect.top - parentRect.top;
                        var spanParent = span.parentNode;
                        spanParent.removeChild(span);

                        // Glue any broken text nodes back together
                        spanParent.normalize();
                    }
                }
            }
        }
        return { x: x, y: y };
    }

    /**
     * Split the given text in a way that will allow it to be rendered correctly.
     * @param text 
     */
    public static splitText(text: string) {
        return text.match(/(([^\n])+\n|\n)|([^\n])+/g);
    }

    /**
     * Get the last character index in the given text before the given pixel limit.
     * @param text 
     * @param limit 
     * @param font
     */
    public static getLastIndexBeforePixel(text: string, limit: number, font: string): number {
        let canvas = document.createElement("canvas");
        let context = canvas.getContext("2d");
        context.font = font;
        let i = 0;
        let xTotal = 0;
        while (i < text.length && xTotal < limit) {
            let charWidth = context.measureText(text.charAt(i)).width;
            if (text.charAt(i) == '\t') {
                // Place xTotal at the next tab alligned interval
                let tabInterval = charWidth * 8;
                let intervals = xTotal / tabInterval;

                // If the current interval is within a certain margin of the next interval, count it as the next
                if (Math.ceil(intervals) - intervals <= 0.08) {
                    intervals = Math.ceil(intervals);
                } else {
                    intervals = Math.floor(intervals);
                }

                xTotal = (intervals + 1) * tabInterval;
            } else {
                xTotal += charWidth;
            }

            if (xTotal < limit) {
                i++;
            }
        }
        $(canvas).remove();
        return i;
    }

    /**
     * Clamp the given value to the given range [min, max].
     * @param value 
     * @param min 
     * @param max 
     */
    public static clamp(value: number, min: number, max: number): number {
        return Math.max(Math.min(value, max), min);
    }

    /**
     * javascripts's % operator, but defined to work correctly with negative values of x.
     * @param x 
     * @param m 
     * @returns x (mod m)
     */
    public static mod(x: number, m: number): number {
        let r = x % m;
        return r < 0 ? r + m : r;
    }

    /**
     * Comparer implementation that compares strings alphabetically.
     * @param s1 
     * @param s2 
     */
    public static alphabeticComparer(s1: string, s2: string): number {
        return s1.localeCompare(s2);
    }

    /**
     * Create a new map using an array of keys and an array of values.
     * Undefined behaviour if there are duplicate keys, or if |keys| != |values|.
     * The value at keys[i] will be mapped to values[i].
     * @param keys 
     * @param values 
     */
    public static setMap<K, T>(keys: Array<K>, values: Array<T>): Map<K, T> {
        let map = new Map<K, T>();
        for (let i = 0; i < keys.length; i++) {
            map.set(keys[i], values[i]);
        }
        return map;
    }

    /**
     * Return a new string that is the escaped equivalent of the given token.
     * @param token 
     */
    public static escape(token: string): string {
        if (token.includes(' ') || token.includes('\t') || token.includes('.')) {
            return '[' + token + ']';
        }
        return token;
    }

    /**
     * Create a mapping of (name, value) pairs obtained from the query string of this url.
     */
    public static mapURIQuery(): Map<string, string> {
        let map = new Map<string, string>();
        let args = window.location.search.substring(1);
        if (args.length == 0) {
            args = window.location.hash.substring(3);
        }
        args.split("&")
            .forEach((item) => {
                let tmp = item.split("=");
                if (!map.has(tmp[0])) {
                    map.set(tmp[0], decodeURIComponent(tmp[1]));
                }
            });

        return map;
    }

    /**
     * From a mapping of database resource types, return a formatted select query targeting the given database directory.
     * If the destination is empty, return an empty string.
     * @param tokenMap 
     */
    public static formatSelectQueryTokens(tokenMap: Map<string, string>): string {
        let order = ['p', 's', 't', 'c'];
        let destination = [];
        order.forEach(key => {
            if (tokenMap.has(key)) {
                let tokens = tokenMap.get(key).split('.');
                tokens.forEach((token) => {
                    destination.push(this.escape(token));
                });
            }
        });

        if (destination.length > 0) {
            return 'SELECT * FROM ' + destination.join('.');
        }
        return '';
    }

    /**
     * From a array of values, get a map that maps values to their frequency in the original array.
     * @param values 
     */
    public static getFrequencyMap<T>(values: T[]): Map<T, number> {
        let frequencies = new Map<T, number>();
        values.forEach(element => {
            if(frequencies.has(element)) {
                frequencies.set(element, frequencies.get(element) + 1);
            } else {
                frequencies.set(element, 1);
            }
        });

        return frequencies;
    }

    /**
     * 
     * @param size 
     */
    public static getEnumeration(size: number): number[] {
        let enumeration = new Array(size);
        for(let i = 0; i < size; i++) {
            enumeration[i] = i;
        }
        return enumeration;
    }
}