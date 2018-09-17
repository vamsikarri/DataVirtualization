import { LinkedListNode, LinkedList } from "./LinkedList";

/**
 * A list indexed by order of usage.
 * The closer an element is to the front, the more recently it was used.
 * When this list reaches capacity, it will evict the least recently used value.
 */
export class LRUList<T> {
    private capacity: number;
    private cache: LinkedList<T>;
    private cacheMap: Map<T, LinkedListNode<T>>;
    public backupComparator: (a: T, b: T) => number;

    /**
     * Create a new instance of an LRUList
     * @param capacity The maximum capacity for this before it starts evicting old values.
     */
    constructor(capacity: number) {
        this.capacity = capacity;
        this.cache = new LinkedList<T>();
        this.cacheMap = new Map<T, LinkedListNode<T>>();
        this.backupComparator = null;
    }

    /**
     * Add the given value to this.  If the given value is already present in this,
     * move it to have first priority.  Otherwise, add it to the front of this while
     * evicting the value with lowest priority if at capacity.
     * @param value 
     */
    put(value: T): void {
        if(this.cacheMap.has(value)) {
            this.cacheMap.delete(value);
            this.cache.addToFront(value);
            this.cacheMap.set(value, this.cache.first());
        } else {
            if(this.cache.length == this.capacity) {
                this.cacheMap.delete(this.cache.last().value);
                this.cache.remove(this.cache.last());
            }
            this.cache.addToFront(value);
            this.cacheMap.set(value, this.cache.first());
        }
    }

    /**
     * Get the index of the given value.
     * @param value 
     */
    indexOf(value: T): number {
        if(!this.cacheMap.has(value)) {
            return -1;
        }
        return this.cache.indexOf(
            this.cacheMap.get(value)
        )
    }

    /**
     * Sort an array of T using the index of this as priority.
     * @param values 
     */
    public sort(values: T[]) {
        values.sort((a, b) => {
            return this.compare(a, b)
        });
    }

    /**
     * Compare a and b, and return a value following the standard comparator contract.
     * @param a 
     * @param b 
     */
    public compare(a: T, b: T): number {
        let pa = this.indexOf(a);
        let pb = this.indexOf(b);

        if(pa >= 0 && pb >= 0) {
            return pa - pb;
        }
        if(pa >= 0) {
            return -1;
        }
        if(pb >= 0) {
            return 1;
        }

        if(this.backupComparator != null) {
            return this.backupComparator(a, b);
        }
        return 0;
    }
}