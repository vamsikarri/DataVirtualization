import { Component, ElementRef } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { Utility } from '../Utility';
import { FederatedqueryComponent } from '../federatedquery/federatedquery.component';

export interface VariableRowContents {
    name: string,
    value: string
}

@Component({
    selector: 'app-variable-set-modal',
    templateUrl: './variable-set-modal.component.html',
    styleUrls: ['./variable-set-modal.component.css']
})
export class VariableSetModalComponent extends ModalComponent {
    private static varNameClass = 'var-name';
    private static varValueClass = 'var-value';
    private static storageName = 'userVariables';

    public tabId: number;

    private variableListEl: JQuery<HTMLElement>;
    private messageDisplay: JQuery<HTMLElement>;
    private variableMap: Map<string, string>;
    private rowNameMap: Map<HTMLElement, string>;
    private currentNames: Set<string>;
    private invalidRows: Set<HTMLElement>;

    constructor(el: ElementRef) {
        super(el);
        this.variableMap = new Map<string, string>();
        this.rowNameMap = new Map<HTMLElement, string>();
        this.currentNames = new Set<string>();
        this.invalidRows = new Set<HTMLElement>();
    }

    ngAfterViewInit() {
        // Store static references
        this.variableListEl = $(this.body).find('.variable-list');
        this.messageDisplay = $(this.body).find('.variable-message');

        // Set up clear buttons
        $(this.body).on('click', '.clear-row', (event) => {
            this.removeRow($(event.target.parentElement));
        });

        // Set up callback for modifications to name input fields
        $(this.body).on('input', `.${VariableSetModalComponent.varNameClass} input`, (event) => {
            let value = (event.target as any).value == undefined ? '' : (event.target as any).value;
            this.updateRowName($(event.target).closest('.row'), value.trim());
        });

        // Set up callback for modifications to value input fields
        $(this.body).on('input', `.${VariableSetModalComponent.varValueClass} input`, (event) => {
            this.clearInputHighlight(event.target);
        });
    }

    /**
     * Open the modal interface with a list of new variable names.
     * @param newNames 
     */
    public openWithNewNames(newNames: string[]) {
        // Clear all unsaved variables
        this.loadFromLocalStorage();

        newNames.forEach((name) => {
            if(!this.currentNames.has(name)) {
                this.appendVariableRow(name, '');
            }
        });
        super.openModal();
    }

    /**
     * Append a new row to the end of the view.
     * @param name Optional parameter for a name to initialize this row with.  If provided, a value must also be provided.
     * @param value Optional parameter for a value to initialize this row with.  If provided, a name must also be provided.
     */
    private appendVariableRow(name: string = null, value: string = null) {
        let row = $('<div class="row">' +
            `<div class = "input-field ${VariableSetModalComponent.varNameClass}">` +
            '<input placeholder = "Name" type = "text">' +
            '</div>' +
            '<h1 style="color: #fff;padding: 0px 6px 6px;background-color: #767676;line-height: 20px;height: 30px;margin: 20px 10px 0;" class = "var-eq"> = </h1>' +
            `<div class = "input-field ${VariableSetModalComponent.varValueClass}">` +
            '<input placeholder = "Value" type = "text">' +
            '</div>' +
            '<i class="material-icons clear-row">delete</i>'+
            '</div>'
        ).appendTo(this.variableListEl);

        // Fill name and value fields if they were given
        if (name != null && value != null) {
            row.find(`.${VariableSetModalComponent.varNameClass} input`).val(name.trim());
            row.find(`.${VariableSetModalComponent.varValueClass} input`).val(value);
            if (!this.currentNames.has(name)) {
                this.currentNames.add(name);
            } else {
                this.invalidRows.add(row.get(0));
                this.highlightInvalidName(row.get(0));
            }
        }
        this.rowNameMap.set(row.get(0), name == null ? '' : name.trim());
    }

    /**
     * Remove the given row from the modal.
     * @param row 
     */
    private removeRow(row: JQuery<HTMLElement>) {
        this.removeFromMap(row);
        row.remove();
    }

