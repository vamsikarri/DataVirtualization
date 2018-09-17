import { Component, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { DropdownComponent, DropdownPosition } from '../dropdown/dropdown.component';
import { Utility } from '../Utility';
import { Trie, StyleType } from '../Data Structures/Trie';
import { RecordManager, RecordType } from '../Data Structures/RecordManager';
import { Globals } from '../globals';
import { SelectionManager, LineIndexedObject } from '../SelectionManager';
import { SelectionInfo } from '../SelectionInfo';
import { thresholdFreedmanDiaconis } from '../../../node_modules/@types/d3';
import { FederatedqueryComponent } from '../federatedquery/federatedquery.component';

@Component({
    selector: 'app-query-editor',
    templateUrl: './query-editor.component.html',
    styleUrls: ['./query-editor.component.css']
})
export class QueryEditorComponent implements AfterViewInit, LineIndexedObject {
    public static readonly className: string = 'editor';
    public static readonly storageName: string = 'lastQuery';
    private static readonly maxEditorStorageSize: number = 5000;

    public tabId: number;
    public recordManager: RecordManager;
    public selectionManager: SelectionManager;
    public body: HTMLElement;
    public lineNumbers: HTMLElement;
    public className: string = QueryEditorComponent.className;
    public lineCount: number;

    private staticAutocompleteOptions: Trie;
    private dynamicAutocompleteOptions: Trie;

    @ViewChild(DropdownComponent) dropdown: DropdownComponent;

    ngAfterViewInit() {
        this.body = $(this.el.nativeElement).find('.editor').get(0);
        this.lineNumbers = $(this.el.nativeElement).find('.line-numbers').get(0);

        // On scroll, redraw the position of the dropdown box.
        $(this.body).closest(".card-body").on('scroll', () => {
            if (this.dropdown.open) {
                this.dropdown.setDropdownPosition(this.getDropdownPosition());
            }
        });
    }

    public closeDropdown() {
        this.dropdown.closeDropdown();
    }

    constructor(private el: ElementRef) {
        this.staticAutocompleteOptions = new Trie();
        this.dynamicAutocompleteOptions = new Trie();
        this.selectionManager = new SelectionManager(this);
        this.recordManager = new RecordManager(this.selectionManager);
        this.lineCount = 1;

        // Load MYSQL keywords synchronously
        var request = new XMLHttpRequest();
        request.open('GET', 'assets/json/editor/MySQL.json', false);
        request.send(null);
        if (request.readyState == 4 && request.status == 200) {
            let response = JSON.parse(request.responseText);
            response.forEach(option => {
                if (option.type == 'R') {
                    this.staticAutocompleteOptions.AddEntry(option.value, StyleType.Reserved);
                } else {
                    this.staticAutocompleteOptions.AddEntry(option.value, StyleType.Keyword);
                }
            });
        }
    }

    /**
     * Set the sidebar's line numbers to be equal to the given number.
     * @param lines 
     */
    public setLineNumbers(lines: number) {
        if (lines > this.lineCount) {
            // Append line number divs
            for (this.lineCount; this.lineCount < lines;) {
                $(this.lineNumbers).append("<div><span>" + ++this.lineCount + " </span></div>");
            }
        } else if (lines < this.lineCount) {
            // Remove line number divs
            $(this.lineNumbers).children('div').slice(lines - this.lineCount).remove();
            this.lineCount = lines;
        }
    }

    /**
     * Draw the dropdown box using the given input string.
     * @param input The string that will be used as a prefix for all of the dropdown options.
     * @param force By default, the dropdown will not appear if it is empty.  Set force to to true if it should be.
     */
    drawDropdown(input: string, force: boolean = false) {
        // Get the last substring separated by a non-escaped whitespace character.
        let match = input.match(/(\[.*?\]|[^\xA0\s])+$/g);
        let prefix = match == null ? "" : match.slice(-1)[0];

        // If the prefix ends up being an empty string, close the dropdown and do not autocomplete
        // unless the user has explicitly requested a dropdown. 
        if (force || prefix.length > 0) {
            // Get the visual prefix that all options share
            let dropdownPrefix = prefix.length > 0 ? Trie.tokenize(prefix, false).slice(-1)[0] : "";
            if (dropdownPrefix.endsWith('.')) {
                dropdownPrefix = "";
            }

            this.dropdown.setOptions(
                [this.staticAutocompleteOptions.StringsFromPrefix(prefix),
                this.dynamicAutocompleteOptions.stringsFromXMLHTTPRequest(Globals.ROOT_DATABASE_ADDRESS, prefix)],
                dropdownPrefix, force, this.getDropdownPosition());
        } else {
            this.dropdown.closeDropdown();
        }
    }

    /**
     * Fill the remainder of the given option at the caret.
     * @param prefixLen Length of the currently placed prefix of the option
     * @param option The option chosen to be placed
     * @param record Optional boolean value indicating whether or not to record this fill operation for the 
     * purposes of undo/redo operations.  Defaults to true.
     */
    public fill(prefixLen: number, option: string, record: boolean = true) {
        option = Utility.escape(option);
        this.recordManager.endRecord();
        let sel = window.getSelection();
        let caretPos = sel.getRangeAt(0).endOffset;
        let fill = () => {
            let node = sel.baseNode;
            // Remove the visual line break if there is one
            if (node.textContent.length == 0) {
                node = node.parentElement;
                $(node).children().remove();
            }
            node.textContent =
                node.textContent.substring(0, caretPos - prefixLen)
                + option
                + node.textContent.substring(caretPos);
            this.selectionManager.setCaretPosition(node, caretPos + option.length - prefixLen);
        }

        if (record) {
            this.recordManager.createFillRecord(
                fill,
                sel.baseNode.textContent.substring(caretPos - prefixLen, caretPos),
                option
            );
        } else {
            fill();
        }

        this.scrollToCaretX();
    }

    /**
     * Given a line of the editor, set the style if it does not currently have valid
     * line styling.
     * @param line 
     */
    public validateLineStyle(line: HTMLElement): boolean {
        let text = this.styleTokenize(line.textContent);
        if (text == null || this.lineStyleIsValid(line, text)) { return false; }

        let index = $(line).index();
        let newLine = $(document.createElement("div"));

        text.forEach(token => {
            let style = this.staticAutocompleteOptions.getStyle(token);
            let styleClass = "";

            // Get the name of the style class for this token, if it has one
            if (style == StyleType.None) {
                if (this.tokenIsLiteral(token)) {
                    styleClass = "Literal";
                } else if (this.tokenIsComment(token)) {
                    styleClass = "Comment";
                } else if (this.tokenIsUserVariable(token)) {
                    styleClass = "Variable";
                }
            } else {
                styleClass = StyleType[style];
            }

            // If this token has no style, append a text node
            if (styleClass.length == 0) {
                newLine.append(document.createTextNode(token));
                // Otherwise, append a styled span
            } else {
                $("<span>" + token + "</span>").addClass(styleClass).appendTo(newLine);
            }
        });

        $(line).replaceWith(newLine);
        this.nthLine(index).get(0).normalize();
        return true;
    }

    /**
     * Determine if the given line has valid styling.
     * @param line 
     * @param text array of text; the text of the given line, but split on whitespace with escaped tokens separated.
     */
    private lineStyleIsValid(line: HTMLElement, text: string[]): boolean {
        let contents = $(line).contents();
        let j = 0;
        for (let i = 0; i < contents.length; i++) {
            let c = contents[i];
            if (c.localName == "span") {
                if (!c.hasChildNodes) { return false; }
                // Move to checking static SQL rules if the span's contents are not visually separated from the next node,
                // or if its style is no longer correct.
                let spanContents = c.firstChild.textContent;
                if (
                    spanContents != text[j++] ||
                    !$(c).hasClass(StyleType[this.staticAutocompleteOptions.getStyle(spanContents)])
                ) {
                    // If the span is not a static SQL token styled correctly, return false.
                    if (
                        (!this.tokenIsLiteral(spanContents) || !$(c).hasClass("Literal")) &&
                        (!this.tokenIsComment(spanContents) || !$(c).hasClass("Comment")) &&
                        (!this.tokenIsUserVariable(spanContents) || !$(c).hasClass("Variable"))
                    ) {
                        return false;
                    }
                }
            } else { // text node
                let textContents = this.styleTokenize(c.textContent);
                let valid = true;
                // Return false if any of the text nodes are not visually separated from the next node,
                // or if its style is no longer correct.
                textContents.forEach(token => {
                    if (token != text[j++] || this.staticAutocompleteOptions.getStyle(token) != StyleType.None ||
                        this.tokenIsLiteral(token) || this.tokenIsComment(token) || this.tokenIsUserVariable(token)) {

                        valid = false;
                        return;
                    }
                });
                if (!valid) { return false; }
            }
        }

        // Return true iff the loop above made it through each token
        return j == text.length;
    }

    /**
     * Given a token, determine if it's a complete or incomplete string literal.
     * @param token 
     */
    private tokenIsLiteral(token: string): boolean {
        return token.startsWith('\'') || token.startsWith('"');
    }

    /**
     * Given a token, determine if it's a comment.
     * @param token 
     */
    private tokenIsComment(token: string): boolean {
        return token.startsWith('--') || token.startsWith('#');
    }

    /**
     * Given a token, determine if it is a separator; a token consisting of whitespace or other uninteresting symbols.
     * @param token 
     */
    private tokenIsSeparator(token: string): boolean {
        let match = token.match(/[\xA0\s\[\]]|\./g);
        return match != null && match.length == 1;
    }

    /**
     * Given a token, determine if it's a user-defined variable
     */
    public tokenIsUserVariable(token: string) {
        return token.startsWith('${') && token.endsWith('}');
    }

    /**
     * Split on whitespace and escaped tokens, but do not remove whitespace.
     * A token is:
     * A string entirely consisting of whitespace.
     * A quoted string literal.
     * A string wrapped in square brackets.
     * A string that does not fit into any of the above.
     * @param text 
     */
    public styleTokenize(text: string): string[] {
        // An explanation of the regex:
        //(\\\"|[^\"])*\"?|                 : A string literal starting with a double quote.  Will keep going until it sees a 
        //                                    second double quote (except ones escaped with a backslash)
        //'(\\\'|[^\'])*\'?|                : A string literal starting with a single quote quote.  Will keep going until it sees a 
        //                                    second single quote (except ones escaped with a backslash)
        //[.*?\]|                           : A token escaped by being wrapped in double brackets. Unlike string literals, this will 
        //                                    not match unless there is a closing bracket to match the opening one.
        //\${.*?}|                          : A user-defined variable
        //(--|#).*|                         : A comment
        //([^\xA0\s\[\]\(\)\'\"\.#-\$])+|   : A series of non-separators, non-comments
        //\xA0\s\[\]\(\)-]+|                : A series of separators; whitespace characters, and unmatched square brackets, and parenthesis.
        //\.|-|\[|\$                        : A single dot, hyphen, left bracket or dollar sign.
        return text.match(/\"(\\\"|[^\"])*\"?|\'(\\\'|[^\'])*\'?|\[.*?\]|\${.*?}|(--|#).*|([^\xA0\s\[\]\(\)\'\"\.#-\$])+|[\xA0\s\]\(\)]+|\.|-|\[|\$/g);
    }

    /**
     * Select the dropdown option at the given index.  Requires that the dropdown is open.
     * @param index 
     */
    public selectOptionAtIndex(index: number) {
        let selection = this.dropdown.getOptionAtIndex(index);
        this.fill(selection[0] as number, selection[1] as string);
        this.dropdown.closeDropdown();
        return true;
    }

    /**
     * Select the indicated dropdown suggestion, if possible.
     * @returns true if an option was selected, false otherwise.
     */
    public selectIndicatedOption(): boolean {
        let selection = this.dropdown.getIndicatedOption();
        if (selection.length == 0) { return false; }

        this.fill(selection[0] as number, selection[1] as string);
        this.dropdown.closeDropdown();
        return true;
    }

    /**
     * Scroll the dropdown one element in the direction provided.
     * @param direction 
     * The direction to scroll.  Scrolls up if negative, otherwise scrolls down.
     * @returns true if this dropdown scrolled, false otherwise.
     */
    public scrollDropdown(direction: number) {
        this.dropdown.scroll(direction);
    }

    /**
     * Shift the selected region right.
     */
    public shiftSelectionRight() {
        let info = this.selectionManager.getSelectionInfo();

        info.selectedRegion.each(function () {
            let text = $(this).text();
            $(this).text('\t' + text);
        });

        this.selectionManager.setCaretPosition(info.endNode.get(0), info.endOffset + 1);
        this.scrollToCaretX();
        this.selectionManager.setCaretRange(
            info.startNode.get(0), info.startOffset + 1,
            info.endNode.get(0), info.endOffset + 1
        );
    }

    /**
     * Shift the selected region left.
     */
    public shiftSelectionLeft() {
        let info = this.selectionManager.getSelectionInfo();

        let startLen = $(info.selectedRegion[0]).text().length
        let endLen = $(info.selectedRegion[info.selectedRegion.length - 1]).text().length

        info.selectedRegion.each(function () {
            let text = $(this).text();
            $(this).text(text.replace(/^\t/, ''));
        });

        let startOffset = Math.max(0, info.startOffset - (startLen - $(info.selectedRegion[0]).text().length));
        let endOffset = Math.max(0, info.endOffset - (endLen - $(info.selectedRegion[info.selectedRegion.length - 1]).text().length));

        this.selectionManager.setCaretPosition(info.endNode.get(0), endOffset);
        this.scrollToCaretX();
        this.selectionManager.setCaretRange(
            info.startNode.get(0),
            startOffset,
            info.endNode.get(0),
            endOffset
        );
    }

    /**
     * Given a function, cast a highlight range from the caret range before calling the function,
     * and the caret range after calling the function.
     * @param f 
     */
    public highlightResult(f: Function) {
        let sel = window.getSelection();
        let anchor = sel.anchorNode;
        let anchorOffset = sel.anchorOffset;
        f();
        sel = window.getSelection();
        this.selectionManager.setCaretRange(anchor, anchorOffset, sel.focusNode, sel.focusOffset);
    }

    /**
     * Move the caret to the extreme of the next token to the left of the caret.
     */
    public moveCaretLeftToken() {
        let focus = window.getSelection().focusNode;
        let index = this.getLineIndexFromNode(focus);
        let offset = this.selectionManager.getVisualCaretOffset(focus, window.getSelection().focusOffset);
        let line = this.nthLine(index).text();
        let tokens = this.styleTokenize(line);
        if (tokens == null) {
            return;
        }

        let j = 0;
        let i = tokens[0].length;

        for (i; i < offset; j++) {
            i += tokens[j + 1].length;
        }

        i -= tokens[j].length;
        // If currently at a separator, move to the beginning of the previous non-separator,
        // unless there is a separator right before the current token.
        if (this.tokenIsSeparator(tokens[j])) {
            if (j > 0 && !this.tokenIsSeparator(tokens[j - 1])) {
                i -= tokens[j - 1].length;
            }
        }
        // Otherwise, if already at the start of a non-separator, move to the beginning of the previous separator. 
        else if (i == offset) {
            // Move backwards through the previous separator, then to the start of the non-separator.
            // Or as far as possible.
            for (let k = 1; j - k >= 0 && k <= 2; k++) {
                i -= tokens[j - k].length;
            }
        }

        this.selectionManager.setVisualCaretPos(index, i);
        this.ScrollToCaret();
    }

    /**
     * Move the caret to the extreme of the next token to the right of the caret.
     */
    public moveCaretRightToken() {
        let focus = window.getSelection().focusNode;
        let index = this.getLineIndexFromNode(focus);
        let offset = this.selectionManager.getVisualCaretOffset(focus, window.getSelection().focusOffset);
        let line = this.nthLine(index).text();
        let tokens = this.styleTokenize(line);
        if (tokens == null) {
            return;
        }

        let j = 0;
        let i = tokens[0].length;

        for (i; i < offset; j++) {
            i += tokens[j + 1].length;
        }

        // If currently at a separator, move to the beginning of the previous non-separator,
        // unless there is a separator right before the current token.
        if (this.tokenIsSeparator(tokens[j])) {
            if (j < tokens.length - 1) {
                i += tokens[j + 1].length;
            }
        }
        // Otherwise, if already at the end of a non-separator, move to the end of the next separator. 
        else if (i == offset) {
            // Move to the end of the next token.
            if (j + 1 < tokens.length) {
                i += tokens[j + 1].length;

                // Move again if this token is a separator, unless the next token is also a separator
                if (j + 2 < tokens.length && this.tokenIsSeparator(tokens[j + 1]) && !this.tokenIsSeparator(tokens[j + 2])) {
                    i += tokens[j + 2].length;
                }
            }
        }

        this.selectionManager.setVisualCaretPos(index, i);
        this.ScrollToCaret();
    }

    /**
     * Move the caret to the end of the current line.
     * If the Ctrl key is held, move to the end of the editor instead.
     */
    public MoveCaretToEnd(e: KeyboardEvent) {
        if (e.ctrlKey) { // Ctrl
            this.selectionManager.setVisualCaretPos(this.lineCount - 1, 0);
        }

        let index = this.getLineIndexFromNode(
            window.getSelection().focusNode
        );
        this.selectionManager.setVisualCaretPos(index, this.nthLine(index).text().length);
        this.ScrollToCaret();
    }

    /**
     * Move the caret to the end of the leading tabs of the current line.
     * If the caret is already there, then move it to the beginning of the line instead.
     * If the Ctrl key is held, then move it to the start of the editor.
     */
    public MoveCaretToStart(e: KeyboardEvent) {
        if (e.ctrlKey) { // Ctrl
            this.selectionManager.setVisualCaretPos(0, 0);
        } else {
            let focus = window.getSelection().focusNode;
            let index = this.getLineIndexFromNode(focus);

            let currentOffset = this.selectionManager.getVisualCaretOffset(focus, window.getSelection().focusOffset);

            let newOffset = this.nthLine(index).text().match(/^\t*/)[0].length;
            // If already at the new offset, move to the beginning of the line.
            if (newOffset == currentOffset) {
                newOffset = 0;
            }
            this.selectionManager.setVisualCaretPos(index, newOffset);
        }
        this.ScrollToCaret();
    }

    /**
     * Move the caret a line in the given direction.
     * If there are no more lines in the given direction,
     * instead move the caret to the start or end of the current line.
     * @param direction 
     */
    public MoveLine(direction: number) {
        let numChildren = $(this.body).children().length;
        if (numChildren == 0) { return; }

        let sel = window.getSelection();

        let dir = direction < 0 ? -1 : 1;
        let index = this.getLineIndexFromNode(sel.focusNode);
        let newIndex = Utility.clamp(index + dir, 0, numChildren - 1);
        let newLineLength = this.nthLine(newIndex).text().length;
        let caretOffset;
        if (index == newIndex) {
            caretOffset = dir < 0 ? 0 : newLineLength;
        } else {
            caretOffset = Math.min(sel.focusOffset, newLineLength);
        }

        this.selectionManager.setVisualCaretPos(newIndex, caretOffset);
        this.ScrollToCaret();
    }

    /**
     * Replace the currently selected region of the editor with data
     * from an external source. 
     * @param replaceText 
     */
    public replaceSelectedRegionFromExternal(replaceText: string[] | string) {
        let startInfo = this.selectionManager.getSelectionInfo();

        // If there is no selection, place it at the end of the editor instead.
        if (startInfo == null) {
            startInfo = new SelectionInfo(this);
            startInfo.startOffset = startInfo.endOffset = 0;
            startInfo.selectedText = [""];

            // If the last line is empty, put it there.
            if (this.nthLine(this.lineCount - 1).text().length == 0) {
                startInfo.startIndex = startInfo.endIndex = this.lineCount - 1;
                this.selectionManager.setVisualCaretRange(startInfo);
            } else {
                startInfo.startIndex = startInfo.endIndex = this.lineCount;
            }
        }

        // Wrap text in spaces as needed
        if (typeof (replaceText) == "string" && this.hasSelection()) {
            let previousChar = this.selectionManager.getCharAtSelection(-1);
            if (previousChar != '' && previousChar != '\n' && previousChar != ' ' && previousChar != '\t') {
                replaceText = ' ' + replaceText;
            }

            let nextChar = this.selectionManager.getCharAtSelection(0);
            if (nextChar != '' && nextChar != '\n' && nextChar != ' ' && nextChar != '\t') {
                replaceText += ' ';
            }
        }

        this.replaceSelectedRegion(replaceText);
        this.recordManager.setRecord(RecordType.External, startInfo, this.selectionManager.getSelectionInfo());
    }

    /**
     * Replace the currently selected region of the editor with
     * the given data.
     * @param replaceText 
     */
    public replaceSelectedRegion(replaceText: string[] | string) {
        if (typeof (replaceText) === "string") {
            replaceText = [replaceText];
        }

        let info = this.selectionManager.getSelectionInfo();
        var startText, endText, startIndex;
        if (info == null) {
            startText = endText = "";
            this.nthLine
            startIndex = this.lineCount;
            if(this.nthLine(this.lineCount - 1).text().length == 0) {
                startIndex -= 1;
            }
        } else {
            startText = info.startNode.text().substring(0, info.startOffset);
            endText = info.endNode.text().substring(info.endOffset);
            startIndex = info.startIndex;

            info.selectedRegion.remove();
        }

        // Add prefix and suffix to paste data
        replaceText[0] = startText + replaceText[0];
        replaceText[replaceText.length - 1] = replaceText[replaceText.length - 1] + endText;

        // Replace them with line separated paste data
        for (let i = 0; i < replaceText.length; i++) {
            let index = startIndex + i;
            let text = replaceText[i].replace(/(\n|\r)+$/, '');

            // If this line is entirely whitespace, place a break so that it is rendered
            // correctly
            if (text.length == 0) {
                text = "<br>";
            }

            if (index == 0) {
                $(this.body).prepend("<div>" + text + "</div>");
            } else {
                this.nthLine(index - 1).after("<div>" + text + "</div>");
            }
        }

        // Place the cursor at the end of the pasted text
        let lastAdded = this.nthLine(startIndex + replaceText.length - 1).get(0);
        this.selectionManager.setCaretPosition(
            lastAdded,
            lastAdded.textContent.length - endText.length
        )
        this.scrollToCaretX();
    }

    /**
     * Undo the last action taken, if there is one. Do nothing otherwise.
     */
    public undo() {
        let record = this.recordManager.undo();
        if (record == null) { return; }

        switch (record.recordType) {
            case RecordType.Input:
            case RecordType.Paste:
            case RecordType.External:
                // Select the difference between the start and end states
                this.selectionManager.setVisualCaretRange(record.differenceInfo)
                // Replace it with the initial selection
                this.replaceSelectedRegion(
                    record.startInfo.selectedText.slice(0)
                );
                // Set the selection back to its initial state
                this.selectionManager.setVisualCaretRange(record.startInfo);
                break;
            case RecordType.BackwardsDeletion:
                // Select the region at the end of the sequence of deletions
                this.selectionManager.setVisualCaretRange(record.endInfo);
                // Replace it with what was deleted
                this.replaceSelectedRegion(
                    record.startInfo.selectedText.slice(0)
                );
                // Set the selection back to its initial state
                this.selectionManager.setVisualCaretRange(record.startInfo);
                break;
            case RecordType.ForwardDeletion:
                // Place the caret at the start of the sequence of deletions
                this.selectionManager.setVisualCaretPos(
                    record.startInfo.startIndex,
                    record.startInfo.startOffset
                );
                // Place the deleted sequence
                this.replaceSelectedRegion(
                    record.startInfo.selectedText.slice(0)
                );
                // Set the selection back to its initial state
                this.selectionManager.setVisualCaretRange(record.startInfo);
                break;
            case RecordType.Fill:
                // Select the difference between the start and end states
                this.selectionManager.setVisualCaretRange(record.differenceInfo);
                // Replace it with the prefix that was used in the initial fill operation
                this.replaceSelectedRegion(record.prefix);
                // Set the selection back to its initial state
                this.selectionManager.setVisualCaretRange(record.startInfo);
                break;
            case RecordType.TabForward:
                // Select the region that was selected after the operation, then tab it backwards.
                this.selectionManager.setVisualCaretRange(record.endInfo);
                this.shiftSelectionLeft();
                // Set the selection back to its initial state
                this.selectionManager.setVisualCaretRange(record.startInfo);
                break;
            case RecordType.TabBackward:
                // Indent each line that was un-indented during the original operation.
                for (let i = 0; i < record.tabBackIndices.length; i++) {
                    if (record.tabBackIndices[i]) {
                        let line = this.nthLine(record.startInfo.startIndex + i);
                        line.text('\t' + line.text());
                    }
                }
                break;
            case RecordType.Drag:
                // Delete the result of the drag
                this.selectionManager.setVisualCaretRange(record.endInfo);
                this.replaceSelectedRegion("");
                // Place the dragged string back at its start position
                this.selectionManager.setVisualCaretPos(record.startInfo.startIndex, record.startInfo.startOffset);
                this.replaceSelectedRegion(record.startInfo.selectedText.slice(0));
                // Set the selection back to its initial state
                this.selectionManager.setVisualCaretRange(record.startInfo);
                break;
        }
    }

    /**
     * Redo the last action undone, if there is one. Do nothing otherwise.
     */
    public redo() {
        let record = this.recordManager.redo();
        if (record == null) { return; }

        switch (record.recordType) {
            case RecordType.Input:
            case RecordType.Paste:
            case RecordType.External:
                // Set the selection to the range before this operation
                this.selectionManager.setVisualCaretRange(record.startInfo);
                // Replace the selection with the text that was added by this operation
                this.replaceSelectedRegion(
                    record.differenceInfo.selectedText.slice(0)
                )
                // Set the the selection range back to its final state
                this.selectionManager.setVisualCaretRange(record.endInfo);
                break;
            case RecordType.BackwardsDeletion:
            case RecordType.ForwardDeletion:
                // Select the difference between the start and end states and remove it
                this.selectionManager.setVisualCaretRange(record.differenceInfo);
                this.replaceSelectedRegion("");
                break;
            case RecordType.Fill:
                // Set the selection to the range before this operation
                this.selectionManager.setVisualCaretRange(record.startInfo);
                // Redo the fill operation without recording it
                this.fill(record.prefix.length, record.option, false);
                break;
            case RecordType.TabForward:
                // Set the selection to the range before this operation and tab forwards
                this.selectionManager.setVisualCaretRange(record.startInfo);
                this.shiftSelectionRight();
                break;
            case RecordType.TabBackward:
                // Set the selection to the range before this operation and tab backwards
                this.selectionManager.setVisualCaretRange(record.startInfo);
                this.shiftSelectionLeft();
                break;
            case RecordType.Drag:
                // Select the region selected for the drag and clear it
                this.selectionManager.setVisualCaretRange(record.startInfo);
                this.replaceSelectedRegion("");
                // Place the dragged text at its destination
                this.selectionManager.setVisualCaretPos(record.endInfo.startIndex, record.endInfo.startOffset);
                this.replaceSelectedRegion(record.endInfo.selectedText.slice(0));
                // Set the the selection range back to its final state
                this.selectionManager.setVisualCaretRange(record.endInfo);
                break;
        }
    }

    /**
     * Scroll the text field to the cursor's position.
     */
    public ScrollToCaret() {
        this.scrollToCaretX();
        this.scrollToCaretY();
    }

    /**
     * Scroll the text field to the cursor's x position.
     */
    public scrollToCaretX() {
        let x = Utility.getCaretCoords(this.body).x;
        $(".card-body").scrollLeft(
            x - $(this.body).width()
        );
    }

    /**
     * Scroll the text field to the cursor's y position.
     */
    public scrollToCaretY() {
        let x = Utility.getCaretCoords(this.body).y;
        $(".card-body").scrollTop(
            x - $(this.body).height()
        );
    }

    /**
     * Check if the dropdown is currently open.
     */
    public dropdownIsOpen(): boolean {
        return this.dropdown.open;
    }

    /**
     * Reset this editor to its initial state.
     */
    public resetView() {
        this.lineCount = 1;
        this.selectionManager = new SelectionManager(this);
        this.recordManager = new RecordManager(this.selectionManager);
        $(this.body).html('').empty();
        $(this.lineNumbers).html("<div>1</div>");
    }

    /**
     * Get the 0-indexed nth line of the editor.
     * @param index 
     */
    public nthLine(index: number): JQuery<HTMLElement> {
        return $($(this.body).children('div').get(index));
    }

    /**
     * Format the contents of this editor in a way such that as many lines fit in the viewport as possible.
     */
    public format() {
        let contents = $(this.body).contents().clone();
        let width = $(this.body).closest(".card-body").width() - 30;
        for (let i = 0; i < contents.length; i++) {
            let line = $(contents.get(i));
            let lastIndex = Utility.getLastIndexBeforePixel(
                line.text(),
                width,
                $(this.body).css("fontSize") + " " + $(this.body).css("fontFamily")
            );

            if (lastIndex == line.text().length) {
                continue;
            }

            let prefix = line.text().substring(0, lastIndex);
            let splitIndex = Math.max(
                prefix.lastIndexOf(' '),
                prefix.lastIndexOf('\t')
            )

            if (splitIndex > 0) {
                // Store this string on its split
                let prefix = line.text().substring(0, splitIndex).trim();
                let suffix = line.text().substring(splitIndex).trim() + ' ';
                line.contents().remove();
                line.text(prefix);
                var nextLine;
                if (i == contents.length - 1) {
                    contents = contents.add(
                        $(document.createElement("div"))
                    );
                    nextLine = contents.last();
                } else {
                    nextLine = $(contents.get(i + 1));
                }

                let nextLineText = nextLine.text().trim();
                nextLine.contents().remove();
                nextLine.text((suffix + nextLineText).trim());

            }
        }
        $(this.body).contents().remove();
        $(this.body).append(contents as JQuery<HTMLElement>);
        this.recordManager.clear();
        this.selectionManager.setVisualCaretPos(0, 0);
    }

    /**
     * Get the contents of this editor as a space separated string.
     */
    contentsToString(): string {
        let sel = this.nthLine(0).text();
        for (let i = 1; i < this.lineCount; i++) {
            let line = this.nthLine(i).text();
            if (!sel.endsWith('\s') && !line.startsWith('\s')) {
                sel += ' ';
            }
            sel += line;
        }
        return sel;
    }

    /**
     * Given a node inside the editor, return the line index it's on.
     * @param node 
     */
    public getLineIndexFromNode(node: Node): number {
        return $(this.getLineFromNode(node)).index();
    }

    /**
     * Given a node inside the editor, return a reference to the line it's on.
     * @param node 
     */
    public getLineFromNode(node: Node): Node {
        while (!$(node.parentNode).hasClass(QueryEditorComponent.className)) {
            node = node.parentNode;
        }
        return node;
    }

    private getDropdownPosition(): DropdownPosition {
        let pos = Utility.getCaretCoords(this.body);
        return {
            leftBound: -$(this.lineNumbers).width(),
            rightBound: $(this.body).width(),
            topBound: 0,
            bottomBound: $(this.body).height(),
            x: pos.x - $(this.body).closest(".card-body").scrollLeft() - $(this.lineNumbers).width(),
            y: pos.y - $(this.body).closest(".card-body").scrollTop()
        };
    }

    /**
     * Check if there is anything selected by the user in this.
     * Return true if there is, false otherwise.
     */
    public hasSelection(): boolean {
        let sel = window.getSelection();
        let editor = $(this.body).get(0);
        return sel.anchorNode != null && sel.focusNode != null && $.contains(editor, sel.anchorNode as any) || $.contains(editor, sel.focusNode as any);
    }

    public saveToLocalStorage() {
        try {
            var storage = window['sessionStorage'];
            FederatedqueryComponent.saveTabId(this.tabId);
            let lastQuery = "";
            let size = QueryEditorComponent.maxEditorStorageSize;
            let i = 0;
            let contents = $(this.body).contents();
            while (i < contents.length && lastQuery.length < size) {
                let remainingSize = Math.max(0, size - lastQuery.length);
                lastQuery += contents[i++].textContent.substring(0, remainingSize);
                if (size > lastQuery.length && i < contents.length - 1) {
                    lastQuery += '\n';
                }
            }

            storage.setItem(QueryEditorComponent.storageName + this.tabId, lastQuery);
        }
        catch (e) {
            throw Utility.sessionError(storage, e);
        }
    }

    public loadFromLocalStorage() {
        try {
            var storage = window['sessionStorage'];
            let sessionInfo = storage[QueryEditorComponent.storageName + this.tabId];
            if (sessionInfo != undefined) {
                this.replaceSelectedRegion(
                    Utility.splitText(sessionInfo)
                );
            }
        } catch(e) {
            Utility.sessionError(storage, e);
        }
    }
}
