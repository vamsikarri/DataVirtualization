import { Component, ElementRef, HostListener, AfterViewInit } from '@angular/core';

/**
 * Abstract class of which all modal-based components should extend.
 * In order to use, the component html must have the following elements at the root:
 * (Optional) One with class 'btn' that will be the button triggering the modal's appearance, and
 * One with class 'modal' that will be the modal itself.
 */
export abstract class ModalComponent implements AfterViewInit {
    protected body: HTMLElement;

    constructor(el: ElementRef) {
        this.body = el.nativeElement;
    }

    ngAfterViewInit() {
        // Initialize the modal to be hidden.
        $(this.body).children('.modal').hide();
    }

    @HostListener('click', ['$event']) onClick(e) {
        if(e.target == $(this.body).children('.btn').get(0)) {
            this.openModal();
        }
    }

    /**
     * Open the modal
     */
    protected openModal() {
        ($(this.body).children('.modal') as any).modal({
            onCloseEnd: () => this.closeModal()
        }).modal('open');
    }

    protected abstract closeModal();

}
