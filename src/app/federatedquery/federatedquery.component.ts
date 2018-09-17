import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { FederateqService } from '../federateq.service';
import * as Plotly from 'plotly.js';
import * as XLSX from 'xlsx';
import { Utility } from '../Utility';
import { QueryEditorComponent } from '../query-editor/query-editor.component';
import { Subscription } from 'rxjs';
import { VariableSetModalComponent } from '../variable-set-modal/variable-set-modal.component';
import { SchedulerComponent } from '../scheduler/scheduler.component';
import { Tabbable, Tab } from '../tab-manager/tab-manager.component';

declare var $: any;

export enum GraphType {
    Lines,
    Markers,
    Bar,
    Pie,
    Scatter,
    LinesAndMarkers
}

@Component({
    selector: 'app-federatedquery',
    templateUrl: './federatedquery.component.html',
    styleUrls: ['./federatedquery.component.css']
})
export class FederatedqueryComponent implements OnInit, AfterViewInit, Tabbable {

    public static readonly savedTabIdStorageName = 'federatedTabIds';

    public tabId: number;
    public tab: Tab;

    dataVisualizationResults;

    body: HTMLElement;
    messageDisplay: JQuery<HTMLElement>;
    xAxisSelection: JQuery<HTMLElement>;
    yAxisSelection: JQuery<HTMLElement>;

    uploadFile: File;
    parseFile: File;
    arrayBuffer;
    selectedFiles: FileList;

    // Boolean indicating whether or not the UI can take any queries at the moment.
    queriable: boolean;

    // The Subscription for a query request.
    querySubscription: Subscription;

    //Constructor with service 
    constructor(private federateService: FederateqService, el: ElementRef) {
        this.body = el.nativeElement;
        this.uploadFile = null;
        this.parseFile = null;
    }

    @ViewChild(QueryEditorComponent) public editor: QueryEditorComponent;
    @ViewChild(VariableSetModalComponent) private variableSet: VariableSetModalComponent;
    @ViewChild(SchedulerComponent) private scheduler: SchedulerComponent;

    /**
     * Get all of the tab ids saved in local storage.
     */
    public static getSavedTabIds(): number[] {
        try {
            var storage = window['sessionStorage'];
            let ids = storage[FederatedqueryComponent.savedTabIdStorageName];
            if (ids == undefined) {
                return [];
            }

            return JSON.parse(ids);
        } catch (e) {
            throw Utility.sessionError(storage, e);
        }
    }

    /**
     * Save the given id in local storage.
     * @param id 
     */
    public static saveTabId(id: number) {
        try {
            var storage = window['sessionStorage'];
            let ids = storage[FederatedqueryComponent.savedTabIdStorageName];
            if (ids == undefined) {
                ids = [];
            } else {
                ids = JSON.parse(ids);
            }
            if (!ids.includes(id)) {
                ids.push(id);
                storage.setItem(FederatedqueryComponent.savedTabIdStorageName, JSON.stringify(ids));
            }
        } catch (e) {
            throw Utility.sessionError(storage, e);
        }
    }

    /**
     * Remove the given id from local storage.
     * @param id 
     */
    public static removeTabId(id: number) {
        try {
            var storage = window['sessionStorage'];
            let ids = storage[FederatedqueryComponent.savedTabIdStorageName];
            if (ids != undefined) {
                ids = JSON.parse(ids);
                if (ids.includes(id)) {
                    ids.splice(ids.indexOf(id), 1);
                    storage.setItem(FederatedqueryComponent.savedTabIdStorageName, JSON.stringify(ids));
                }
            }
        } catch (e) {
            throw Utility.sessionError(storage, e);
        }
    }

