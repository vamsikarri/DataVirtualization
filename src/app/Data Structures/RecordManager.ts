import { SelectionManager } from '../SelectionManager';
import { SelectionInfo } from '../SelectionInfo';

/**
 * Types of Records that can be tracked.
 */
export enum RecordType {
    Input,
    ForwardDeletion,
    BackwardsDeletion,
    Paste,
    Fill,
    TabForward,
    TabBackward,
    External,
    Drag
} 

/**
 * A minimal record of a state transition.
 */
export class Record {
    /**
     * The selection before this action began.
     */
    startInfo: SelectionInfo;
    /**
     * The selection after this action concluded.
     */
    endInfo: SelectionInfo;
    /**
     * The difference between this.startInfo and this.endInfo
     */
    differenceInfo: SelectionInfo;
    /**
     * The type of Record this is.
     */
    recordType: RecordType;
    /**
     * The prefix used in a fill Record.
     * null iff this.recordType != RecordType.Fill.
     */
    prefix: string;
    /**
     * The option used in a fill Record.
     * null iff this.recordType != RecordType.Fill.
     */
    option: string;
    /**
     * An array of booleans describing which indices were moved backwards in a backwards tab operation.
     */
    tabBackIndices: boolean[];

    constructor(recordType: RecordType) {
        this.recordType = recordType;
        this.startInfo = null;
        this.endInfo = null;
        this.differenceInfo = null;
        this.prefix = null;
        this.option = null;
        this.tabBackIndices = null;
    }
}

/**
 * Class that keeps track of a history of records used to 
 * undo and redo events, while providing methods to add Records.
 */
export class RecordManager {
    private selectionManager: SelectionManager;
    private backHistory: Record[];
    private forwardHistory: Record[];
    private currentRecord: Record;
    recording: boolean;
    recordingInput: boolean;
    recordingDeletion: boolean;
    recordingDrag: boolean;

    constructor(selectionManager: SelectionManager) {
        this.selectionManager = selectionManager;
        this.backHistory = [];
        this.forwardHistory = [];
        this.recording =
        this.recordingInput =
        this.recordingDeletion = 
        this.recordingDrag = false;
    }

    clear() {
        this.backHistory = [];
        this.forwardHistory = [];
        this.currentRecord = null;
        this.recording =
        this.recordingInput =
        this.recordingDeletion = 
        this.recordingDrag = false;
    }

    /**
     * Create a record of the given type from the given function.
     * @param recordType 
     * @param f 
     */
    getRecordFromFunction(recordType: RecordType, f: Function) {
        this.endRecord();
        this.forwardHistory = [];

        let record = new Record(recordType);
        record.startInfo = this.selectionManager.getSelectionInfo();

        // For backwards tabs, store tabBackIndices.
        if(recordType == RecordType.TabBackward) {
            record.tabBackIndices = new Array<boolean>(record.startInfo.selectedRegion.length);
            let tabbed = false;
            for(let i = 0; i < record.startInfo.selectedRegion.length; i++) {
                record.tabBackIndices[i] = record.startInfo.selectedRegion.get(i).textContent.startsWith('\t');
                tabbed = tabbed || record.tabBackIndices[i];
            }

            // If no indices were tabbed backwards, exit early without saving this record.
            if(!tabbed) {
                return;
            }
        }

        f();

        record.endInfo = this.selectionManager.getSelectionInfo();
        record.differenceInfo = 
        this.selectionManager.difference(
                record.startInfo,
                record.endInfo
            );

        this.backHistory.push(record);
    }

    createFillRecord(f: Function, prefix: string, option: string) {
        let record = new Record(RecordType.Fill);
        record.startInfo = this.selectionManager.getSelectionInfo();
        record.prefix = prefix;
        record.option = option;

        f();

        record.endInfo = this.selectionManager.getSelectionInfo();

        // Temporarily set the endOffset of the startInfo to its startOffset in order to create
        // a differenceInfo that covers the full length of the selected option.
        let startSO = record.startInfo.startOffset;
        let startEO = record.startInfo.endOffset;
        record.startInfo.endOffset = record.startInfo.startOffset = record.endInfo.endOffset - option.length;
        record.differenceInfo = this.selectionManager.difference(
            record.startInfo,
            record.endInfo
        );
        record.startInfo.startOffset = startSO;
        record.startInfo.endOffset = startEO;

        this.backHistory.push(record);
    }

    /**
     * Start a new record of Input type, to be completed later.
     * Will halt any other recordings currently running.
     */
    startInputRecord() {
        if(this.recording) {
            this.endRecord();
        }
        this.recording = this.recordingInput = true;
        this.currentRecord = new Record(RecordType.Input);
        this.currentRecord.startInfo = this.selectionManager.getSelectionInfo();
    }

    startDragRecord() {
        if(this.recording && !this.recordingDrag) {
            this.endRecord();
        }
        this.recording = this.recordingDrag = true;
        this.currentRecord = new Record(RecordType.Drag);
        this.currentRecord.startInfo = this.selectionManager.getSelectionInfo();
    }

