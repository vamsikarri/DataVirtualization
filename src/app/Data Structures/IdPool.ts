var Heap = require('heap');

/**
 * Class that maintains a pool of numerical values.
 */
export class IdPool {
    /**
     * max is always one higher than the highest value lent out by this.
     */
    private max: number;
    private pool: Heap<number>;

    constructor() {
        this.max = 0;
        this.pool = new Heap();
    }

    /**
     * Get a new id.
     */
    public get(): number {
        if (this.pool.empty()) {
            return this.max++;
        } else {
            return this.pool.pop();
        }
    }

    /**
     * Forcefully take the given value from the pool of this.
     * @param value 
     */
    public take(value: number) {
        if(this.max <= value) {
            for(this.max; this.max <= value; this.max++) {
                this.pool.push(this.max);
            }
        }

        let i = (this.pool as any).nodes.indexOf(value);
        if(i >= 0) {
            (this.pool as any).nodes.splice(i, 1);
            this.pool.heapify();
        }
    }

    /**
     * Return a value to the pool of this.
     * Requires that the given id is not in this.
     * @param value 
     */
    public return(value: number) {
        if (value >= this.max) {
            throw new RangeError(`Attempted to return out of bounds id: "${value}"`);
        }

        if (this.max == value + 1) {
            this.max--;
        } else {
            this.pool.push(value);
        }
    }

    /**
     * Return an array of all ids currently lent out by this, in ascending order.
     * Not very performant.
     */
    public getMissingValues(): number[] {
        let missing = [];
        let poolArr = this.pool.toArray();
        for(let i = 0; i < this.max; i++) {
            if(!poolArr.includes(i)) {
                missing.push(i);
            }
        }
        return missing;
    }
}