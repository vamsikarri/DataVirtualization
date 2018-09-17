import { Directive, HostListener, AfterViewInit } from '@angular/core';
import { Utility } from './Utility';
import { QueryEditorComponent } from './query-editor/query-editor.component';
import { RecordManager, RecordType } from './Data Structures/RecordManager';
import { SelectionManager } from './SelectionManager';
import { SelectionInfo } from './SelectionInfo';

@Directive({
    selector: '[editorInput]'
})
export class EditorInputDirective implements AfterViewInit {
    private dropped: boolean;
    private mutationObserverHandler;
    private recordManager: RecordManager;
    private selectionManager: SelectionManager;
    private dropdownTimer: NodeJS.Timer;
    private dropdownDelayTime: number;
    private newLineInput: boolean;

    ngAfterViewInit() {
        new MutationObserver(
            this.mutationObserverHandler
        ).observe(
            this.parentCmp.body,
            { childList: true, subtree: true, characterData: true }
        );

        // Initialize editor with a line and place the caret in it
        if ($(this.parentCmp.body).children("div").length == 0) {
            $(this.parentCmp.body).append("<div><br></div>");
        }
        this.selectionManager.setVisualCaretPos(0, 0);

        // Add droppable functionality for elements being dragged from the sidebar. 
        ($(this.parentCmp.body).closest(".card-body") as any).droppable({
            active: ".navDrag",
            tolerance: "pointer",
            drop: function (event, ui) {
                ui.draggable.removeData("drag-action");
                let text = ui.helper.text();

                this.parentCmp.replaceSelectedRegionFromExternal(text);
            }.bind(this),
            over: function (event, ui) {
                ui.draggable.data("initial-selection", this.selectionManager.getSelectionInfo());
                ui.draggable.data("drag-action", function (event) {
                    var x = event.pageX - $(this.parentCmp.body).offset().left - parseFloat($(this.parentCmp.body).css("padding-left"));
                    var y = event.pageY - $(this.parentCmp.body).offset().top - parseFloat($(this.parentCmp.body).css("padding-top"));
                    this.selectionManager.setVisualCaretRange(
                        this.selectionManager.getFromCoordinates(x, y)
                    );
                }.bind(this));
            }.bind(this),
            out: function (event, ui) {
                ui.draggable.removeData("drag-action");
                if (ui.draggable.data("initial-selection")) {
                    this.selectionManager.setVisualCaretRange(
                        ui.draggable.data("initial-selection")
                    );
                }
            }.bind(this)
        });

        let URIQuery = Utility.formatSelectQueryTokens(Utility.mapURIQuery());
        if (URIQuery.length > 0) {
            this.parentCmp.replaceSelectedRegion(
                Utility.splitText(URIQuery)
            );
        }
    }

    constructor(private parentCmp: QueryEditorComponent) {
        this.recordManager = parentCmp.recordManager;
        let selectionManager = this.selectionManager = parentCmp.selectionManager;
        this.dropdownDelayTime = 400;
        this.mutationObserverHandler = function (mutationsList) {
            let DOMCount: number = $(parentCmp.body).children("div").length;

            // If there are any pseudo-DOM elements, wrap them in a div
            if (DOMCount == 0) {
                let contents = parentCmp.body.textContent;
                parentCmp.body.textContent = "";

                var focus;
                if (contents.length == 0) {
                    focus = $(parentCmp.body).prepend("<div><br></div>").children()[0]
                    contents = "";
                } else {
                    focus = $(parentCmp.body).prepend("<div>" + contents + "</div>").children()[0].childNodes[0]
                }

                // Replace the caret within the div after the added contents
                selectionManager.setCaretPosition(
                    focus,
                    contents.length
                )
                return;
            }

            // Unwrap any font tags that get placed erroneously by contenteditable.
            let fontLines = $(parentCmp.body).find("font") as JQuery<HTMLElement>;
            if (fontLines.length > 0) {
                let info = selectionManager.getSelectionInfo();
                fontLines.each((index, element) => {
                    $(element).replaceWith(element.textContent);
                });
                selectionManager.setVisualCaretRange(info);
            }

            parentCmp.setLineNumbers(DOMCount)

            let caretChange = false;
            var info: SelectionInfo;

            // Style modified nodes
            mutationsList.forEach(mutation => {
                let targets = [];
                let target = mutation.target as any;
                // Fill targets with lines that need validation.
                if (mutation.type == "characterData" && target.isConnected) {
                    targets.push(target);
                }

                if (mutation.type == "childList") {
                    if (mutation.addedNodes.length > 0) {
                        for (let i = 0; i < mutation.addedNodes.length; i++) {
                            let node = mutation.addedNodes[i];
                            if (!(node as any).isConnected) { continue; }

                            if (node.localName == "div" ||
                                node.localName == "span" ||
                                node.nodeType == 3
                            ) {
                                targets.push(node);
                            }
                        }
                    }

                    if (mutation.removedNodes.length > 0) {
                        for (let i = 0; i < mutation.removedNodes.length; i++) {
                            let node = mutation.removedNodes[i];
                            if (node.nodeType == 3) {
                                targets.push(node);
                            }
                        }
                    }
                }

                // If any lines need validation, save the current selection.
                if (targets.length > 0 && parentCmp.hasSelection()) {
                    info = selectionManager.getSelectionInfo();
                }

                // Style modified divs
                targets.forEach(mTarget => {
                    let line = mTarget.isConnected ? parentCmp.getLineFromNode(mTarget) : parentCmp.nthLine(info.startIndex).get()[0];

                    // On style change, set caretChange to true
                    caretChange = parentCmp.validateLineStyle(line as HTMLElement) || caretChange;

                    // Fill empty lines with visual line break
                    if (mTarget.localName == "div" && mTarget.textContent.length == 0 && mTarget.childElementCount == 0) {
                        $(mTarget).append("<br>");
                    }
                });
            });

            if (caretChange) {
                selectionManager.setVisualCaretRange(info);
            }

            // Remove orphaned text nodes
            $(parentCmp.body)
                .contents()
                .filter(function () {
                    return this.nodeType == 3 || this.localName == "br";
                })
                .remove();
        }
    }

