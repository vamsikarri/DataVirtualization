import { Directive, HostListener } from '@angular/core';
import { NavbarComponent } from './navbar/navbar.component';

@Directive({
    selector: '[appNavbar]'
})
export class NavbarDirective {

    private searchTimer;
    private searchTimerWait: number = 200;

    constructor(private parentCmp: NavbarComponent) { 
        this.searchTimer = null;
    }

    @HostListener('click', ['$event']) onClick(e) {
        let target = this.getMouseTarget(e);

        if (target.id == "nav-back") {
            this.parentCmp.navigateBack();
        } else if (target.id == "nav-forward") {
            this.parentCmp.navigateForward();
        } else if (target.id == "nav-refresh") {
            this.parentCmp.refresh();
        } else if ($(target).hasClass("nav-child")) {
            this.parentCmp.navigateOnChild($(target).index());
        }

        $("#nav-context-menu").hide(100);
    }

    @HostListener('dblclick', ['$event']) onDblClick(e) {
        let target = this.getMouseTarget(e);
        if ($(target).hasClass("nav-child")) {
            this.parentCmp.placeChild($(target).index());
        }
    }

    @HostListener('input') oninput() {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(
            () => this.parentCmp.search($("#nav-search").val() as string),
            this.searchTimerWait
        );
    }

    @HostListener('contextmenu', ['$event']) oncontextmenu(e) {
        let target = this.getMouseTarget(e);

        if($(target).hasClass('nav-child')) {
            e.preventDefault();
            this.parentCmp.drawContextMenu($(target).index(), e);
        }
    }

    private getMouseTarget(e): any {
        let target = e.target;
        if($(target).hasClass('search-sel')) {
            target = target.parentElement;
        }
        if($(target).hasClass("ui-draggable") && !$(target).hasClass("ui-draggable-dragging'")) {
            target = target.parentElement;
        }
        else if(target.localName == "img") {
            target = target.parentElement;
        }
        return target;
    }
}
