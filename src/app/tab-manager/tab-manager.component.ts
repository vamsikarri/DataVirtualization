import { Component, ElementRef, ComponentFactoryResolver, ComponentFactory, ReflectiveInjector, ViewContainerRef, ApplicationRef, EmbeddedViewRef, AfterContentInit, HostListener, ComponentRef } from '@angular/core';
import { FederatedqueryComponent } from '../federatedquery/federatedquery.component';
import { IdPool } from '../Data Structures/IdPool';

/**
 * Interface representing static members that must be present in all classes that implement Tabbable.
 */
export interface TabbableClass {
    getSavedTabIds: () => number[]
}

/**
 * Interface to be implemented by any elements managable by TabManagerComponent.
 */
export interface Tabbable {
    tabId: number,
    setTabId: (id: number) => void,
    close: () => void,
    loadFromLocalStorage: () => void,
    tab: Tab
}

export class Tab {
    html: HTMLElement;
    tabManager: TabManagerComponent;
    defaultClasses: string;
    name: string;

    constructor(tab: HTMLElement, tabManager: TabManagerComponent, name: string) {
        this.html = tab;
        this.name = name;
        this.tabManager = tabManager;
        this.defaultClasses = tab.classList.toString();
    }

    public isActive(): boolean {
        return this.tabManager.activeTab == this.html;
    }

    public setSuccess(state: boolean = true) {
        $(this.html).toggleClass('tab-success', state);
    }

    public setError(state: boolean = true) {
        $(this.html).toggleClass('tab-danger', state);
    }

    public setLoading(state: boolean = true) {
        $(this.html).toggleClass('loading-shimmer', state);
    }

    /**
     * Clear all styles based off of the state of this tab.
     * @param force Optional boolean value indicating whether or not to clear styles that are strictly tied to state (like the loading bar style)
     */
    public clearStateStyling(force: boolean = false) {
        this.setError(false);
        this.setSuccess(false);
        if (force) {
            this.setLoading(false);
        }
    }
}

@Component({
    selector: 'app-tab-manager',
    templateUrl: './tab-manager.component.html',
    styleUrls: ['./tab-manager.component.css'],
    entryComponents: [
        FederatedqueryComponent
    ]
})
export class TabManagerComponent implements AfterContentInit {

    newTabButton: HTMLElement;
    tabContent: HTMLElement;

    factory: ComponentFactory<any>;
    injector: ReflectiveInjector;
    components: Set<ComponentRef<any>>;
    idPool: IdPool;
    idCollisionMap: Map<number, number>;

    tabComponentMap: Map<HTMLElement, ComponentRef<any>>;
    activeTab: HTMLElement;
    tabCount: number;


    ngAfterContentInit() {
        // Cache static DOM references.
        this.newTabButton = $(this.el.nativeElement).find('.new-tab').get(0);
        this.tabContent = $(this.el.nativeElement).find('.tab-content').get(0);

        // Initialize with the tabs created during startup.
        let savedIds = this.idPool.getMissingValues();
        let cmpIterator = this.components.keys();
        for(let i = 0; i < savedIds.length; i++) {
            let component = cmpIterator.next().value;
            this.assignTabToComponent(component, savedIds[i]);
            (component.instance as Tabbable).loadFromLocalStorage();
        }

        // Start with the first one selected.
        this.selectTab($('.tab-container').children().get(0));
    }

    constructor(private el: ElementRef, cmpFctryRslvr: ComponentFactoryResolver, vcr: ViewContainerRef, private appRef: ApplicationRef) {
        this.tabComponentMap = new Map<HTMLElement, ComponentRef<any>>();
        this.idCollisionMap = new Map<number, number>();
        this.components = new Set<ComponentRef<any>>();
        this.tabCount = 0;

        this.factory = cmpFctryRslvr.resolveComponentFactory(FederatedqueryComponent);
        this.injector = ReflectiveInjector.fromResolvedProviders([], vcr.parentInjector);
        this.idPool = new IdPool();

        // Make a new tab for each id that has an associated saved value, or just a default initial one. 
        let savedIds = (FederatedqueryComponent as TabbableClass).getSavedTabIds();
        if (savedIds.length == 0) {
            savedIds.push(0);
        }
        savedIds.forEach(id => {
            this.idPool.take(id);
            this.components.add(this.appendNewComponent());
        });
    }