    /**
     * Remove the given row from the map, while updating any other rows as necessary.
     * @param row 
     */
    private removeFromMap(row: JQuery<HTMLElement>) {
        let rowEl = row.get(0);
        let previousName = this.rowNameMap.get(rowEl);
        if (previousName.length > 0) {
            if (this.invalidRows.has(rowEl)) {
                this.invalidRows.delete(rowEl);
                this.clearInputHighlight(row.find(`.${VariableSetModalComponent.varNameClass} input`).get(0));
            } else {
                this.currentNames.delete(previousName);
                // Since one of the currently stored names has been removed, check if any of the invalid rows are now valid
                this.updateInvalidRow(previousName);
            }
        } else {
            this.rowNameMap.delete(rowEl);
        }

    }

    /**
     * Update the name stored in the given row with the given new name.
     * @param row 
     * @param newName 
     */
    private updateRowName(row: JQuery<HTMLElement>, newName: string) {
        // Remove this row from the set it's in
        this.removeFromMap(row);

        // Store new name
        let rowEl = row.get(0);
        this.rowNameMap.set(rowEl, newName);

        // If this name is unique, store it in currentVarNames, otherwise store this row in invalidRows
        if (newName.length > 0) {
            if (this.currentNames.has(newName)) {
                this.invalidRows.add(rowEl);
                this.highlightInvalidName(rowEl);
            } else {
                this.currentNames.add(newName);
            }
        }

    }

    /**
     * Find an invalid row that has been invalidated due to a collision with the given variable name and remove its invalid status.
     * @param previousName 
     */
    private updateInvalidRow(previousName: string) {
        let minIndex = this.rowNameMap.size;
        let updateRow = null;
        // Get the invalid row with the given name closest to the top of the list
        this.invalidRows.forEach(element => {
            if (this.rowNameMap.get(element) == previousName && $(element).index() < minIndex) {
                minIndex = $(element).index();
                updateRow = element;
            }
        });

        if (updateRow != null) {
            this.invalidRows.delete(updateRow);
            this.currentNames.add(previousName);
            this.clearInputHighlight($(updateRow).find(`.${VariableSetModalComponent.varNameClass} input`).get(0));
        }
    }

    /**
     * Save the currently written name, value pairs to local storage, if they are all valid.
     * If any of the rows have an error, abort and display an alert.
     */
    private saveVariables() {
        // Get all rows with an empty field
        let emptyFieldRows = this.variableListEl.children().filter((index, element) => {
            let contents = this.getVariableRowContents($(element))
            return contents.name.length == 0 || contents.value.length == 0;
        });

        // If any of the rows are invalid, abort and display an alert
        if (this.invalidRows.size + emptyFieldRows.length > 0) {

            // Get the length of the union between invalidRows and emptyFieldRows
            let invalidLength = this.invalidRows.size + emptyFieldRows.length;
            emptyFieldRows.each((index, element) => {
                if (this.invalidRows.has(element)) {
                    invalidLength--;
                }
            });

            this.showInvalidRowMessage(invalidLength);
            this.highlightInvalidRows();
            return;
        }

        // Clear the variable map and get new sets of values.
        this.variableMap.clear();
        this.variableListEl.children().each((index, element) => {
            let contents = this.getVariableRowContents($(element));
            if (!this.variableMap.has(contents.name)) {
                this.variableMap.set(contents.name, contents.value);
            }
        });
        this.saveToLocalStorage();
        this.showSuccessMessage();
    }

    /**
     * Highlight all invalid rows.
     */
    private highlightInvalidRows() {
        // Highlight all rows with an empty input or value field
        this.variableListEl.children().each((index, element) => {
            let contents = this.getVariableRowContents($(element));
            if (contents.name.length == 0) {
                this.highlightInvalidName(element);
                $(element).addClass('invalid');
            }
            if (contents.value.length == 0) {
                this.highlightInvalidValue(element);
                $(element).addClass('invalid');
            }
        });

        // Highlight all rows with a name collision
        this.invalidRows.forEach(element => {
            $(element).addClass('invalid');
        });
    }

    /**
     * Clear the highlight on the given input field.  If both fields on the same row are unhighlighted after clearing this highlight,
     * this function will also clear the parent's highlight.
     * @param field 
     */
    private clearInputHighlight(inputField: HTMLElement) {
        $(inputField).removeClass('invalid');
        let other = $(inputField.parentElement).siblings('div').children().first();
        if (!other.hasClass('invalid')) {
            $(inputField).closest('.row').removeClass('invalid');
        }
    }