    ngOnInit() {
        //Materialize form select options dropdown initialization
        // $(this.body).find('select').formSelect();

        //Materialize Modal initialization
        $(this.body).find('.modal').modal();

        // Setup modal buttons
        $(this.body).find('.save-query').on('click', () => {
            $(this.body).find('.save-modal').modal('open');
        });

        $(this.body).find('.upload-file').on('click', () => {
            $(this.body).find('.upload-modal').modal('open');
        });

        $(this.body).find(".nav-item").click((event) => {
            // Activate the selected tab while de-activating all others
            let target = $(event.target).closest('.nav-item');
            target.children().first().addClass("active");
            target.siblings('.nav-item').each((i, el) => {
                $(el).children().first().removeClass("active");
            });

            // Open the corresponding tab
            let tab = $(this.body).find(target.attr('href'));
            tab.addClass('active');
            tab.siblings('.tab-pane').each((i, el) => {
                $(el).removeClass("active");
            });
        });

        // Insert old queries in the editor upon double click.
        $(this.body).find('.saved-query-tab, .query-history-tab').on('dblclick', '.query-data', () => {
            this.editor.replaceSelectedRegionFromExternal(
                Utility.splitText((event.target as any).textContent)
            );
        });

        // Start a scheduler prompt with the ID of the same row already filled out.
        $(this.body).find('.saved-query-tab').on('click', '.schedule', () => {
            let target: any = event.target;
            this.scheduler.open($(target).closest('tr').find('.query-id').text());
        });


        $(this.body).find('.query-history-tab').on('click', '.history-query-results', (event) => {
            event.stopImmediatePropagation();
            if (!this.queriable) {
                return;
            }
            var tablehistoryquery = $(event.target).closest('tr').find('.query-data').text();
            var tablequerystarttime = $(event.target).closest('tr').find('.historyquerystrttm').text();

            this.hideMessage();
            this.toggleQueryUI(false);
            this.querySubscription = this.federateService.getFederationHistoryQuery(tablehistoryquery, tablequerystarttime).subscribe(
                (results) => {
                    this.dataVisualizationResults = JSON.stringify(results);
                    if (results.length > 0) {
                        // Navigate to Query Results and create a data table.
                        this.createQueryDataTable(results);
                    }
                    else {
                        this.displayFailureMessage('Error Message: Results not Found!');
                    }
                },
                (error) => {
                    this.displayFailureMessage(error);
                    this.toggleQueryUI(true);
                },
                () => {
                    this.toggleQueryUI(true);
                    $(this.body).find('.query-results').click();
                    $($.fn.dataTable.tables(true)).DataTable()
                        .columns.adjust();
                }
            );
        });

        /**
         * Get the Results of Scheduled Query
         */
        $(this.body).find('.scheduled-query-tab').on('click', '.scheduled-query-results', (event) => {
            event.stopImmediatePropagation();
            if (!this.queriable) {
                return;
            }
            var jobname = $(event.target).closest('tr').find('.scheduled-job-name').text();

            this.hideMessage();
            this.toggleQueryUI(false);
            this.querySubscription = this.federateService.getScheduledQueryresults(jobname).subscribe(
                (results) => {
                    this.dataVisualizationResults = JSON.stringify(results);
                    if (results.length > 0) {
                        // Navigate to Query Results and create a data table.
                        $(this.body).find('.query-results').click();
                        this.createQueryDataTable(results);
                    }
                    else {
                        this.displayFailureMessage('Error Message: Results not Found!');
                    }
                },
                (error) => {
                    this.displayFailureMessage(error);
                    this.toggleQueryUI(true);
                },
                () => {
                    this.toggleQueryUI(true);
                }
            );
        });
        // Generate a tde file from Tableau
        let self = this;
        $(this.body).find('.createTDE').click(function () {
            let selectedText: string = self.getSelection();
            self.toggleQueryUI(false);

            if (window.getSelection) {
                selectedText = window.getSelection().toString();
                self.querySubscription = self.federateService.generateTDEfile(selectedText).subscribe(
                    (results) => {
                        self.toggleQueryUI(true);
                        self.displaySuccessMessage("Successfully Generated Tableau TDE File");
                    },
                    (error) => {
                        self.toggleQueryUI(true);
                        self.displayFailureMessage("Error Generating Tableau TDE File");
                    });
            }
        });
    }

