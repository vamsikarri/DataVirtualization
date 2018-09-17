import { LineIndexedObject } from "./SelectionManager";

/**
 * An object describing all of the relevant information of a selection of a LineIndexedObject.
 */
export class SelectionInfo {
    el: LineIndexedObject;
    startNode: JQuery<HTMLElement>;
    startOffset: number;
    startIndex: number;
    endNode: JQuery<HTMLElement>;
    endOffset: number;
    endIndex: number;
    selectedRegion: JQuery<HTMLElement>;
    selectedText: string[];


    constructor(el: LineIndexedObject) {
        this.el = el;
    }

    /**
     * Convert the selected text of this to a single space separated string.
     */
    public selectionToString(): string {
        let sel = this.selectedText[0];
        for (let i = 1; i < this.selectedText.length; i++) {
            if (!sel.endsWith('\s') && !this.selectedText[i].startsWith('\s')) {
                sel += ' ';
            }
            sel += this.selectedText[i];
        }
        return sel;
    }

    /**
     * Helper method to determine if this selection is empty.
     */
    public selectionIsEmpty(): boolean {
        return this.startIndex == this.endIndex && this.startOffset == this.endOffset;
    }

}