    /**
     * Start a new record of Deletion type, to be completed later.
     */
    startDeletionRecord(e: KeyboardEvent) {
        if(this.recording && !this.recordingDeletion) {
            this.endRecord();
        }
        let recordType = e.keyCode == 8 ? RecordType.BackwardsDeletion : RecordType.ForwardDeletion;

        if(this.recordingDeletion && this.currentRecord.recordType == recordType) {
            this.continueDeletionRecord();
            return;
        }
        this.endRecord();

        this.recording = this.recordingDeletion = true;
        this.currentRecord = new Record(recordType);
        this.currentRecord.startInfo = this.selectionManager.getSelectionInfo();
        // If there was no initially selected region before this deletion,
        // grab the next character in the given direction and add it to the new record.
        if(
            this.currentRecord.startInfo.selectedText.length == 1 && 
            this.currentRecord.startInfo.selectedText[0].length == 0
        ) {
            this.continueDeletionRecord();
        }
    }

    /**
     * Advance the current deletion record one index forward.
     * Requires that this.recordingDeletion is true.
     */
    continueDeletionRecord() {
        let text = this.currentRecord.startInfo.selectedText;
        if(this.currentRecord.recordType == RecordType.BackwardsDeletion) {
            let nextChar = this.selectionManager.getCharAtSelection(-1);
            if(nextChar == '\n') {
                text.unshift("");
            } else {
                text[0] = nextChar + text[0];
            }
        } else { // ForwardsDeletion
            let nextChar = this.selectionManager.getCharAtSelection(0);
            if(nextChar == '\n') {
                text.push("");
            } else {
                text[text.length - 1] += nextChar;
            }
        }
    }

    /**
     * Cancel the currently recording record.
     */
    cancelRecord() {
        if(!this.recording) { return; }
        this.recording = 
        this.recordingInput = 
        this.recordingDeletion = 
        this.recordingDrag = false;
        this.currentRecord.endInfo = this.selectionManager.getSelectionInfo();
        this.currentRecord = null;
    }

    /**
     * End the current record, if there is one.  Does nothing otherwise.
     */
    endRecord() {
        if(!this.recording) { return; }
        this.forwardHistory = [];
        this.recording = 
        this.recordingInput = 
        this.recordingDeletion = 
        this.recordingDrag = false;
        this.currentRecord.endInfo = this.selectionManager.getSelectionInfo();

        if(this.currentRecord.recordType == RecordType.ForwardDeletion) {
            this.endForwardDeletionRecord();
        }

        // Get difference between startInfo and endInfo

        // Backwards Deletions use a negative difference.
        if(this.currentRecord.recordType == RecordType.BackwardsDeletion) {
            this.currentRecord.differenceInfo = 
            this.selectionManager.difference(
                this.currentRecord.endInfo,
                this.currentRecord.startInfo
            );
        } else {
            this.currentRecord.differenceInfo = 
            this.selectionManager.difference(
                    this.currentRecord.startInfo,
                    this.currentRecord.endInfo
                );
        }
        
        this.backHistory.push(this.currentRecord);
    }

    /**
     * Set the endInfo for a ForwardDeletion Record.
     */
    endForwardDeletionRecord() {
        let startInfo = this.currentRecord.startInfo;
        let endInfo = this.currentRecord.endInfo;
        // Jump the endInfo index down the same number of lines deleted, except the first line.
        endInfo.endIndex = endInfo.startIndex += startInfo.selectedText.length - 1;

        // If the start and end are still on the same line, add the text length to the offset.
        if(endInfo.startIndex == startInfo.startIndex) {
            let delTextLen = startInfo.selectedText[0].length;
            endInfo.startOffset += delTextLen;
            endInfo.endOffset += delTextLen;
        } 
        // Otherwise, set the endInfo's offset to be equal to the length of the last line deleted.
        else {
            endInfo.startOffset = endInfo.endOffset = 
                startInfo.selectedText[startInfo.selectedText.length - 1].length;
        }
    }

    /**
     * Directly set a record to be added to the history of this.
     * @param recordType 
     * @param startInfo 
     * @param endInfo 
     */
    setRecord(recordType: RecordType, startInfo: SelectionInfo, endInfo: SelectionInfo) {
        this.forwardHistory = [];
        this.endRecord();

        let record = new Record(recordType);
        record.startInfo = startInfo;
        record.endInfo = endInfo;
        record.differenceInfo = 
        this.selectionManager.difference(
            record.startInfo,
            record.endInfo
        );

        this.backHistory.push(record);
    }

    /**
     * Get the latest Record if there is one, null otherwise.
     */
    undo(): Record {
        if(this.backHistory.length == 0) { return null; }

        let back = this.backHistory.pop();
        this.forwardHistory.push(back);
        return back;
    }

    /**
     * Get the next Record if there is one, null otherwise.
     */
    redo(): Record {
        if(this.forwardHistory.length == 0) { return null; }
        
        let forward = this.forwardHistory.pop();
        this.backHistory.push(forward);
        return forward;
    }
}