    /**
     * Change the graphs onChange
     */
    plotGraph() {
        var selconx = this.xAxisSelection.val() as string;
        var selcony = this.yAxisSelection.val() as string;
        let selectedVisual = GraphType[$(this.body).find('.getGraphvaldat').val() as string];

        // If there is no x value, or there is no y value and it's required, abort.
        if (selconx == undefined || (selectedVisual != GraphType.Pie && selcony == undefined)) {
            return;
        }
        let resultset = JSON.parse(this.dataVisualizationResults);


        let xValues = new Array(resultset.length), yValues = new Array(resultset.length);
        for (var i = 0; i < resultset.length; i++) {
            xValues.push(resultset[i][selconx]);
            yValues.push(resultset[i][selcony]);
        }

        let trace: any = {
            x: xValues,
            y: yValues
        }
        let layout = {};

        switch (GraphType[$(this.body).find('.getGraphvaldat').val() as string]) {
            case GraphType.Bar:
                trace['type'] = 'bar';
                trace['orientation'] = 'v';
                layout = { barmode: 'stack' };
                break;
            case GraphType.Pie:
                let frequencies = Utility.getFrequencyMap(xValues);
                trace = {
                    values: Array.from(frequencies.values()),
                    labels: Array.from(frequencies.keys()),
                    type: 'pie'
                }
                break;
            case GraphType.Scatter:
                trace['fill'] = 'tozeroy';
                trace['type'] = 'scatter';
                break;
            case GraphType.Lines:
            default:
                trace['mode'] = 'lines';
                trace['opacity'] = 0.5;
                trace['marker'] = {
                    color: 'red',
                    size: 20
                };
                layout = { title: '', showlegend: false };
        }

        let tab = $(this.body).find('.datavisualizationquerytab');
        tab.html('').empty();
        Plotly.newPlot(tab.get(0), [trace], layout);
    }

    /**
     * Format the visualization tab depending on its current state.
     */
    formatVisualizationOptions() {
        let selectedVisual = GraphType[$(this.body).find('.getGraphvaldat').val() as string];
        if(selectedVisual == GraphType.Pie) {
            this.yAxisSelection.parent().hide(100);
        } else {
            this.yAxisSelection.parent().show(100);
        }
    }

    //upload a excel file for data visualization
    selectParseFile(event) {
        this.parseFile = event.target.files[0];
    }


    /**
     * Parse the excel sheet given by the user.
     */
    parseExcel() {
        if (this.parseFile == null) {
            return;
        }

        let fileReader = new FileReader();
        fileReader.onload = (e) => {
            // Load file as binary
            let data = new Uint8Array(fileReader.result as ArrayBuffer);
            let arr = new Array(data.length);
            for (let i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);

            // Load as Excel and convert to CSV
            let workbook = XLSX.read(arr.join(""), { type: "binary" });
            let worksheet = workbook.Sheets[workbook.SheetNames[0]];


            let csv = XLSX.utils.sheet_to_csv(worksheet);
            let rows = csv.match(/("[^"]*"|[^\n])+/gm);
            let csvMap = new Array(rows.length);
            for (let i = 0; i < rows.length; i++) {
                csvMap[i] = rows[i].match(/("[^"]*"|[^,])*/gm).filter((cell, index, row) => {
                    // Because regex will append empty strings to every result, we'll need to manually get rid of each invalid empty string.
                    // Note that some empty strings ARE valid (empty cells).
                    return index == 0 || cell.length > 0 || row[index - 1].length == 0;
                });
            }

            // Convert CSV to JSON
            let header = csvMap[0];
            let json = new Array(csvMap.length - 1);
            for (let i = 1; i < csvMap.length; i++) {
                let jsonRow = {};
                for (let j = 0; j < header.length; j++) {
                    jsonRow[header[j]] = csvMap[i][j];
                }
                json[i - 1] = jsonRow;
            }
            this.dataVisualizationResults = JSON.stringify(json);

            // Set axis options
            this.setAxisOptions(header);
            $(this.body).find('.datacolumnsinfoviz').removeClass("indeterminate");
        }
        fileReader.readAsArrayBuffer(this.parseFile);
        $(this.body).find('.datacolumnsinfoviz').addClass("indeterminate");
    }

