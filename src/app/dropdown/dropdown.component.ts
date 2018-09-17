import { Component, AfterViewInit, ElementRef } from '@angular/core';
import 'rxjs/add/observable/of';
import { Observable, Subscription } from 'rxjs';
import { Utility } from '../Utility';
import { LRUList } from '../Data Structures/LRUList';

var Heap = require('heap');

export interface DropdownPosition {
    leftBound: number,
    rightBound: number,
    topBound: number,
    bottomBound: number,
    x: number,
    y: number
}

export interface dropdownObserver {
    next: (value: string) => void,
    error: (error: any) => void,
    complete: () => void,
    heap: Heap<string>,
    callback: (value: Heap<string>) => void
};

@Component({
    selector: 'app-dropdown',
    templateUrl: './dropdown.component.html',
    styleUrls: ['./dropdown.component.css']
})
export class DropdownComponent implements AfterViewInit {
    private static textHeight: number = 15;
    private static LRUOptionsCapacity = 40;

    private dropdownHTML: HTMLElement;
    private optionsHTML: HTMLElement;
    private messageHTML: HTMLElement;
    private position: DropdownPosition;
    private options: string[];
    private prefixLen: number;
    private visualPrefixLen: number;
    private forceOpen: boolean;
    private hasSelection: boolean;
    private selectedIndex: number;
    private flippedX: boolean;

    private LRUOptions: LRUList<string>;
    private previouslyUsedOptionsLength: number;

    private drawSubscriptions: Subscription[];
    private pendingSubscriptions: number;
    private drawObserver: dropdownObserver;

    private loadingDropdownTimer: NodeJS.Timer;
    private dropdownLoadingDelayTime: number;

    public open: boolean;

    constructor(private el: ElementRef) {
        this.open = false;
        this.options = [];
        this.prefixLen = 0;
        this.visualPrefixLen = 0;
        this.hasSelection = false;
        this.drawSubscriptions = [];
        this.loadingDropdownTimer = null;
        this.dropdownLoadingDelayTime = 300;
        this.LRUOptions = new LRUList<string>(DropdownComponent.LRUOptionsCapacity);
        this.LRUOptions.backupComparator = Utility.alphabeticComparer;
        this.LRUOptions.put("SELECT");

        this.drawObserver = {
            next: function (value: string) {
                this.heap.push(value);
            },
            error: (error) => { },
            complete: function () {
                this.callback(this.heap);
            },
            heap: new Heap(this.LRUOptions.compare.bind(this.LRUOptions)),
            callback: this.afterDropdownLoad.bind(this)
        }
    }

    ngAfterViewInit() {
        this.dropdownHTML = $(this.el.nativeElement).find('.dropdown').get(0);
        this.optionsHTML = $(this.el.nativeElement).find('.options').get(0);
        this.messageHTML = $(this.el.nativeElement).find(".message-field").get(0);

        $(this.dropdownHTML).css({ textHeight: DropdownComponent.textHeight })

        // On mouse enter, highlight the hovered index.
        $(this.dropdownHTML).on('mouseenter', ".optionWrapper", (function (dropdown) {
            return function () {
                let index = $(this).index();
                // Adjust for divider bar
                if (dropdown.previouslyUsedOptionsLength > 0 && index >= dropdown.previouslyUsedOptionsLength) {
                    index--;
                }
                dropdown.highlightIndex(index, false);
            }
        })(this));

        this.closeDropdown();
    }

