import { Utility } from "./Utility";
import { SelectionInfo } from "./SelectionInfo";

/**
 * An interface describing an object that can be selected by a client's cursor, that also supports some form of indexing.
 */
export interface LineIndexedObject {
    nthLine: (i: number) => JQuery<HTMLElement>
    getLineFromNode: (node: Node) => Node,
    getLineIndexFromNode: (node: Node) => number,
    hasSelection: () => boolean,
    body: HTMLElement,
    className: string,
    lineCount: number
}

/**
 * A pair (node, offset), where  offset is the distance from the start of the line to the beginning of node.
 */
export interface OffsetNodePair {
    node: HTMLElement,
    offset: number
}

/**
 * Helper class for classes that implement the LineIndexedObject interface.  Allows for the usage of a large suite of selection
 * utilities.
 */
export class SelectionManager {
    source: LineIndexedObject;

    constructor(source: LineIndexedObject) {
        this.source = source;
    }

    /**
     * Construct and return a new SelectionInfo object from the current selection in el.
     */
    public getSelectionInfo(): SelectionInfo {
        // Get the index of the anchor and focus nodes

        let sel = window.getSelection();
        let anchor = sel.anchorNode as any;
        let focus = sel.focusNode as any;

        if (!this.source.hasSelection()) { return null; }

        let startIndex = this.source.getLineIndexFromNode(anchor);
        let endIndex = this.source.getLineIndexFromNode(focus);

        // Check which of the anchor and focus nodes comes before the other
        let startOffset = this.getVisualCaretOffset(anchor, sel.anchorOffset);
        let endOffset = this.getVisualCaretOffset(focus, sel.focusOffset);

        // Swap offsets and indices if focus comes before anchor
        if (
            endIndex < startIndex ||
            (startIndex == endIndex && endOffset < startOffset)
        ) {
            let temp = startOffset;
            startOffset = endOffset;
            endOffset = temp;

            temp = startIndex;
            startIndex = endIndex;
            endIndex = temp;
        }

        // Get the selected region
        let region = $(this.source.body).children("div").slice(startIndex, endIndex + 1);

        let info = new SelectionInfo(this.source);
        info.startNode = $(this.source.nthLine(startIndex)),
            info.startOffset = startOffset,
            info.startIndex = startIndex,
            info.endNode = $(this.source.nthLine(endIndex)),
            info.endOffset = endOffset,
            info.endIndex = endIndex,
            info.selectedRegion = region

        // Get the text selected.
        info.selectedText = this.getTextInRegion(
            info.startIndex, info.startOffset,
            info.endIndex, info.endOffset
        );

        return info;
    }

    /**
     * Get a new instance of SelectionInfo describing a caret at the given coordinate position.
     * If it is not possible for a caret to be at the given position, the closest SelectioInfo possible
     * will be given instead.
     * @param x 
     * @param y 
     */
    public getFromCoordinates(x: number, y: number): SelectionInfo {
        let info = new SelectionInfo(this.source);

        let lineHeight = $(this.source.body).children().first().height();
        let lineNumber = Utility.clamp(Math.floor(y / lineHeight), 0, this.source.lineCount - 1);

        info.startIndex = info.endIndex = lineNumber;
        info.startOffset = info.endOffset = Utility.getLastIndexBeforePixel(
            this.source.nthLine(lineNumber).text(), x,
            $(this.source.body).css("fontSize") + " " + $(this.source.body).css("fontFamily")
        );
        info.selectedText = [""];

        return info;
    }

    /**
     * Get the true offset of the caret in the editor.
     * @param node The node containing the caret
     * @param internalOffset The reported offset from window.getSelection()
     */
    getVisualCaretOffset(node, internalOffset): number {
        if(node.localName == "div") {
            return internalOffset;
        }
        let previousNodes = [];
        let atLine = node.parentNode.localName == "div";

        // Move up the DOM until we reach the line containing the the given node, pushing previous siblings all the while.
        do {
            let curIndex = $(node.parentNode).contents().index(node);
            $(node.parentNode).contents().filter((i) => { return i < curIndex; }).each(
                (index, element) => {
                    previousNodes.push(element);
                }
            )
            node = node.parentNode;
            atLine = atLine || node.localName == "div";
        } while(!atLine);

        // For each node found, add its length to the internalOffset.
        let trueOffset = internalOffset;
        previousNodes.forEach(n => {
            trueOffset += n.textContent.length;
        });

        return trueOffset;
    }

    /**
     * Select the region within the source of this defined by the given SelectionInfo.
     * @param info
     */
    public setVisualCaretRange(info: SelectionInfo) {
        var start, end;
        if (info == null) {
            start = end = this.getCaretPlacementFromVisual(0, 0);
        } else {
            start = this.getCaretPlacementFromVisual(info.startIndex, info.startOffset);
            end = this.getCaretPlacementFromVisual(info.endIndex, info.endOffset);
        }

        this.setCaretRange(start.node, start.offset, end.node, end.offset);
    }