    //get the federated Query History 
    getQueryHistorytab() {
        this.hideMessage();
        let divContainer = $(this.body).find('.query-history-tab');
        //Get the json data and display as a dynamic datatable
        this.federateService.getFederatedQueryHistory().subscribe(
            (results) => {
                if (results.length > 0) {
                    if (!results) {
                        return;
                    }

                    var table = document.createElement("table");
                    table.setAttribute('class', 'mdl-data-table history-table');
                    divContainer.html(table);

                    this.createDataTable(results, table, {
                        columnDefs:
                            [
                                {
                                    targets: [1],
                                    render: function (data) {
                                        return `<span class = 'query-data'>${data}</span>`;
                                    }
                                },
                                {
                                    targets: [2],
                                    render: function (data) {
                                        return `<a class = 'history-query-results'>${data}</a>`;
                                    }
                                },
                                {
                                    targets: [5],
                                    render: function (data) {
                                        return `<span class = '${data == 'Failed' ? 'history-failure' : 'history-success'}'>${data}</span>`;
                                    }
                                },
                                {
                                    targets: [4],
                                    className: 'historyquerystrttm'
                                },
                            ],
                        order: [[4, "desc"]]
                    });
                }
                else {
                    this.displayFailureMessage("Query History Results not Found!");
                }
            },
            (error) => {
                this.displayFailureMessage();
            },
            () => {
                divContainer.attr('data-target', '.query-history-tab');
                divContainer.tab('show');
                divContainer.removeAttr('data-target');
                $($.fn.dataTable.tables(true)).DataTable()
                    .columns.adjust();
            }
        );
    }
    //give name to a query 
    setNameToSaveQuery() {
        var qname = $(this.body).find('.svdqrynm').val();
        var qdescription = $(this.body).find('.svdqrydesc').val();
        this.hideMessage();

        this.federateService.getFederatedSavedQueryname(this.getSelection(), qdescription, qname).subscribe(
            (results) => {
                this.displaySuccessMessage(results);
            },
            (error) => {
                this.displayFailureMessage(error);
            },
            () => {
                $(this.body).find('.query-results').click();
            }
        );
    }

    //get the Saved Queries for User
    getSavedQueriesTab() {
        this.hideMessage();
        let divContainer = $(this.body).find('.saved-query-tab');
        this.federateService.getFederatedSavedQuery().subscribe(
            (results) => {
                if (results.length > 0) {
                    if (!results) {
                        return;
                    }
                    let table = document.createElement("table");
                    table.setAttribute('class', 'mdl-data-table saved-table');
                    divContainer.html(table);

                    this.createDataTable(results, table,
                        {
                            columnDefs: [
                                {
                                    targets: [1],
                                    render: function (data) {
                                        return `<a class = 'schedule'>${data}</a>`;
                                    }
                                },
                                {
                                    targets: [3],
                                    render: function (data) {
                                        return `<span class = 'query-id'>${data}</span>`;
                                    }
                                },
                                {
                                    targets: [5],
                                    render: function (data) {
                                        return `<span class = 'query-data'>${data}</span>`;
                                    }
                                }
                            ],
                            order: [[0, "desc"]]
                        }
                    );
                }
                else {
                    this.displayFailureMessage("Saved Queries Results not Found!");
                }
            },
            (error) => {
                this.displayFailureMessage();
            },
            () => {
                divContainer.attr('data-target', '.saved-query-tab');
                divContainer.tab('show');
                divContainer.removeAttr('data-target');
                $($.fn.dataTable.tables(true)).DataTable()
                    .columns.adjust();
            }
        );
    }