    /**
     * Callback function meant to be called by an instance of dropdownObserver.  Updates the dropdown
     * view to include the values in the given heap.
     */
    private afterDropdownLoad(heap: Heap<string>): void {
        this.pendingSubscriptions--;

        // If the options dropdown is not empty, then insert the new values into the view while maintaining the sort invariant.
        if (this.options.length > 0) {
            this.insertOptions(heap);
            return;
        }

        // Otherwise, push the complete heap to this.options
        while (!heap.empty()) {
            let v = heap.pop();
            this.options.push(v);
        }
        this.getPreviouslyUsedOptionsLength();

        if (this.options.length > 0) {
            clearTimeout(this.loadingDropdownTimer);
            this.setOptionsView(this.options);
            // Show the dropdown, then scroll to the top when the dropdown opens for the first time
            this.showOptionsField();
            this.scrollTo(0);

        // If all subscribers have concluded and there are still no options to show, do some cleanup.
        } else if (this.pendingSubscriptions == 0) {
            // Stop the loading message from appearing, if it hasn't already.
            clearTimeout(this.loadingDropdownTimer);
            if (this.forceOpen) {
                // Only show the failure message when the user forces it
                this.showMessageField("No Suggestions Found");
            } else {
                // If it's empty but we can't show the error message, close the whole thing instead.
                this.closeDropdown();
            }
        }
    }

    /**
     * Sets this dropdown to display the given options with the prefix highlighted.
     * @param options An array of Observable that each emit strings to be displayed in the dropdown
     * @param prefix The common prefix shared by all values emitted by options
     * @param force Boolean that will determine if an empty dropdown is still displayed
     * @param dropdownPosition The position and boundary information indicating where the dropdown will be placed
     */
    public setOptions(options: Observable<string>[], prefix: string, force: boolean, dropdownPosition: DropdownPosition) {
        // Reset everything necessary for this dropdown to be prepared to recieve new values.
        this.closeDropdown();
        this.forceOpen = force;
        this.flippedX = false;
        this.options = [];
        this.previouslyUsedOptionsLength = 0;
        this.prefixLen = this.visualPrefixLen = prefix.length;
        if (prefix.charAt(0) == '[' && prefix.charAt(prefix.length - 1) == ']') {
            this.visualPrefixLen -= 2;
        }
        this.position = dropdownPosition;

        // Start a new loading timer if the user has forced this dropdown to open
        if (force) {
            clearTimeout(this.loadingDropdownTimer);
            this.loadingDropdownTimer = setTimeout(() => this.showMessageField("loading..."), this.dropdownLoadingDelayTime);
        }

        // Subscribe to each option Observable
        this.pendingSubscriptions = options.length;
        options.forEach(option => {
            this.drawSubscriptions.push(
                option.subscribe(this.drawObserver)
            );
        });
    }

    /**
     * Insert the options from the given heap into the current list of options, while maintaining the sort invariant.
     * Requires that this.options is not empty.
     * @param insert 
     */
    private insertOptions(insert: Heap<string>) {
        let dropdown = $(this.optionsHTML).clone();
        let pushIndex = 0;
        let selectionOffset = 0;
        while (!insert.empty()) {
            let v = insert.pop();

            // Get the index of the added value
            for (pushIndex; pushIndex < this.options.length; pushIndex++) {
                if (this.LRUOptions.compare(v, this.options[pushIndex]) < 0) {
                    break;
                }
            }

            // If pushIndex comes before the index of the currently selected item, 
            // move it forward one to compensate.
            if (this.hasSelection && pushIndex <= this.selectedIndex + selectionOffset) {
                selectionOffset++;
            }

            // Push to the opposite side if this dropdown is flipped.
            let insertIndex = this.flippedX ? this.options.length - pushIndex : pushIndex;

            // Place a new option at insertIndex
            let contents = "<div class=\"optionWrapper form-control\">" +
                "<span class=\"prefix\">" + v.substring(0, this.visualPrefixLen) + "</span>" + v.substring(this.visualPrefixLen) + "</div>";
            if (insertIndex == this.options.length) {
                $(dropdown.children().get(insertIndex - 1)).after(contents);
            } else {
                $(dropdown.children().get(insertIndex)).before(contents);
            }
            this.options.splice(pushIndex, 0, v);
        }
        $(this.optionsHTML).replaceWith(dropdown);
        this.optionsHTML = $(this.dropdownHTML).find('.options').get(0);

        // Move the divider to its new spot
        $(this.optionsHTML).find(".sortedOptionsDivider").remove();
        this.getPreviouslyUsedOptionsLength();
        this.setSortedOptionsDivider();

        // Update the index of the current selection
        if (this.hasSelection) {
            this.highlightIndex(this.selectedIndex + selectionOffset);
        }

        // Refresh the options field
        this.showOptionsField();
    }