    @HostListener('dragstart') onDragStart() {
        this.recordManager.startDragRecord();
    }

    @HostListener('dragover', ['$event']) ondragenter(e) {
        console.log(e)
    }

    @HostListener('drop') onDrop() {
        this.dropped = true;
    }

    @HostListener('dragend') onDragEnd() {
        if (this.dropped) {
            this.recordManager.endRecord();
        } else {
            this.recordManager.cancelRecord();
        }
        this.dropped = false;
    }

    @HostListener('mousedown') onmousedown() {
        this.recordManager.endRecord();
    }

    @HostListener('focusout') onFocusOut() {
        this.recordManager.endRecord();
    }

    @HostListener('click', ['$event']) onClick(e) {
        if ($(event.target).hasClass("optionWrapper")) {
            this.parentCmp.selectOptionAtIndex($(event.target).index());
        } else {
            this.parentCmp.closeDropdown();
            clearTimeout(this.dropdownTimer);
        }
    }

    /**
     * Handle pasting in a way that respects the user's data while preserving
     * the line-div relationship.
     * @param e 
     */
    @HostListener('paste', ['$event']) onPaste(e) {
        this.recordManager.endRecord();
        e.preventDefault();
        // Get paste data from clipboard and split via regex
        var pasteData = e.clipboardData.getData('text');
        if (pasteData.length == 0) { return; }

        // Separate paste data by newlines, while keeping empty lines intact
        pasteData = Utility.splitText(pasteData);

        this.recordManager.getRecordFromFunction(
            RecordType.Paste,
            () => this.parentCmp.replaceSelectedRegion(pasteData)
        )
        this.parentCmp.ScrollToCaret();
        clearTimeout(this.dropdownTimer);
        this.parentCmp.closeDropdown();
    }

    @HostListener('input') onInput() {
        clearTimeout(this.dropdownTimer);

        // If a newline was created, end the record immediately so that it's stored as its own operation.
        if (this.newLineInput) {
            this.recordManager.endRecord();
            this.newLineInput = false;
        }

        if (this.parentCmp.dropdownIsOpen()) {
            this.handleInput(false);
        } else {
            this.dropdownTimer = setTimeout(() => {
                this.handleInput(false);
            }, this.dropdownDelayTime
            );
        }
    }

    @HostListener('beforeinput', ['$event']) onBeforeInput(e) {
        if (!this.recordManager.recordingInput && (e.data != null)) {
            this.recordManager.startInputRecord();
        } else if (e.inputType == "insertParagraph") { // Force newlines to always get a new recording
            this.recordManager.startInputRecord();
            this.newLineInput = true;
        }
    }

