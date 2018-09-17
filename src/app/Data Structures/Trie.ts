import { Observable, Observer } from "rxjs";

export enum StyleType {
    None,
    Keyword,
    Reserved,
}

export class TrieNode {
    symbol: string;
    children: Map<string, TrieNode>;
    leaf: boolean;
    subTrie: Trie;
    hasSubTrie: boolean;
    style: StyleType;

    constructor(symbol: string) {
        this.symbol = symbol;
        this.children = new Map<string, TrieNode>();
        this.leaf = false;
        this.hasSubTrie = false;
        this.subTrie = null;
    }

    /**
     * Add a TrieNode with the given symbol to this.children.
     * Idempotent operation.
     * @param symbol 
     * @returns The added TrieNode.
     */
    AddChild(symbol: string): TrieNode {
        if (!this.children.has(symbol)) {
            this.children.set(symbol, new TrieNode(symbol));
        }
        return this.children.get(symbol);
    }

    /**
     * Add a subtrie to this node and return it.
     */
    AddSubTrie(): Trie {
        this.subTrie = new Trie();
        this.hasSubTrie = true;
        return this.subTrie;
    }

    /**
     * Check if this node has a child with the given symbol.
     * @param symbol 
     */
    HasChild(symbol: string): boolean {
        return this.children.has(symbol);
    }

    /**
     * Check if this node has a child with the given symbol, but case-insensitive.
     * @param symbol 
     */
    hasChildCaseInsensitive(symbol: string): boolean {
        return this.children.has(symbol.toUpperCase()) ||
            this.children.has(symbol.toLowerCase());
    }

    /**
     * Get the child of this that has a symbol that matches the given symbol.
     * @param symbol 
     */
    GetChild(symbol: string): TrieNode {
        return this.children.get(symbol);
    }

    /**
     * Get the child of this that has a symbol that matches the given symbol, but case-insensitive.
     * Will prioritize getting the child with the same case if possible.
     * @param symbol 
     */
    getChildCaseInsensitive(symbol: string): TrieNode {
        if(this.children.has(symbol)) {
            return this.children.get(symbol);
        }
        if(this.children.has(symbol.toLowerCase())) {
            return this.children.get(symbol.toLowerCase());
        }
        return this.children.get(symbol.toUpperCase());
    }
}

export class Trie {
    static collectionTitlePropertyNames: string[] =
        [
            "dbschemanm",
            "dbname",
            "db",
            "table_name"
        ];

    static collectionSubCollectionPropertyNames: string[] =
        [
            "dbinfo",
            "dbschemas",
            "table",
            "tables",
            "columns"
        ];

    private root: TrieNode;
    private cached: boolean;
    private defaultTtl: number = 30 * 1000;
    private timer;

    constructor() {
        this.root = new TrieNode(null);
        this.timer = null;
        this.cached = false;
    }

    /**
     * Remove all children from this.
     */
    clear() {
        this.root = new TrieNode(null);
        clearTimeout(this.timer);
        this.cached = false;
    }

    /**
     * Add the given entry to this.
     * Idempotent operation.
     * @param entry 
     */
    public AddEntry(entry: string, style = StyleType.None): void {
        if (entry.length == 0) { return; }
        this.AddEntryHelper(entry, this.root, false, style);
    }

    private AddEntryHelper(entry: string, node: TrieNode, addTrie: boolean, style = StyleType.None): Trie {
        if (entry.length == 0) {
            node.leaf = true;
            if (addTrie) {
                if (node.hasSubTrie) {
                    return node.subTrie;
                } else {
                    return node.AddSubTrie();
                }
            }
            node.style = style;
            return;
        }

        let child = node.AddChild(entry.charAt(0));
        return this.AddEntryHelper(entry.substring(1), child, addTrie, style);
    }

    /**
     * Add an entry to this, with a trie attached to its leaf.
     * Idempotent operation.
     * @param entry 
     */
    public AddTrieTerminatedEntry(entry: string): Trie {
        if (entry.length == 0) { return; }
        return this.AddEntryHelper(entry, this.root, true);
    }

    /**
     * Get the subTrie that is at the given entry.
     * Returns null if it does not exist.
     * @param entry 
     */
    public getTrieTermiatedEntry(entry: string): Trie {
        return this.getTrieTerminatedEntryHelper(entry, this.root);
    }

    public getTrieTerminatedEntryHelper(entry: string, node: TrieNode): Trie {
        if (entry.length == 0) {
            return node.subTrie;
        }

        if (node.HasChild(entry.charAt(0))) {
            return this.getTrieTerminatedEntryHelper(entry.substring(1), node.GetChild(entry.charAt(0)))
        }
        return null;
    }

    /**
     * Removes the given entry from this.
     * Requires that entry is in this.
     * @param entry 
     */
    public RemoveEntry(entry: string): void {
        this.RemoveEntryHelper(entry, this.root);
    }