    /**
     * Highlight the name field of the given row to indicate that it is invalid.
     * @param row 
     */
    private highlightInvalidName(row: HTMLElement) {
        $(row).find(`.${VariableSetModalComponent.varNameClass} input`).addClass('invalid');
    }

    /**
     * Highlight the value field of the given row to indicate that it is invalid.
     * @param row 
     */
    private highlightInvalidValue(row: HTMLElement) {
        $(row).find(`.${VariableSetModalComponent.varValueClass} input`).addClass('invalid');
    }

    /**
     * Hide the current message, if there is one.
     */
    private hideMessage() {
        this.messageDisplay.empty();
        // Remove all classes except for the initial
        this.messageDisplay.removeClass();
        this.messageDisplay.addClass('variable-message');
    }

    /**
     * Show the error message associated with the presence of an invalid row.
     * @param invalidRowCount The number of invalid rows detected.
     */
    private showInvalidRowMessage(invalidRowCount: number) {
        this.hideMessage();
        this.messageDisplay.text('There are ' + invalidRowCount + ' invalid row(s).  Please double-check your variables before saving.');
        this.messageDisplay.addClass('alert alert-danger');
    }

    /**
     * Show the success message associated with a successful save.
     */
    private showSuccessMessage() {
        this.hideMessage();
        this.messageDisplay.text('Saved.');
        this.messageDisplay.addClass('alert alert-success');
    }

    /**
     * Callback function for modal closing.  Clears all empty rows.
     */
    protected closeModal() {
        this.variableListEl.children().filter((index, element) => {
            return this.isEmptyRow($(element));
        }).remove();
        this.hideMessage();
    }

    /**
     * Check if the given row has an empty name, value pair.
     * @param row 
     */
    private isEmptyRow(row: JQuery<HTMLElement>): boolean {
        let rowContents = this.getVariableRowContents(row);
        return rowContents.name.length == 0 && rowContents.value.length == 0;
    }

    /**
     * Check if the given row has a valid name, value pair.
     * @param row 
     */
    private isValidRow(row: JQuery<HTMLElement>): boolean {
        let rowContents = this.getVariableRowContents(row);
        return rowContents.name.length > 0 && rowContents.value.length > 0;
    }

    /**
     * Get the name, value pair contained in the given variable row.
     * @param row 
     */
    private getVariableRowContents(row: JQuery<HTMLElement>): VariableRowContents {
        let name = row.find(`.${VariableSetModalComponent.varNameClass} input`).val();
        if (typeof (name) == 'undefined') {
            name = '';
        }
        let value = row.find(`.${VariableSetModalComponent.varValueClass} input`).val();
        if (typeof (value) == 'undefined') {
            value = '';
        }

        return {
            name: name.toString(),
            value: value.toString()
        };
    }

    /**
     * Save the current value, name mapping to the browser's local storage.
     */
    private saveToLocalStorage() {
        try {
            var storage = window['sessionStorage'];
            FederatedqueryComponent.saveTabId(this.tabId);
            let pairs = new Array(this.variableMap.size);
            let i = 0;
            this.variableMap.forEach((v, k) => {
                pairs[i++] = {name: k, value: v};
            });
            storage.setItem(VariableSetModalComponent.storageName + this.tabId, JSON.stringify(pairs));
        }
        catch (e) {
            throw Utility.sessionError(storage, e);
        }
    }

    public loadFromLocalStorage() {
        this.variableListEl.html('').empty();
        this.variableMap = new Map<string, string>();
        this.rowNameMap = new Map<HTMLElement, string>();
        this.currentNames = new Set<string>();
        this.invalidRows = new Set<HTMLElement>();
        try {
            var storage = window['sessionStorage'];
            let sessionInfo = storage[VariableSetModalComponent.storageName + this.tabId];
            if (sessionInfo != undefined) {
                let rows = JSON.parse(sessionInfo);
                rows.forEach(row => {
                    this.appendVariableRow(row.name, row.value);
                    if(!this.variableMap.has(row.name)) {
                        this.variableMap.set(row.name, row.value);
                    }
                });
            }
        } catch(e) {
            throw Utility.sessionError(storage, e);
        }
    }

    /**
     * Get a copy of the last saved map of variables.
     */
    public getVariableMap(): Map<string, string> {
        let newMap = new Map<string, string>();
        this.variableMap.forEach((v, k) => {
            newMap.set(k, v);
        })
        return newMap;
    }
}