    @HostListener('keydown', ['$event']) onKeyDown(e: KeyboardEvent) {
        switch (e.keyCode) {
            case 8: // Backspace
            case 46: // Del
                this.handleDeletion(e);
                break;
            case 9: // Tab
                e.preventDefault();
                this.recordManager.endRecord();
                let sel = window.getSelection();
                if (e.shiftKey) { // Shift + Tab
                    this.recordManager.getRecordFromFunction(
                        RecordType.TabBackward,
                        () => this.parentCmp.shiftSelectionLeft()
                    )
                } else {
                    if (!this.parentCmp.selectIndicatedOption()) {
                        if (sel.anchorNode == sel.focusNode) {
                            this.recordManager.getRecordFromFunction(
                                RecordType.Input,
                                () => this.parentCmp.replaceSelectedRegion('\t')
                            );
                        } else {
                            this.recordManager.getRecordFromFunction(
                                RecordType.TabForward,
                                () => this.parentCmp.shiftSelectionRight()
                            );
                        }
                    }
                }
                break;
            case 13: // Enter
                if (this.parentCmp.selectIndicatedOption()) {
                    e.preventDefault();
                }
                break;
            case 27: // ESC
                if (this.parentCmp.dropdownIsOpen()) {
                    this.parentCmp.closeDropdown();
                } else {
                    this.selectionManager.clearSelection();
                }
                clearTimeout(this.dropdownTimer);
                break;
            case 32: // Space
                if (e.ctrlKey) { // CTRL+Space
                    this.handleInput(true);
                    clearTimeout(this.dropdownTimer);
                    e.preventDefault();
                }
                break;
            case 35: // End
                e.preventDefault();
                this.recordManager.endRecord();
                if (e.shiftKey) {
                    this.parentCmp.highlightResult(
                        () => this.parentCmp.MoveCaretToEnd(e)
                    )
                } else {
                    this.parentCmp.MoveCaretToEnd(e);
                }
                clearTimeout(this.dropdownTimer);
                this.parentCmp.closeDropdown();
                break;
            case 36: // Home
                e.preventDefault();
                this.recordManager.endRecord();
                if (e.shiftKey) {
                    this.parentCmp.highlightResult(
                        () => this.parentCmp.MoveCaretToStart(e)
                    )
                } else {
                    this.parentCmp.MoveCaretToStart(e);
                }
                clearTimeout(this.dropdownTimer);
                this.parentCmp.closeDropdown();
                break;
            case 37: // Left
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.parentCmp.highlightResult(() => this.parentCmp.moveCaretLeftToken());
                    } else {
                        this.parentCmp.moveCaretLeftToken();
                    }
                }
                this.recordManager.endRecord();
                clearTimeout(this.dropdownTimer);
                this.parentCmp.closeDropdown();
                break;
            case 39: // Right
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.parentCmp.highlightResult(() => this.parentCmp.moveCaretRightToken());
                    } else {
                        this.parentCmp.moveCaretRightToken();
                    }
                }
                this.recordManager.endRecord();
                clearTimeout(this.dropdownTimer);
                this.parentCmp.closeDropdown();
                break;
            case 38: // UP
                e.preventDefault();
                this.recordManager.endRecord();
                if (this.parentCmp.dropdownIsOpen()) {
                    this.parentCmp.scrollDropdown(-1);
                } else {
                    if (e.shiftKey) {
                        this.parentCmp.highlightResult(() => this.parentCmp.MoveLine(-1));
                    } else {
                        this.parentCmp.MoveLine(-1);
                    }
                }
                clearTimeout(this.dropdownTimer);
                break;
            case 40: // Down
                e.preventDefault();
                this.recordManager.endRecord();
                if (this.parentCmp.dropdownIsOpen()) {
                    this.parentCmp.scrollDropdown(1);
                } else {
                    if (e.shiftKey) {
                        this.parentCmp.highlightResult(() => this.parentCmp.MoveLine(1));
                    } else {
                        this.parentCmp.MoveLine(1);
                    }
                }
                clearTimeout(this.dropdownTimer);
                break;
            case 65: // A
                if (e.ctrlKey) {
                    this.recordManager.endRecord();
                    clearTimeout(this.dropdownTimer);
                    this.parentCmp.closeDropdown();
                }
                break;
            case 90: // Z
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.recordManager.endRecord();
                    if (e.shiftKey) {
                        this.parentCmp.redo();
                    } else {
                        this.parentCmp.undo();
                    }
                    this.parentCmp.closeDropdown();
                    clearTimeout(this.dropdownTimer);
                }
                break;
        }
    }

    handleDeletion(e: KeyboardEvent) {
        this.recordManager.startDeletionRecord(e);
    }

    handleInput(forceAutoComplete) {
        clearTimeout(this.dropdownTimer);
        if (window.getSelection) { // get dropdown from autocomplete
            let sel = window.getSelection();
            if (sel.rangeCount) {

                let range = sel.getRangeAt(0);
                let caretPos = range.endOffset;
                let innerText;
                if (caretPos == 0) {
                    innerText = "";
                } else {
                    innerText = range.commonAncestorContainer.textContent.substring(0, caretPos);
                }
                this.parentCmp.drawDropdown(innerText, forceAutoComplete);
            }
        }
    }
}