    /**
     * Set the dropdown view to show the options stored in this model.
     */
    private setOptionsView(options: string[]) {
        let virtualDropdown = document.createElement("span");
        virtualDropdown.classList.add("options");

        options.forEach(option => {
            $(virtualDropdown).append(
                "<div class=\"optionWrapper form-control\">" +
                "<span class=\"prefix\">" + option.substring(0, this.visualPrefixLen) + "</span>" + option.substring(this.visualPrefixLen) +
                "</div>"
            );
        });

        $(this.optionsHTML).replaceWith(virtualDropdown);
        this.optionsHTML = $(this.dropdownHTML).find('.options').get(0);
        this.setSortedOptionsDivider();
    }

    /**
     * Show the message field with the given message, and hide options.
     * @param message 
     */
    private showMessageField(message: string) {
        $(this.messageHTML).text(message);
        $(this.messageHTML).show();
        $(this.optionsHTML).hide();
        $(this.dropdownHTML).show();
        this.open = true;
        this.setDropdownPosition(this.position);
    }

    /**
     * Show the options field, allowing the user to view and select the options in the dropdown.
     */
    private showOptionsField() {
        $(this.messageHTML).hide();
        $(this.optionsHTML).show();
        $(this.dropdownHTML).show();
        this.open = true;
        this.setDropdownPosition(this.position);
    }

    /**
     * Using the values currently stored in this.options, determine the number of options that are stored in the LRU,
     * and set it in this.previouslyUsedOptionsLength.
     */
    private getPreviouslyUsedOptionsLength() {
        let i = 0;
        // Since this.options maintains a sort invariant that keeps elements in this.LRUOptions at the front,
        // we will have reached the last previously used element once we see something not in this.LRUOptions.
        while (i < this.options.length && this.LRUOptions.indexOf(this.options[i]) >= 0) {
            i++
        }
        this.previouslyUsedOptionsLength = i;
    }

    /**
     * Set the divider between the previously used options and the others.
     */
    private setSortedOptionsDivider() {
        // Hide it if it would be on the top or bottom extreme of the dropdown.
        if (this.previouslyUsedOptionsLength == 0 || this.previouslyUsedOptionsLength == this.options.length) {
            return;
        }
        let divider = document.createElement("hr");
        divider.classList.add("sortedOptionsDivider");
        $(divider).insertAfter(
            $(this.optionsHTML).children('.optionWrapper').get(this.previouslyUsedOptionsLength - 1)
        );
    }

    /**
     * Set the dropdown position to the caret, flipping over the x or y axis as necessary.
     * @param pos The position and boundary information indicating where the dropdown will be placed
     */
    public setDropdownPosition(pos: DropdownPosition) {
        // Hide or unhide this dropdown depending on whether the caret is visible.
        if (pos.y < pos.topBound || pos.bottomBound < pos.y || pos.x < pos.leftBound || pos.rightBound < pos.x) {
            $(this.dropdownHTML).hide();
            return;
        }
        $(this.dropdownHTML).show();

        // Adjust coordinates for the view position
        let y = pos.y + 15 - pos.topBound;
        let x = pos.x + 15 - pos.leftBound;

        // Flip the dropdown over the x-axis if it's going out of bounds by height
        let dropdownHeight = $(this.dropdownHTML).height();
        let flip = y + dropdownHeight > pos.bottomBound;
        if (flip != this.flippedX) {
            this.previouslyUsedOptionsLength = this.options.length - this.previouslyUsedOptionsLength;
            this.setOptionsView(this.options.reverse());
            this.flippedX = flip;
            if (this.hasSelection) {
                this.highlightIndex(this.options.length - 1 - this.selectedIndex, true);
            } else {
                this.scrollTo(flip ? this.options.length - 1 : 0);
            }
        }
        if (flip) {
            y -= dropdownHeight + 15;
        }

        // Move the dropdown left if it's going out of bounds by width
        let dropdownWidth = $(this.dropdownHTML).width();
        if (x + dropdownWidth > pos.rightBound) {
            x -= dropdownWidth;
        }

        // Finally, set x and y
        $(this.dropdownHTML).css({ top: y + "px", left: x + "px", position: 'absolute' });
    }

