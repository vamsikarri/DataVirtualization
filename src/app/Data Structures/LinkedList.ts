export class LinkedListNode<T> {
    value: T;
    next: LinkedListNode<T>;
    prev: LinkedListNode<T>;
}

export class LinkedList<T> {
    private beforeFirst: LinkedListNode<T>;
    private afterLast: LinkedListNode<T>;
    public length: number;

    constructor() { 
        this.beforeFirst = {
            value: null,
            next: null,
            prev: null
        }

        this.afterLast = {
            value: null,
            next: null,
            prev: null
        }

        this.beforeFirst.next = this.afterLast;
        this.afterLast.prev = this.beforeFirst;
        this.length = 0;
    }

    /**
     * Get the first node of this.
     */
    public first(): LinkedListNode<T> {
        return this.beforeFirst.next;
    }

    /**
     * Get the last node of this.
     */
    public last(): LinkedListNode<T> {
        return this.afterLast.prev;
    }

    /**
     * Add the given value to the front of this.
     * @param value 
     */
    public addToFront(value: T) {
        let newNode = {
            value: value,
            next: this.beforeFirst.next,
            prev: this.beforeFirst
        }

        this.beforeFirst.next.prev = newNode;
        this.beforeFirst.next = newNode;
        this.length++;
    }

    /**
     * Add the given value to the end of this.
     * @param value 
     */
    public addToEnd(value: T) {
        let newNode = {
            value: value,
            next: this.afterLast,
            prev: this.afterLast.prev
        }

        this.afterLast.prev.next = newNode;
        this.afterLast.prev = newNode;
        this.length++;
    }

    /**
     * Remove the given node from this.
     * Undefined behaviour if the given node is not in this.
     * @param node 
     */
    public remove(node: LinkedListNode<T>) {
        node.prev.next = node.next;
        node.next.prev = node.prev;

        // Set next and prev to null so that nothing happens if remove is called twice.
        node.prev = node.next = null;
        this.length--;
    }

    /**
     * Get the index of the given node or node with the given value in this.
     * Returns -1 if it is not in this.
     * @param node 
     */
    public indexOf(value: T): number;
    public indexOf(node: LinkedListNode<T>): number;
    public indexOf(v: LinkedListNode<T> | T): number {
        if(typeof(v) != "number") {
            v = (v as LinkedListNode<T>).value;
        }

        let searchNode = this.beforeFirst.next;
        for(let i = 0; i < this.length; i++) {
            if(searchNode == null) {
                return -1;
            }
            if(searchNode.value == v) {
                return i;
            }
            searchNode = searchNode.next;
        }
        return -1;
    }
}