    @HostListener('click', ['$event']) onclick(e) {
        let target = e.target;
        if (target == this.newTabButton) {
            this.createNewComponentTab();
        } else if (this.tabComponentMap.has(target) && target != this.activeTab) {
            this.selectTab(target);
        } else if ($(target).hasClass('clear-tab')) {
            this.removeTab(target.parentElement);
        }
    }

    /**
     * Remove given the tab and all associated references.
     * @param tab 
     */
    removeTab(tab: HTMLElement) {
        // Remove the component
        let component = this.tabComponentMap.get(tab);
        this.components.delete(component);
        this.appRef.detachView(component.hostView);
        $((component.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement).remove();

        // Close the component
        (component.instance as Tabbable).close();

        // Handle the removal of its id
        this.removeTabId((component.instance as Tabbable));

        // If the removed tab is selected, then move the selection to the next tab, if possible.
        if (tab == this.activeTab && this.tabCount > 1) {
            let index = $(tab).index();
            let siblings = $(tab).siblings().filter((i, el) => {
                return el != this.newTabButton
            });
            this.selectTab(
                siblings.get(Math.min(siblings.length - 1, index))
            );
        }

        // Remove the tab
        this.tabComponentMap.delete(tab);
        $(tab).remove();
        this.tabCount--;
    }

    /**
     * Select the given tab and its referenced values while de-selecting all other tabs.
     * @param tab 
     */
    selectTab(tab: HTMLElement) {
        $(this.tabContent).children().hide();
        let component = this.tabComponentMap.get(tab);
        $((component.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement).show();

        (component.instance as Tabbable).tab.clearStateStyling();
        $(this.activeTab).removeClass('active');
        $(tab).addClass('active');
        this.activeTab = tab;
    }

    /**
     * Create a new component, a new tab to go with it, then link them together.
     */
    createNewComponentTab() {
        let component = this.appendNewComponent();
        this.components.add(component);
        this.assignTabToComponent(component);
    }

    /**
     * Create a new component of the type managed by this, and append it to the view before returning it.
     */
    appendNewComponent(): ComponentRef<any> {
        let component = this.factory.create(this.injector);
        this.appRef.attachView(component.hostView);
        return component;
    }

    /**
     * Given a ComponentRef managed by this, create a new tab and assign it to the component.
     * The assigned tab will also be set to active.
     * @param component 
     * @param id Optional numerical value for an id to assign to this tab.  If one is not supplied, one will be obtained from the IdPool.
     */
    assignTabToComponent(component: ComponentRef<any>, id: number = null) {
        // Hide all other managed tab views
        $(this.tabContent).children().hide();

        // Add the new component
        $(this.tabContent).append(
            (component.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement
        );

        // Get an id if one was not supplied
        if (id == null) {
            id = this.idPool.get();
        }
        (component.instance as Tabbable).setTabId(id);

        // Add this id to the collision map
        if(!this.idCollisionMap.has(id)) {
            this.idCollisionMap.set(id, 0);
        }
        this.idCollisionMap.set(id, this.idCollisionMap.get(id) + 1);

        let name = (id + 1).toString();
        // Create a new tab and link it up
        let tab = $(`<div class="tab" data-toggle="tab"></div>`)
            .append(`Tab ${name}`)
            .append('<i class="fa fa-close clear-tab"></i>')
            .get(0);
        $(this.newTabButton).before(tab);
        (component.instance as Tabbable).tab = new Tab(tab, this, name);
        this.tabComponentMap.set(tab, component);
        this.selectTab(tab);
        this.tabCount++;
    }

    /**
     * Get a reference to the currently selected component.
     */
    public getActiveComponent(): any {
        if (this.tabCount > 0) {
            return this.tabComponentMap.get(this.activeTab).instance;
        }
        return null;
    }

    /**
     * Handle the removal of the id atached to the given tab.
     * @param tab 
     */
    private removeTabId(tab: Tabbable) {
        let id = tab.tabId;
        this.idCollisionMap.set(id, this.idCollisionMap.get(id) - 1);
        if(this.idCollisionMap.get(id) == 0) {
            this.idPool.return(id);
            this.idCollisionMap.delete(id);
        }
    }

    private rename(tab: Tab) {

    }
}