    /**
     * Display the Scheduler Results in a Datatable
     */
    getSchedulerResultsTab() {
        this.hideMessage();
        let divContainer = $(this.body).find('.scheduled-query-tab');
        this.federateService.getScheduledQueryInfo().subscribe(
            (results) => {
                if (results.length > 0) {
                    if (!results) {
                        return;
                    }
                    var table = document.createElement("table");
                    table.setAttribute('class', 'mdl-data-table scheduled-table');
                    divContainer.html(table);

                    this.createDataTable(results, table,
                        {
                            columnDefs: [
                                {
                                    targets: [1],
                                    className: 'query-data'
                                },
                                {
                                    targets: [0],
                                    render: function (data) {
                                        return `<span class = '${data == 'FAILED' ? 'schedule-failure' : 'schedule-success'}'>${data}</span>`;
                                    }
                                },
                                {
                                    targets: [2],
                                    render: function (data) {
                                        if (data == 'Results') {
                                            return `<a class = 'scheduled-query-results'>${data}</a>`;
                                        }
                                        else {
                                            return data;
                                        }

                                    }
                                },
                                {
                                    targets: [3],
                                    className: 'scheduled-job-name'
                                }
                            ]
                        }
                    );
                }
                else {
                    this.displayFailureMessage("Scheduled Queries Results not Found!");
                }
            },
            (error) => {
                this.displayFailureMessage();
            }, () => {
                divContainer.attr('data-target', '.scheduled-query-tab');
                divContainer.tab('show');
                divContainer.removeAttr('data-target');
                $($.fn.dataTable.tables(true)).DataTable()
                    .columns.adjust();
            }
        );
    }
    /**
     * Display the Query Results in a Datatable
     */
    executeQuery() {
        // If the UI cannot take requests right now, abort.
        if (!this.queriable) {
            return;
        }

        this.editor.saveToLocalStorage();
        var start = Date.now();
        this.hideMessage();

        // Get the selection that will be used as a query
        let selectedText = this.getSelection();

        let tokens = this.editor.styleTokenize(selectedText);
        if (tokens == null) {
            tokens = [""];
        }
        this.toggleQueryUI(false);

        // Check if this is a copy operation
        if (tokens[0].toUpperCase() == "COPY") {
            this.querySubscription = this.federateService.setFederatedTableDifFileFormats(selectedText).subscribe(
                (results) => {
                    this.displaySuccessMessage(results);
                },
                (error) => {
                    this.displayFailureMessage(error);
                    this.toggleQueryUI(true);
                },
                () => {
                    this.toggleQueryUI(true);
                }
            )
        }
        // Otherwise, it's a standard query
        else {
            // Find all user variable tokens and replace them with their values
            let tIndex = 0;
            let varMap = this.variableSet.getVariableMap();
            tokens.forEach(token => {
                if (this.editor.tokenIsUserVariable(token)) {
                    let name = token.substring(2, token.length - 1).trim();
                    if (varMap.has(name)) {
                        selectedText = selectedText.substring(0, tIndex) + varMap.get(name) + selectedText.substring(tIndex + token.length);
                        tIndex += varMap.get(name).length;
                    } else {
                        tIndex += token.length;
                    }
                } else {
                    tIndex += token.length;
                }
            });

            // Get the json data and display as a dynamic datatable
            this.querySubscription = this.federateService.getFederatedata(selectedText).subscribe(
                (results) => {
                    this.dataVisualizationResults = JSON.stringify(results);

                    if (results.hasOwnProperty('error')) {
                        this.displayFailureMessage(results['error']);
                        return;
                    }

                    // Navigate to Query Results and create a new table.
                    this.createQueryDataTable(results, start);
                },
                (error) => {
                    this.displayFailureMessage();
                    this.toggleQueryUI(true);
                },
                () => {
                    this.toggleQueryUI(true);
                    $(this.body).find('.query-results').click();
                    $($.fn.dataTable.tables(true)).DataTable()
                        .columns.adjust();
                }
            );
        }
    }

    /**
     * Clear the visualization content data
     */
    clearVisualContent() {
        $(this.body).find(".taborup input:radio").attr('checked', false);
        $(this.body).find('.appxdat').html('').empty();
        $(this.body).find('.appydat').html('').empty();
        $(this.body).find('.datavisualizationquerytab').html('').empty();
        $(this.body).find('.datavisualizationquerytablinem').html('').empty();
    }

    /**
     * Open the tab responsible for data visualizations.
     */
    openVisualizationTab() {
        var col = [];
        $(this.body).find('.radtaborup').hide();
        var table = $(this.body).find('.query-results-table').DataTable();
        table.columns().every(function (fed) {
            return function () {
                col.push(this.header().innerHTML);
                fed.setAxisOptions(col);
            }
        }(this));
        let divContainer = $(this.body).find('.data-viz-queries');
        divContainer.attr('data-target', '.data-viz-tab');
        divContainer.tab('show');
        divContainer.removeAttr('data-target');
        $($.fn.dataTable.tables(true)).DataTable()
        .columns.adjust();
    }

    upload() {
        this.federateService.uploadfile(this.uploadFile);
    }

    selectUploadFile(event) {
        this.uploadFile = event.target.files[0];
    }

    /**
     * Get the selected text as a string.  If there is nothing selected, get all of the editor's contents instead.
     */
    getSelection(): string {
        let info = this.editor.selectionManager.getSelectionInfo();
        if (info == null || info.selectionIsEmpty()) {
            return this.editor.contentsToString();
        } else {
            return info.selectionToString();
        }
    }