    private RemoveEntryHelper(entry: string, node: TrieNode): boolean {
        if (entry.length == 0) {
            node.leaf = false;
            return node.children.size == 0;
        }

        if (this.RemoveEntryHelper(entry.substring(1), node.children.get(entry.charAt(0)))) {
            node.children.delete(entry.charAt(0));
            return !node.leaf && node.children.size == 0;
        }
        return false;
    }

    /**
     * Get an array of all strings in this with the given prefix.
     * @param prefix 
     */
    public StringsFromPrefix(prefix: string): Observable<string> {
        return Observable.create(function (observer: Observer<string>) {
            this.StringsFromPrefixHelper("", prefix, this.root, observer);
            observer.complete();
        }.bind(this)
        );
    }

    private StringsFromPrefixHelper(leftPrefix: string, rightPrefix: string, node: TrieNode, observer: Observer<string>) {
        if (node.leaf) {
            if (rightPrefix.length == 0) {
                observer.next(leftPrefix);
            }
        }

        node.children.forEach((child: TrieNode, symbol: string) => {
            if (rightPrefix.length == 0) {
                this.StringsFromPrefixHelper(leftPrefix + symbol, rightPrefix, child, observer);
            } else if (rightPrefix.charAt(0).toUpperCase() == symbol.toUpperCase()) {
                this.StringsFromPrefixHelper(leftPrefix + symbol, rightPrefix.substring(1), child, observer);
            }
        });
    }

    /**
     * Get the JSON at the given address and load it into this, while using the values
     * currently stored in this as a cache.
     * @param URL Full URL containing the JSON, without the path argument
     * @param pathArgument The path argument that route at the URL needs.
     * @returns An Observable<string> that emits strings from the given URL.
     */
    public stringsFromXMLHTTPRequest(URL: string, pathArgument: string): Observable<string> {
        var urlPath, path;
        // Tokenize everything up to and including the first non-escaped dot (if it exists).
        let tokens = Trie.tokenize(pathArgument);
        if (tokens == null) {
            path = urlPath = "";
        } else {
            path = tokens.join('');
            // Get the urlPath; that will be used to send a request to the server.
            urlPath = tokens.map(token => { return token.endsWith('.') ? token.slice(0, -1) + '/' : token }).join('');
            if (urlPath.endsWith('/')) {
                urlPath = urlPath.slice(0, -1);
            } else {
                urlPath = urlPath.split('/').slice(0, -1).join('/');
            }
        }

        // If there is already data matching this request, and it's still fresh, return that instead.
        if (this.isCached(tokens)) {
            return this.getFromCache(tokens);
        }

        // If there's nothing cached, create and send a new request.
        let t: Trie = this;
        let promise: Promise<Trie> = new Promise(function (resolve, reject) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = (function (t) {
                return function () {
                    if (this.readyState == 4) {
                        if (this.status == 200) {

                            // Get the trie that will be updated, creating it if needed.
                            let editTrie = t;
                            if (tokens != null) {
                                tokens.forEach(token => {
                                    if (token.endsWith('.')) {
                                        editTrie = editTrie.AddTrieTerminatedEntry(token.slice(0, -1));
                                    }
                                });
                            }
                            // Make sure it's empty
                            editTrie.clear();

                            let response = JSON.parse(request.responseText);
                            response.children.forEach(child => {
                                editTrie.AddEntry(child.name);
                            });
                            resolve(t);
                        } else {
                            reject(t);
                        }
                    }
                }
            })(t);

            request.open('GET', URL + urlPath);
            request.send();
        });