    /**
     * Highlight the option at the given index, while un-highlighting the currently selected index.
     * @param index The index of the option to be selected.
     * @param scroll Boolean value indicating whether the element at index should be scrolled to.
     * Defaults to true.
     */
    private highlightIndex(index: number, scroll: boolean = true) {
        // Remove the highlight from the previously selected index, if there is one.
        if (this.hasSelection) {
            this.setHighlight(this.selectedIndex, false);
        }

        this.selectedIndex = index;
        this.hasSelection = true;
        this.setHighlight(index, true, scroll);
    }

    /**
     * Scroll the dropdown one element in the direction provided.
     * @param direction 
     * The direction to scroll.  Scrolls up if negative, otherwise scrolls down.
     */
    public scroll(direction: number) {
        let sign = direction < 0 ? -1 : 1; // value of 0 is interpreted as positive.
        if (!this.hasSelection) {
            // If nothing is selected, scroll to the first element of the dropdown.
            this.highlightIndex(
                this.flippedX ? this.options.length - 1 : 0, true
            );
        } else {
            // Otherwise, move to the next element in the given direction
            this.highlightIndex(
                Utility.mod(this.selectedIndex + sign, this.options.length), true
            );
        }
    }

    /**
     * Scroll the dropdown directly to the given index.
     * @param index 
     */
    private scrollTo(index: number) {
        if (!this.open) { return; }

        $(this.dropdownHTML).scrollTop(
            $(this.dropdownHTML).find(".optionWrapper:eq(" + index + ")").offset().top - 
            $(this.dropdownHTML).offset().top + $(this.dropdownHTML).scrollTop() - 
            DropdownComponent.textHeight * 2
        );
    }

    /**
     * Get the currently indicated option (the option at index this.selectedIndex).
     * @returns (selected prefixLen, selected option) if an option is selected, [] otherwise.
     */
    public getIndicatedOption(): (number | string)[] {
        if (this.hasSelection && this.open) {
            this.LRUOptions.put(this.options[this.selectedIndex]);
            return [this.prefixLen, this.options[this.selectedIndex]];
        }
        return [];
    }

    /**
     * Get the option at the given index.  Requires that the index is valid.
     * @param index
     * @returns (prefixLen, option at the given index).
     */
    public getOptionAtIndex(index: number): (number | string)[] {
        if (this.previouslyUsedOptionsLength > 0 && index >= this.previouslyUsedOptionsLength) {
            index--;
        }

        this.LRUOptions.put(this.options[index]);
        return [this.prefixLen, this.options[index]];
    }

    /**
     * Set the highlight of the element at the given index.
     * @param index The index of the element
     * @param highlight highlights the element at index if true, disables its highlight otherwise
     * @param scroll boolean determining if the target element should be scrolled to.
     */
    private setHighlight(index: number, highlight: boolean, scroll: boolean = true) {
        if (highlight) {
            $(this.dropdownHTML).find(".optionWrapper:eq(" + index + ")").addClass("drpselect")
            if (scroll) {
                this.scrollTo(index);
            }
        } else {
            $(this.dropdownHTML).find(".optionWrapper:eq(" + index + ")").removeClass("drpselect")
        }
    }

    /**
     * Close all open subscriptions belonging to this.
     */
    private closeSubscriptions() {
        this.drawSubscriptions.forEach(sub => {
            if (!sub.closed) {
                sub.unsubscribe();
            }
        });
        this.pendingSubscriptions = 0;
        this.drawSubscriptions = [];
    }

    /**
     * Close this dropdown.
     */
    public closeDropdown() {
        this.hasSelection = false;
        this.open = false;
        $(this.dropdownHTML).hide();
        this.closeSubscriptions();
    }
}