    /**
     * Toggle the UI elements involving query requests.
     * @param queriable The state the UI will be set to.  True to let the UI execute more queries; false for otherwise.
     */
    toggleQueryUI(queriable: boolean) {
        this.queriable = queriable;

        // Set the progress bar
        $(this.body).find('.prgbar').toggleClass("indeterminate", !queriable);
        $(this.body).find('.prgbar').toggleClass("determinate", queriable);
        if (this.tab) {
            this.tab.setLoading(!queriable);
        }

        // Toggle interactibility of the relevant UI elements.
        this.toggleButton($(this.body).find(".execute-query"), queriable);
        this.toggleButton($(this.body).find(".stop-query"), !queriable);
    }

    /**
     * Toggle the given button to be on or off.
     * @param button JQuery reference to the button to be toggled.
     * @param enabled The state the button will be set to.  True for on; false for off.
     */
    toggleButton(button: JQuery<HTMLElement>, enable: boolean) {
        if (enable) {
            button.removeClass("button-disabled");
            button.addClass("waves-effect waves-light");
        } else {
            button.addClass("button-disabled");
            button.removeClass("waves-effect waves-light");
        }
    }

    /**
     * Stop the currently executing query, if there is one.
     * If there are no queries currently being executed, do nothing.
     */
    stopQuery() {
        if (this.queriable) { return; }

        this.querySubscription.unsubscribe();
        this.toggleQueryUI(true);
    }

    /**
     * Using the given rows, create a new data table in the query results tab.
     * @param rows 
     * @param startTime Optional parameter.  If supplied, this will function also display a success message upon completion.
     */
    createQueryDataTable(rows, startTime: number = null) {
        // If this function received a start time, get the end time.
        var elapsed: number;
        if (startTime != null) {
            elapsed = (Date.now() - startTime) / 1000;
        }

        // Create DOM table to receive DataTable
        var table = document.createElement("table");
        table.setAttribute('class', 'mdl-data-table query-results-table');
        var divContainer = $(this.body).find('.query-results-tab').get(0);
        divContainer.innerHTML = "";
        divContainer.appendChild(table);

        let header = this.createDataTable(rows, table, { buttons: ['copy', 'csv', 'excel', 'print'] });
        this.setAxisOptions(header);

        // If this function received a start time, set the success message.
        if (startTime != null) {
            this.displayQuerySuccessMessage(rows.length, elapsed);
        }
    }

    /**
     * Create a new data table at the given dom element with the given rows.
     * @param rows 
     * @param dom 
     * @param options Optional parameter of DataTable options to set the created DataTable with.  Note that it is not possible to override
     * any of the options explicitly required for a federatedquery data table.
     */
    createDataTable(rows, dom: HTMLElement, options = null): string[] {
        // Get the column names out of the first row
        let header = Object.getOwnPropertyNames(rows[0]);
        let columns = new Array(header.length);
        for (let i = 0; i < header.length; i++) {
            columns[i] = { title: header[i] };
        }

        // Each element of the row is a JSON object, so replace them with
        // an array of strings representing the properties of the original object.
        for (let i = 0; i < rows.length; i++) {
            let rowOb = rows[i];
            let row = new Array(header.length);
            for (let j = 0; j < header.length; j++) {
                let property = Object.getOwnPropertyDescriptor(rowOb, header[j]);
                row[j] = typeof (property) == "undefined" ? "null" : property.value;
            }
            rows[i] = row;
        }

        // Fill a new DataTable with the rows and columns
        let tableOptions = {
            dom: 'frtip',
            data: rows,
            columns: columns,
            searching: true,
            scrollX: true,
            bInfo: false,
            bDestroy: true,
            deferRender: true
        };

        // Load all given options without overriding any required ones
        let blockedOptions = Object.getOwnPropertyNames(tableOptions);
        let newOptions = Object.getOwnPropertyNames(options);
        newOptions.forEach((option) => {
            if (!blockedOptions.includes(option)) {
                tableOptions[option] = options[option];
            }
        });
        if(newOptions.includes('buttons')) {
            tableOptions.dom = 'B' + tableOptions.dom;
        }

        // Set the data table and return the header.
        $(dom).DataTable(tableOptions);
        return header;
    }

    /**
     * Set the axis options for the visualization equal to the given array of strings.
     * @param options 
     */
    setAxisOptions(options: string[]) {
        let axes = this.xAxisSelection.add(this.yAxisSelection);
        axes.html('').empty();

        let values = options.map(el => `<option value="${el}">${el}</option>`).join('');
        axes.append(values);
        (axes as any).formSelect();
        this.formatVisualizationOptions();
    }