    /**
     * Given a line number and a position, get the node containing the
     * the text at the position and its relative offset.
     * @param lineNumber 
     * @param pos 
     * @return an object implementing the OffsetNodePair interface.
     */
    private getCaretPlacementFromVisual(lineNumber, pos): OffsetNodePair {
        let line = this.source.nthLine(lineNumber);
        let contents = line.contents();
        let trueNode: any = line, runningPos = 0;
        for (let i = 0; i < contents.length; i++) {
            let c = contents[i];
            if (c.localName == "br") {
                continue;
            }

            runningPos += c.textContent.length
            if (runningPos >= pos) {
                trueNode = $(c);
                break;
            }
        }

        return { node: trueNode.get(0), offset: trueNode.text().length + pos - runningPos }
    }

    /**
     * Set the caret's position to the visual caret position on the given line.
     * @param index 
     * @param caretOffset 
     */
    public setVisualCaretPos(index: number, caretOffset: number) {
        let pair = this.getCaretPlacementFromVisual(index, caretOffset);
        this.setCaretPosition(pair.node, pair.offset);
    }

    /**
     * Place the caret at the given position within the given node.
     * @param node The node to place the caret in.
     * @param pos 0-based offset to put the caret at. Must be between 0 and length inclusive.
     */
    public setCaretPosition(node, pos) {
        this.setCaretRange(node, pos, node, pos);
    }

    /**
     * Select the region starting from the startNode's startPos and ending at the
     * endNode's endPos.
     * @param startNode Node to place the anchor in
     * @param startPos Character position to place the anchor at
     * @param endNode Node to place the focus in
     * @param endPos Character position to place the focus at
     */
    public setCaretRange(startNode: Node, startPos: number, endNode: Node, endPos: number) {
        startNode = this.DescendToTextNode(startNode);
        endNode = this.DescendToTextNode(endNode);
        window.getSelection().setBaseAndExtent(startNode, startPos, endNode, endPos);
    }

    /**
     * Descend to the text node from the given node, or the leaf child if there is none.
     * @param node 
     */
    DescendToTextNode(node: Node) {
        while (node.nodeType != 3 && node.childNodes.length > 0) {
            node = node.firstChild;
        }
        return node;
    }

    /**
     * If start a before b, get the region spanning (a.start, b.end).
     * Otherwise, get the region spanning (b.start, a.start).
     * @param a
     * @param b
     */
    public difference(a: SelectionInfo, b: SelectionInfo): SelectionInfo {
        let info = new SelectionInfo(a.el);

        info.startIndex = a.startIndex
        info.startOffset = a.startOffset;
        info.endIndex = b.endIndex;
        info.endOffset = b.endOffset;

        // Swap offsets and indices if b comes before a
        if (
            b.startIndex < a.startIndex ||
            (b.startIndex == a.startIndex && b.startOffset < a.startOffset)
        ) {
            info.startIndex = b.startIndex;
            info.startOffset = b.startOffset;
            info.endIndex = a.startIndex;
            info.endOffset = a.startOffset;
        }

        info.selectedText = this.getTextInRegion(info.startIndex, info.startOffset, info.endIndex, info.endOffset);
        return info;
    }

    /**
     * Get the text in the selected region.
     * @param startIndex 
     * @param startOffset 
     * @param endIndex 
     * @param endOffset 
     */
    public getTextInRegion(startIndex: number, startOffset: number, endIndex: number, endOffset: number): string[] {
        if (startIndex == endIndex && startOffset == endOffset) {
            return [""];
        }

        let lines = endIndex - startIndex + 1;
        let text = new Array<string>(lines);
        for (let i = 0; i < lines; i++) {
            text[i] = this.source.nthLine(startIndex + i).text();
        }

        text[text.length - 1] = text[text.length - 1].substring(0, endOffset);
        text[0] = text[0].substring(startOffset);
        return text;
    }

    /**
     * Get the character at the caret, offset by the direction given.
     * If the character is out of bounds, returns the empty string.
     * @param direction The direction to get the character at from the caret.
     * 0 indicates to get at the caret's current position, otherwise
     * will get the character one space in the this direction.
     */
    public getCharAtSelection(direction: number) {
        direction = Math.sign(direction);

        let info = this.getSelectionInfo();
        var index, offset;
        if (direction < 0) {
            index = this.source.getLineIndexFromNode(info.startNode.get(0));
            offset = info.startOffset;
        } else {
            index = this.source.getLineIndexFromNode(info.endNode.get(0));
            offset = info.endOffset;
        }


        let maxIndex = this.source.lineCount;
        let line = this.source.nthLine(index);
        let text = line.text();
        let newOffset = offset + direction;

        // Newlines are not obtainable from parsing the line,
        // so return one if there should be one.

        // Offset is off the right side of the line, and this is not the last line
        if (newOffset >= text.length && index < maxIndex) {
            return '\n'
        }
        // Offset is off the left side of the line, and this is not the first line
        if (newOffset < 0 && index > 0) {
            return '\n';
        }

        return text.charAt(newOffset);
    }

    /**
     * If a range is selected, clear it and set the caret at the old focus.
     */
    public clearSelection() {
        let sel = window.getSelection();
        let index = this.source.getLineIndexFromNode(sel.focusNode);
        let offset = this.getVisualCaretOffset(sel.focusNode, sel.focusOffset);
        this.setVisualCaretPos(index, offset);
    }
}