        return Observable.create(
            observer => {
                promise.then(
                    (trie) => {
                        trie.addToCache(tokens);
                        trie.getFromCache(tokens).subscribe(observer);
                    },
                    (trie) => {
                        // If the connection couldn't be made, there still might be cached (but stale) values to show.
                        if (trie.pathExists(tokens)) {
                            trie.getFromCache(tokens).subscribe(observer);
                        } else {
                            observer.complete();
                        }
                    }
                );
            }
        );
    }

    /**
     * Add the given path to the cache of this, where each string in the given array
     * indicates a new subTrie.
     * @param path 
     */
    private addToCache(path: string[]) {
        if (path == null || path.length == 0 || (path.length == 1 && !path[0].endsWith('.'))) {
            clearTimeout(this.timer);
            this.cached = true;
            this.timer = setTimeout(() => { this.cached = false; }, this.defaultTtl);
        } else {
            let directory = path[0].slice(0, -1);
            let t = this.getTrieTermiatedEntry(directory);
            t.addToCache(path.slice(1));
        }
    }

    private isCached(path: string[]) {
        return this.pathExists(path, true);
    }

    /**
     * Get an observable that emits strings by querying the trie with the given path.
     * @param path 
     */
    private getFromCache(path: string[]): Observable<string> {
        // Descend to the correct trie
        let t: Trie = this;
        if (path != null) {
            path.forEach(token => {
                if (token.endsWith('.')) {
                    t = t.getTrieTermiatedEntry(token.slice(0, -1));
                }
            });
        }

        // Get the prefix; the string after the last dot
        var prefix;
        if (path == null || path.slice(-1)[0].endsWith('.')) {
            prefix = "";
        } else {
            prefix = path.slice(-1)[0];
        }

        return t.StringsFromPrefix(prefix);
    }

    /**
     * Check if the given path exists in this, where each string in the given array
     * indicates a new subTrie.
     * @param path 
     * @param checkCache optional flag signalling to check if the leaf of the given path is cached,
     * rather than just if it exists.  Defaults to false.
     */
    private pathExists(path: string[], checkCache: boolean = false): boolean {
        if (path == null || path.length == 0 || (path.length == 1 && !path[0].endsWith('.'))) {
            return !checkCache || this.cached;
        }
        let directory = path[0].slice(0, -1);
        let t = this.getTrieTermiatedEntry(directory);
        return t != null && t.pathExists(path.slice(1));
    }

    /**
     * Check if the given entry is stored in this.
     * Does not check subTries.
     * @param entry 
     * @returns true if the value is in this, false otherwise.
     */
    public hasEntry(entry: string): boolean {
        return this.hasEntryHelper(entry, this.root);
    }

    public hasEntryHelper(entry: string, node: TrieNode): boolean {
        if (entry.length == 0) {
            return node.leaf;
        }

        if (node.HasChild(entry.charAt(0))) {
            return this.hasEntryHelper(entry.substring(1), node.GetChild(entry.charAt(0)))
        }
        return false;
    }

    /**
     * Get the style type of the given entry.
     * Returns StyleType.None if entry is not in this.
     * @param entry 
     */
    public getStyle(entry: string): StyleType {
        return this.getStyleHelper(entry, this.root);
    }

    private getStyleHelper(entry: string, node: TrieNode): StyleType {
        if (entry.length == 0) {
            if (node.leaf) {
                return node.style;
            }
            return StyleType.None;
        }

        if (node.hasChildCaseInsensitive(entry.charAt(0))) {
            return this.getStyleHelper(entry.substring(1), node.getChildCaseInsensitive(entry.charAt(0)))
        }
        return StyleType.None;
    }

    /**
     * Recursively add the values from a json-defined collection, using
     * property names defined in Trie.collectionTitlePropertyNames and 
     * Trie.collectionSubCollectionPropertyNames.
     * @param collection 
     */
    public AddCollectionRecursive(collection: Array<any>) {
        if (collection.length == 0) { return; }

        let properties = Object.getOwnPropertyNames(collection[0]);

        let nameProperty = "";
        properties.forEach(prop => {
            let i = Trie.collectionTitlePropertyNames.indexOf(prop);
            if (i >= 0) {
                nameProperty = Trie.collectionTitlePropertyNames[i];
                return;
            }
        });

        let collectionProperty = "";
        properties.forEach(prop => {
            let i = Trie.collectionSubCollectionPropertyNames.indexOf(prop);
            if (i >= 0) {
                collectionProperty = Trie.collectionSubCollectionPropertyNames[i];
                return;
            }
        });

        collection.forEach(element => {
            if (nameProperty == "" || collectionProperty == "") {
                this.AddEntry(element.substring(0, element.indexOf("(")));
            } else {
                let t = this.AddTrieTerminatedEntry(Object.getOwnPropertyDescriptor(element, nameProperty).value);
                t.AddCollectionRecursive(Object.getOwnPropertyDescriptor(element, collectionProperty).value)
            }
        });
    }

    public static tokenize(str: string, unescape: boolean = true): string[] {
        if (str.length == 0 || str.startsWith('.')) {
            return null;
        }

        let tokens = str.match(/((\[.*?\])|[^\.]+)\.?/g);
        if (!unescape) {
            return tokens;
        }
        // Unescape each token
        for (let i = 0; i < tokens.length; i++) {
            tokens[i] = Trie.unescape(tokens[i]);
        }
        return tokens;
    }

    /**
     * Given a string reference, remove its escape characters.
     * @param str 
     */
    public static unescape(str: string) {
        if (str.charAt(0) == '[') {
            let escapedPrefix = str.slice(1);
            if (str.charAt(str.length - 1) == ']') {
                escapedPrefix = escapedPrefix.slice(0, -1);
                str = escapedPrefix;
            } else if (str.charAt(str.length - 1) == '.' && str.charAt(str.length - 2) == ']') {
                escapedPrefix = escapedPrefix.slice(0, -2) + '.';
                str = escapedPrefix;
            }
        }
        return str;
    }
}