    /**
     * Hide the currently displayed message.
     */
    hideMessage() {
        this.messageDisplay.removeClass();
        this.messageDisplay.addClass('message-display');
        this.messageDisplay.empty();
    }

    /**
     * Display a query success message with the given row count and elapsed time.
     * @param rowCount 
     * @param elapsedTime 
     */
    displayQuerySuccessMessage(rowCount: number, elapsedTime: number) {
        this.hideMessage();
        this.messageDisplay.html('<i class="fa fa-check"></i> ');
        this.messageDisplay.append('Done. Results Obtained with row count ' +
            "<b>" + rowCount + "</b>" + " and Query Execution time is <b>"
            + elapsedTime + "</b> seconds"
        );
        this.messageDisplay.addClass("alert alert-success");

        if (!this.tab.isActive()) {
            this.tab.setSuccess();
        }
    }

    /**
     * Display a generic success message to the view.
     * @param message 
     */
    displaySuccessMessage(message: string) {
        this.hideMessage();
        this.messageDisplay.append(message);
        this.messageDisplay.addClass("alert alert-success");

        if (!this.tab.isActive()) {
            this.tab.setSuccess();
        }
    }

    /**
     * Display the error given message to the view.  If no message is supplied, a default message will be used instead.
     * @param message
     */
    displayFailureMessage(message: string = null) {
        this.hideMessage();
        message = message != null ? message : 'Problem with the service!'
        this.messageDisplay.append(message);
        this.messageDisplay.addClass("alert alert-danger");

        if (!this.tab.isActive()) {
            this.tab.setError();
        }
    }
    /**
     * Open the scheduler with the current editor selection.
     */
    openScheduler() {
        this.scheduler.openFromQuery(this.getSelection());
    }

    /**
     * Open the variable set vmodal with the current editor selection.
     */
    openVariableSet() {
        let tokens = this.editor.styleTokenize(this.getSelection());
        if (tokens == null) {
            tokens = [];
        }

        this.variableSet.openWithNewNames(
            tokens.filter(token => this.editor.tokenIsUserVariable(token)).map(token => token.substring(2, token.length - 1).trim())
        );
    }

    close() {
        this.stopQuery();

        // Remove the id from localstorage if it has been saved
        FederatedqueryComponent.removeTabId(this.tabId);
    }

    setTabId(id: number) {
        this.tabId = id;
        this.variableSet.tabId = this.tabId;
        this.editor.tabId = this.tabId;
    }

    loadFromLocalStorage() {
        if (FederatedqueryComponent.getSavedTabIds().includes(this.tabId)) {
            this.variableSet.loadFromLocalStorage();
            if (Utility.formatSelectQueryTokens(Utility.mapURIQuery()).length == 0) {
                this.editor.loadFromLocalStorage();
            }
        }
    }

    ngAfterViewInit() {
        this.messageDisplay = $(this.body).find('.message-display');
        this.xAxisSelection = $(this.body).find('.appxdat');
        this.yAxisSelection = $(this.body).find('.appydat');

        $(document).ready(() => {
            $(this.body).find('select').formSelect();
            $(this.body).find('.collapsible').collapsible();
            $(this.body).find('.datepicker').datepicker({format: 'yyyy-mm-dd'});
            $(this.body).find('.timepicker').timepicker({twelveHour: false});
        });

        //Clear the Query Editor, Display Message and Tabs content 
        $(this.body).find('.editor-clear').on('click', () => {
            this.editor.resetView();
            this.hideMessage();
            this.toggleQueryUI(true);
        });

        // Visualize Data from Excel sheet
        $(this.body).find('.upload-file-button').hide();
        $(this.body).find('.prgbarviz').hide();
        $(this.body).find('.getGraphvaldatType').change(() => {
            var viztyp = $(this.body).find('.getGraphvaldatType').val();
            if (viztyp == 'file') {
                $(this.body).find('.upload-file-button').show();
                $(this.body).find('.prgbarviz').show();
            } else {
                $(this.body).find('.upload-file-button').hide();
                $(this.body).find('.prgbarviz').hide();
            }
        });

        $(this.body).find('.editor-format').on('click', () => this.editor.format());

        // Start with the stop button disabled
        this.toggleQueryUI(true);
    }
}
